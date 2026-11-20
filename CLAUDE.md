# CLAUDE.md — Cognify Project Context

## Project Description

Cognify is an AI-powered study platform for coaching institutes (multi-tenant).
Teachers upload study material (PDF/PPTX/DOCX/TXT); the system parses, chunks,
and embeds content, then auto-generates notes, key points, quizzes, and flashcards
as drafts. Teachers review and approve; students access cited chat (source file +
page), notes, quizzes, flashcards, and doubt tickets.

## Stack & Decisions

- **Language**: Plain JavaScript, ESM (`"type": "module"`). No TypeScript. No Python. No ORM.
- **Web**: Next.js App Router (JavaScript, Tailwind CSS, no `src/` dir, import alias `@/*`) in `web/`.
- **Worker**: Separate Node.js process in `worker/` that polls the `jobs` table (no Redis/BullMQ).
- **Database**: PostgreSQL + pgvector (Supabase or Neon), raw SQL via the `pg` package.
- **Root deps**: `pg`, `bcryptjs`, `dotenv`.
- **Validation**: Zod for request body and LLM JSON validation (to be added).
- **Storage**: Supabase Storage with a PRIVATE bucket (`cognify-files`), accessed server-side with secret key; browser uploads use signed upload URLs from our API.
- **Auth**: JWT-based (configured later).
- **LLM**: Google Gemini API via AI Studio (`@google/genai`).

## Folder Structure

```
cognify/
├── CLAUDE.md, README.md, .gitignore, .env.example, package.json, setup.sh
├── web/           Next.js App Router app
├── worker/        Background job processor (index.js, handlers.js)
├── db/            schema.sql, migrate.js, seed.js, check.js
├── lib/           env.js, db.js, vector.js, chunk.js, chunk.test.js
└── docs/          Documentation (.gitkeep)
```

## Database Tables (11)

1. **institutes** — tenants
2. **users** — all users with role (admin/teacher/student)
3. **batches** — classes/sections within an institute
4. **batch_members** — many-to-many (batch ↔ user)
5. **documents** — uploaded files with processing status
6. **chunks** — text chunks with pgvector embeddings and tsvector full-text search
7. **generated_items** — AI-generated content (notes, quizzes, flashcards) with review status
8. **jobs** — background job queue
9. **chat_messages** — cited chat history
10. **quiz_attempts** — student quiz scores
11. **tickets** — doubt resolution tickets

## Tenant Isolation Rules

- Every table carries `institute_id` (`batch_members` is scoped via its batch).
- Every query filters by `institute_id` from the JWT, **never** from request input.
- Students see only their batches (via `batch_members`).
- Students see `generated_items` only when `status = 'approved' AND is_stale = false`.
- Retrieval filters `institute_id` and `batch_id` **BEFORE** vector search.
- v1 uses `scope = 'batch'` only. Future `scope = 'personal'` = `owner_id`'s private notes, never visible to teachers/admins.
- **Parameterized SQL only** — never interpolate user input into queries.
- A Rival Institute user must **never** read Demo Institute data.

## Environment Variables

| Variable         | Description                          |
| ---------------- | ------------------------------------ |
| `DATABASE_URL`   | PostgreSQL connection string         |
| `EMBED_DIM`      | Embedding vector dimension (default 1536) |
| `JWT_SECRET`     | Secret for signing JWTs              |
| `LLM_API_KEY`    | API key for the LLM provider         |
| `LLM_CHAT_MODEL` | Gemini chat model (default `gemini-3.5-flash-lite`) |
| `LLM_EMBED_MODEL`| Gemini embedding model (default `gemini-embedding-001`) |
| `STORAGE_URL`    | Object storage endpoint              |
| `STORAGE_KEY`    | Object storage access key            |
| `STORAGE_BUCKET` | Bucket name (default `cognify-files`)|
| `WORKER_POLL_MS` | Worker poll interval in ms (default 2000) |

## AI Models

- **Provider**: Google Gemini API via AI Studio (`@google/genai`).
- **Chat Model**: `gemini-3.5-flash-lite` (configurable via `LLM_CHAT_MODEL`).
- **Embedding Model**: `gemini-embedding-001` (configurable via `LLM_EMBED_MODEL`).
- **Dimension**: Embeddings requested at `EMBED_DIM=1536` via `outputDimensionality` because the model default is 3072, above pgvector's 2000-dimension index limit.

Scripts and worker load the root `.env` via `lib/env.js` (dotenv).
Next.js reads `web/.env.local` (copy of `.env`, gitignored).

## Coding Conventions

- JavaScript only, ESM (`import`/`export`).
- JSDoc on every exported function in `lib/`.
- ESLint + Prettier defaults.
- Zod for request body and LLM JSON validation.
- Branch per feature + pull request + one reviewer.
- Commit daily; never commit `.env`.
- Raw SQL with parameterized queries only (no ORM).

## Team Roles

| Member | Responsibility                                                        |
| ------ | --------------------------------------------------------------------- |
| A      | Frontend — web pages, review screen, chat UI                          |
| B      | Backend — API routes, auth, upload, quiz scoring                      |
| C      | AI pipeline — worker, parsing, chunking, embeddings, prompts          |
| D      | Database + quality — db/, storage, deploy, isolation tests, docs      |

## Milestones

| Date       | Day | Milestone                                            |
| ---------- | --- | ---------------------------------------------------- |
| Fri 13 Nov | 1   | Project setup                                        |
| Sat 14 Nov | 2   | Auth, roles, batches, parser tests                   |
| Sun 15 Nov | 3   | Upload, worker, parsing                              |
| Mon 16 Nov | 4   | Chunks + embeddings                                  |
| Tue 17 Nov | 5   | Cited chat MVP                                       |
| Wed 18 Nov | 6   | Notes + key points                                   |
| Thu 19 Nov | 7   | Quizzes, flashcards, review screen                   |
| Fri 20 Nov | 8   | Student views                                        |
| Sat 21 Nov | 9   | Analytics, tickets, isolation test                   |
| Sun 22 Nov | 10  | Deploy + polish                                      |
| Mon 23 Nov | 11  | Freeze at noon, docs, demo                           |
| Tue 24 Nov | 12  | Submit                                               |

## Status

- [x] Repository cloned and branch created
- [x] Folder structure created
- [x] Root package.json with scripts
- [x] .env.example and .gitignore
- [x] lib/ — env.js, db.js, vector.js, chunk.js, chunk.test.js
- [x] db/ — schema.sql, migrate.js, seed.js, check.js
- [x] worker/ — index.js, handlers.js
- [x] web/ — Next.js app with health endpoint
- [x] CLAUDE.md, README.md, setup.sh
- [x] Chunk tests pass
- [x] Database migration verified
- [x] Seed data loaded
- [x] Setup check passed
- [x] Health endpoint returns ok
- [x] Worker polls without errors
- [x] Storage check passed (lib/storage-check.js)
- [x] Phase 1: Auth, roles, batches, isolation tests pass
- [x] Phase 2: Documents & upload pass (lib/storage.js, tests/documents.test.js)
- [x] Phase 3: Worker pipeline & parsers pass (lib/parsers/, worker/index.js --once, tests/pipeline.test.js)
- [x] Phase 4: Cited chat with SSE & RRF pass (lib/retrieval.js, tests/chat.test.js)
- [x] Phase 5: Generation & grounding engine pass (lib/grounding.js, tests/generation.test.js)
- [x] Phase 6: Review & student study API pass (tests/review.test.js)
