/**
 * POST /api/batches/[id]/chat
 *
 * Cited Chat endpoint answering queries using Server-Sent Events (SSE).
 * Grounded in uploaded study material with RRF retrieval and prompt-injection defense.
 */

import { z } from 'zod';
import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getBatchWithAccess } from '@/lib/batches.js';
import {
  retrieveRelevantChunks,
  buildChatPrompt,
  FALLBACK_TEXT,
} from '@/lib/retrieval.js';
import { streamText } from '@/lib/llm.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const chatSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question cannot be empty')
    .max(1000, 'Question cannot exceed 1000 characters'),
});

export async function POST(req, { params }) {
  try {
    const user = await requireUser();
    const { id: batchId } = await params;

    // Verify batch exists and user has membership in tenant
    const { batch, error: batchErr } = await getBatchWithAccess(batchId, user);
    if (batchErr) return batchErr;

    // Mutating check
    const typeErr = checkContentType(req);
    if (typeErr) return typeErr;

    // Validate body
    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid question', 422);
    }
    const { question } = parsed.data;

    // Rate limit: CHAT_MAX_PER_HOUR per user (count user messages in the last hour)
    const CHAT_MAX_PER_HOUR = parseInt(process.env.CHAT_MAX_PER_HOUR || '30', 10);
    const countRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages
       WHERE user_id = $1 AND role = 'user' AND created_at > NOW() - INTERVAL '1 hour'`,
      [user.id]
    );
    const hourlyCount = countRes.rows[0]?.count || 0;
    if (hourlyCount >= CHAT_MAX_PER_HOUR) {
      return apiError(
        'RATE_LIMIT_EXCEEDED',
        `Hourly chat rate limit of ${CHAT_MAX_PER_HOUR} messages exceeded. Please try again later.`,
        429
      );
    }

    // Persist user message
    await query(
      `INSERT INTO chat_messages (institute_id, batch_id, user_id, role, content)
       VALUES ($1, $2, $3, 'user', $4)`,
      [user.institute_id, batchId, user.id, question]
    );

    // Return Server-Sent Events stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event, data) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // 1. Retrieve relevant chunks
          const { chunks, passedFloor } = await retrieveRelevantChunks({
            instituteId: user.institute_id,
            batchId,
            queryText: question,
          });

          // Case A: Nothing passed similarity floor or no relevant study material
          if (!passedFloor || chunks.length === 0) {
            sendEvent('meta', { citations: [] });
            sendEvent('token', { token: FALLBACK_TEXT });

            const savedMsg = await query(
              `INSERT INTO chat_messages (institute_id, batch_id, user_id, role, content, citations)
               VALUES ($1, $2, $3, 'assistant', $4, '[]'::jsonb)
               RETURNING id`,
              [user.institute_id, batchId, user.id, FALLBACK_TEXT]
            );

            sendEvent('done', {
              messageId: savedMsg.rows[0].id,
              grounded: false,
            });
            controller.close();
            return;
          }

          // Case B: Relevant chunks found -> stream answer with citations
          const citations = chunks.map((c, idx) => ({
            n: idx + 1,
            documentId: c.document_id,
            title: c.title,
            page: c.page_number,
            fileType: c.file_type,
            snippet: c.snippet,
            content: c.content,
          }));

          const clientCitations = citations.map(({ content, ...rest }) => rest);
          sendEvent('meta', { citations: clientCitations });

          const { systemInstruction, userPrompt } = buildChatPrompt({
            question,
            citations,
          });

          let fullText = '';
          const tokenGenerator = streamText({
            system: systemInstruction,
            prompt: userPrompt,
          });

          for await (const token of tokenGenerator) {
            fullText += token;
            sendEvent('token', { token });
          }

          // Validate citations in output
          const hasCitation =
            /\[\d+\]/.test(fullText) &&
            citations.some((c) => fullText.includes(`[${c.n}]`));

          if (!hasCitation) {
            // Answer was ungrounded / did not cite sources -> send replace with fallback
            sendEvent('replace', { text: FALLBACK_TEXT });

            const savedMsg = await query(
              `INSERT INTO chat_messages (institute_id, batch_id, user_id, role, content, citations)
               VALUES ($1, $2, $3, 'assistant', $4, '[]'::jsonb)
               RETURNING id`,
              [user.institute_id, batchId, user.id, FALLBACK_TEXT]
            );

            sendEvent('done', {
              messageId: savedMsg.rows[0].id,
              grounded: false,
            });
          } else {
            // Filter to citations actually referenced in fullText
            const usedCitations = clientCitations.filter((c) =>
              fullText.includes(`[${c.n}]`)
            );

            const savedMsg = await query(
              `INSERT INTO chat_messages (institute_id, batch_id, user_id, role, content, citations)
               VALUES ($1, $2, $3, 'assistant', $4, $5::jsonb)
               RETURNING id`,
              [
                user.institute_id,
                batchId,
                user.id,
                fullText,
                JSON.stringify(usedCitations),
              ]
            );

            sendEvent('done', {
              messageId: savedMsg.rows[0].id,
              grounded: true,
            });
          }

          controller.close();
        } catch (streamErr) {
          try {
            sendEvent('error', {
              code: 'INTERNAL_ERROR',
              message: streamErr?.message || 'Chat generation failed',
            });
          } catch {}
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
