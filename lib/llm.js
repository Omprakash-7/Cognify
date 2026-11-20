/**
 * LLM integration for Cognify using Google Gemini via @google/genai.
 * Provides text generation, streaming, JSON mode with zod validation,
 * and vector embedding with retry logic and concurrency control.
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.LLM_API_KEY;
const CHAT_MODEL = process.env.LLM_CHAT_MODEL || 'gemini-3.5-flash-lite';
const EMBED_MODEL = process.env.LLM_EMBED_MODEL || 'gemini-embedding-001';
const EMBED_DIM = Number(process.env.EMBED_DIM || 1536);

let ai = null;
function getAI() {
  if (ai) return ai;
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not set');
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

// Concurrency limiter (cap 3)
const MAX_CONCURRENT = 3;
let activeCount = 0;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve) => {
    if (activeCount < MAX_CONCURRENT) {
      activeCount++;
      resolve();
    } else {
      waitQueue.push(resolve);
    }
  });
}

function releaseSlot() {
  activeCount--;
  if (waitQueue.length > 0) {
    activeCount++;
    const next = waitQueue.shift();
    next();
  }
}

async function withConcurrencyLimit(fn) {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

/**
 * Retry a function on 429 or 5xx with exponential backoff.
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const status = err?.status || err?.code || (err?.message?.includes('429') ? 429 : 0);
      const isRateOrServer = status === 429 || (status >= 500 && status < 600) || err?.message?.includes('429');

      if (attempt >= maxRetries || !isRateOrServer) {
        // Redact API key from error message before rethrowing
        const safeMsg = String(err?.message || err).replace(apiKey || '', '***');
        const safeErr = new Error(safeMsg);
        safeErr.status = status;
        throw safeErr;
      }

      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Generate embeddings for an array of texts.
 * Batches in groups of up to 50 texts.
 *
 * @param {string[]} texts
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} [taskType='RETRIEVAL_DOCUMENT']
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!texts || texts.length === 0) return [];
  const client = getAI();

  const BATCH_SIZE = 50;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const embeddings = await withConcurrencyLimit(() =>
      retryWithBackoff(async () => {
        const res = await client.models.embedContent({
          model: EMBED_MODEL,
          contents: batch.length === 1 ? batch[0] : batch,
          config: {
            taskType,
            outputDimensionality: EMBED_DIM,
          },
        });

        const list = res.embeddings || [];
        if (list.length === 0) {
          throw new Error('Embeddings response returned empty list');
        }

        return list.map((item) => {
          const values = item?.values;
          if (!Array.isArray(values) || values.length !== EMBED_DIM) {
            throw new Error(`Embedding vector dimension mismatch: expected ${EMBED_DIM}, got ${values?.length}`);
          }
          return values;
        });
      })
    );

    results.push(...embeddings);
  }

  return results;
}

/**
 * Generate text using the chat model.
 *
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {string} [opts.system]
 * @param {string} opts.prompt
 * @returns {Promise<string>}
 */
export async function generateText({ model, system, prompt }) {
  const client = getAI();
  const targetModel = model || CHAT_MODEL;

  return withConcurrencyLimit(() =>
    retryWithBackoff(async () => {
      const config = {};
      if (system) config.systemInstruction = system;

      const res = await client.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: Object.keys(config).length ? config : undefined,
      });

      return (res.text ?? '').trim();
    })
  );
}

/**
 * Stream text chunks using the chat model.
 *
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {string} [opts.system]
 * @param {string} opts.prompt
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* streamText({ model, system, prompt }) {
  const client = getAI();
  const targetModel = model || CHAT_MODEL;

  await acquireSlot();
  try {
    const config = {};
    if (system) config.systemInstruction = system;

    const stream = await client.models.generateContentStream({
      model: targetModel,
      contents: prompt,
      config: Object.keys(config).length ? config : undefined,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } finally {
    releaseSlot();
  }
}

/**
 * Generate JSON validated against a Zod schema with 1 self-correcting retry.
 *
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {string} [opts.system]
 * @param {string} opts.prompt
 * @param {import('zod').ZodTypeAny} opts.zodSchema
 * @returns {Promise<any>}
 */
export async function generateJson({ model, system, prompt, zodSchema }) {
  const client = getAI();
  const targetModel = model || CHAT_MODEL;

  return withConcurrencyLimit(async () => {
    let currentPrompt = prompt;

    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await retryWithBackoff(async () => {
        const config = { responseMimeType: 'application/json' };
        if (system) config.systemInstruction = system;

        const res = await client.models.generateContent({
          model: targetModel,
          contents: currentPrompt,
          config,
        });

        return (res.text ?? '').trim();
      });

      let parsedJson;
      try {
        parsedJson = JSON.parse(text);
      } catch (parseErr) {
        if (attempt === 0) {
          currentPrompt = `${prompt}\n\nYour previous reply was not valid JSON: ${parseErr.message}. Output strictly valid JSON matching the requirements.`;
          continue;
        }
        throw new Error(`Failed to parse JSON response: ${parseErr.message}`);
      }

      const validation = zodSchema.safeParse(parsedJson);
      if (validation.success) {
        return validation.data;
      }

      if (attempt === 0) {
        const errDetails = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        currentPrompt = `${prompt}\n\nYour previous JSON failed schema validation with errors: ${errDetails}. Correct these errors and return valid JSON matching the schema.`;
      } else {
        throw new Error(`JSON schema validation failed after retry: ${validation.error.message}`);
      }
    }
  });
}
