# CLAUDE.md — Cognify Backend Context

Multi-tenant AI study platform: teachers upload study material (PDF/PPTX/DOCX/TXT); worker parses, chunks, embeds (Gemini 1536-dim), and generates notes/quizzes/flashcards as drafts; teachers review; students access cited chat (SSE + RRF), quizzes (server scoring), and tickets; teachers/admins get analytics.

## Tech Stack
- **Runtime & DB**: Node.js ESM, Next.js 16 App Router (`web/`), PostgreSQL + pgvector, raw SQL (`$1, $2`), private Supabase bucket.
- **AI**: Gemini (`gemini-3.5-flash-lite`, `gemini-embedding-001` at 1536 dims).
- **Worker**: `worker/index.js` polling `jobs` table (no Redis/BullMQ).

## Core Security & Tenancy Rules
- `institute_id` and role come strictly from verified JWT cookie (`cognify_token`), NEVER from request body/query/params.
- Cross-institute or non-member access returns **404**, never 403 or 401 (prevents enumeration).
- Students see `generated_items` ONLY when `status = 'approved' AND is_stale = false`.
- Parameterized SQL only (`lib/db.js`). Secrets never logged or exposed. Passwords hashed with bcrypt (10 rounds).

## Roles & Permissions Matrix
| Endpoint / Resource | Admin | Teacher | Student | Notes |
| :--- | :---: | :---: | :---: | :--- |
| `POST /api/auth/login`, `logout`, `me` | ✓ | ✓ | ✓ | Generic error, rate limit 5 fails/15m |
| `POST /api/users`, `GET /api/users` | ✓ | Read | ✗ | Admin creates users in institute |
| `POST /api/batches`, `GET /api/batches` | ✓ | Create/Read | Read | Students see only enrolled batches |
| `POST /api/batches/[id]/members` | ✓ | Add Student | ✗ | Teachers cannot add teachers or remove last teacher |
| `POST /api/batches/[id]/documents` | ✓ | In batch | ✗ | Upload PDF/PPTX/DOCX/TXT <=25MB |
| `POST /api/documents/[id]/generate`| ✓ | In batch | ✗ | Enqueue generation jobs |
| `GET /api/documents/[id]/items` | All | All | Approved | Students never see drafts/stale |
| `PATCH/DELETE /api/items/[id]` | ✓ | In batch | ✗ | Edit content (zod checked), delete drafts |
| `POST /api/items/[id]/approve\|reject` | ✓ | In batch | ✗ | Sets review status |
| `POST /api/batches/[id]/chat` | ✓ | In batch | In batch | SSE stream with [n] citations or fallback |
| `GET /api/quizzes/[id]` | ✓ | In batch | In batch | Correct answers stripped for students |
| `POST /api/quizzes/[id]/attempt` | ✗ | ✗ | In batch | Server-side scoring, writes `quiz_attempts` |
| `POST /api/batches/[id]/tickets` | ✓ | In batch | In batch | Creates doubt ticket |
| `POST /api/tickets/[id]/answer` | ✓ | In batch | ✗ | Sets status 'answered', answered_by |
| `POST /api/tickets/[id]/close` | ✓ | In batch | Owner | Owner or teacher can close |
| `GET /api/batches/[id]/analytics` | ✓ | In batch | ✗ | Aggregates, hardest questions, student progress |
| `GET /api/analytics/institute` | ✓ | ✗ | ✗ | Per-batch totals & institute stats |

## Scripts
- `npm run dev`: Next.js web app (`web/`)
- `npm run worker` / `npm run worker:once`: Background job processor
- `npm run db:migrate` / `db:seed` / `db:check`: Database management
- `npm run llm:check` / `npm run storage:check`: Service verification
- `npm run test:chunk` / `test:isolation` / `test:documents` / `test:pipeline` / `test:chat` / `test:generation` / `test:review` / `test:tickets`
- `npm run test:all`: Run complete regression test suite
- `npm run demo:content`: Populate sample demo documents (idempotent, run only when asked)

## Status
- [x] Phase 1: Auth, Roles, Batches, Isolation (`tests/isolation.test.js` - 12/12)
- [x] Phase 2: Documents & Upload (`tests/documents.test.js` - 6/6)
- [x] Phase 3: Worker Pipeline & Parsers (`tests/pipeline.test.js` - 7/7)
- [x] Phase 4: Cited Chat, Retrieval, RRF (`tests/chat.test.js` - 7/7)
- [x] Phase 5: Generation & Grounding Engine (`tests/generation.test.js` - 9/9)
- [x] Phase 6: Review & Student Study API (`tests/review.test.js` - 9/9)
- [x] Phase 7: Doubt Tickets & Analytics (`tests/tickets-analytics.test.js` - 9/9)
- [x] Phase 8: Hardening, Demo Content, Deploy Docs & Final Schema ERD
