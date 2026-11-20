# Cognify

Cognify is an AI-powered study platform for coaching institutes (multi-tenant). Teachers upload study material (PDF, PPTX, DOCX, TXT) to batches; a background worker parses, chunks, and embeds the content using Google Gemini, then auto-generates study summaries, notes, key points, quizzes, and flashcards as drafts. Teachers review and approve the content, while students access cited chat (with source file and page citations), take interactive quizzes with server-side scoring, view progress analytics, and resolve doubts with teachers via doubt tickets.

---

## 🏗️ Architecture

- **Web Frontend & API**: Next.js 16 App Router (JavaScript ESM, Tailwind CSS) under `web/`.
- **Database & Search**: PostgreSQL with `pgvector` extension (HNSW cosine similarity) + Full-Text Search (`websearch_to_tsquery`) fused with Reciprocal Rank Fusion (RRF).
- **Object Storage**: Supabase Storage with a private bucket (`cognify-files`) accessed server-side with signed upload and download URLs.
- **AI & LLM**: Google Gemini API (`gemini-3.5-flash-lite` for chat and content generation, `gemini-embedding-001` with 1536-dimensional embeddings).
- **Background Worker**: Node.js polling daemon (`worker/index.js`) executing jobs from PostgreSQL (`jobs` table).

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database with `pgvector` extension (e.g. Supabase)
- Google Gemini API key (from Google AI Studio)

### 2. Setup
```bash
# Clone repository
git clone https://github.com/Omprakash-7/Cognify.git
cd Cognify

# Install root and web dependencies
npm install
npm --prefix web install

# Configure environment
cp .env.example .env
cp .env web/.env.local
# Edit .env with your DATABASE_URL, JWT_SECRET, LLM_API_KEY, STORAGE_URL, STORAGE_KEY

# Migrate database & seed initial demo data
npm run db:migrate
npm run db:seed

# Verify setup
npm run db:check
npm run storage:check
npm run llm:check
```

### 3. Running Locally
```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start background worker
npm run worker
```

---

## 👥 Demo Logins

All demo accounts share the password: `Password@123`

| Institute | Email | Role | Accessible Batches |
| :--- | :--- | :--- | :--- |
| **Demo Coaching Institute** | `admin@demo.test` | Admin | All batches in Demo Institute |
| **Demo Coaching Institute** | `teacher@demo.test` | Teacher | Physics Batch A, Chemistry Batch B |
| **Demo Coaching Institute** | `student1@demo.test` | Student | Physics Batch A |
| **Demo Coaching Institute** | `student2@demo.test` | Student | Physics Batch A, Chemistry Batch B |
| **Demo Coaching Institute** | `student3@demo.test` | Student | Chemistry Batch B |
| **Rival Institute** (Tenant Isolation) | `teacher@rival.test` | Teacher | Maths Batch (Rival Institute) |
| **Rival Institute** (Tenant Isolation) | `student@rival.test` | Student | Maths Batch (Rival Institute) |

---

## 🧪 Demo Flow Walkthrough

1. **Authentication**:
   - `POST /api/auth/login` with email and password sets an `httpOnly`, `SameSite=Lax` session cookie (`cognify_token`).
   - `GET /api/auth/me` verifies identity and role.

2. **Document Upload (Teacher/Admin)**:
   - `POST /api/batches/[id]/documents` validates file type (PDF/PPTX/DOCX/TXT) and size (<=25MB), registers document row as `processing`, and generates a signed upload URL.
   - Client uploads raw file directly to Supabase Storage via signed URL.
   - `POST /api/documents/[id]/complete` confirms upload and enqueues `process_document` job.

3. **Background Worker Processing**:
   - Worker downloads file, verifies magic bytes, and extracts text per page/slide.
   - Chunks text into bounded segments (~1000 chars) and generates 1536-dim Gemini embeddings (`RETRIEVAL_DOCUMENT`).
   - Persists chunks with `embedding` and `content_tsv` and enqueues `generate_notes`, `generate_quiz`, and `generate_flashcards`.
   - Generates grounded drafts and validates structured outputs against Zod schemas.

4. **Review & Approval (Teacher/Admin)**:
   - Teacher calls `GET /api/documents/[id]/items` to review generated drafts.
   - `PATCH /api/items/[id]` allows editing content (validated against Zod schemas).
   - `POST /api/items/[id]/approve` sets item status to `approved`, making it visible to students.

5. **Cited Chat & Student Study**:
   - Student calls `POST /api/batches/[id]/chat` with questions.
   - System retrieves chunks via hybrid HNSW cosine vector search + full-text search fused with RRF.
   - If similarity passes floor (0.58), Gemini streams grounded response via SSE with verified `[1]`, `[2]` citations.
   - If off-topic, returns instant fallback without LLM hallucination: *"I couldn't find this in your batch's study material. You can raise a doubt ticket for your teacher."*

6. **Interactive Quizzes & Progress**:
   - Students call `GET /api/quizzes/[id]` (answers and explanations stripped to prevent client-side inspection).
   - Student submits answers via `POST /api/quizzes/[id]/attempt`.
   - Server scores attempt against `correctIndex`, persists `quiz_attempts`, and returns score and item explanations.
   - Student tracks progress with `GET /api/me/attempts` and `GET /api/me/progress`.

7. **Doubt Tickets & Analytics**:
   - Student creates ticket via `POST /api/batches/[id]/tickets`.
   - Teacher answers ticket via `POST /api/tickets/[id]/answer`.
   - Teacher accesses `GET /api/batches/[id]/analytics` for member stats, document/item breakdown, quiz metrics (average score & hardest questions), student progress, 14-day chat activity, and unanswered questions.
   - Admin accesses `GET /api/analytics/institute` for per-batch totals and institute aggregates.

---

## 🛠️ npm Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `npm --prefix web run dev` | Start Next.js App Router development server |
| `npm run worker` | `node worker/index.js` | Start long-running background job worker |
| `npm run worker:once` | `node worker/index.js --once` | Drain current job queue and exit |
| `npm run start:worker` | `node worker/index.js` | Production worker start command |
| `npm run db:migrate` | `node db/migrate.js` | Execute idempotent database schema migration |
| `npm run db:seed` | `node db/seed.js` | Seed demo and rival institutes with sample accounts |
| `npm run db:check` | `node db/check.js` | Verify database schema, vector extension, and seed data |
| `npm run llm:check` | `node lib/llm-check.js` | Smoke test Gemini embeddings and chat models |
| `npm run storage:check` | `node lib/storage-check.js` | Smoke test Supabase storage upload/download |
| `npm run test:chunk` | `node lib/chunk.test.js` | Unit test chunking algorithm |
| `npm run test:isolation` | `node tests/isolation.test.js` | Phase 1: Auth, roles, batch membership, tenant isolation tests |
| `npm run test:documents` | `node tests/documents.test.js` | Phase 2: Document upload, signed URLs, size limits, deletion tests |
| `npm run test:pipeline` | `node tests/pipeline.test.js` | Phase 3: Worker parsing (PDF/PPTX/DOCX/TXT) and chunk embeddings |
| `npm run test:chat` | `node tests/chat.test.js` | Phase 4: Cited chat SSE streaming, RRF, fallback, prompt injection |
| `npm run test:generation` | `node tests/generation.test.js` | Phase 5: LLM generation, Zod validation, quote grounding, idempotency |
| `npm run test:review` | `node tests/review.test.js` | Phase 6: Item review, approval, student quiz scoring, progress |
| `npm run test:tickets` | `node tests/tickets-analytics.test.js` | Phase 7: Doubt tickets, batch analytics, institute totals |
| `npm run test:all` | *(Runs all 7 test suites)* | End-to-end regression test suite |
| `npm run demo:content` | `node scripts/demo-content.js` | Populate demo institute with sample physics & chemistry content |
