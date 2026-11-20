-- Cognify database schema (idempotent: all IF NOT EXISTS)
-- Run with: node db/migrate.js
-- {{EMBED_DIM}} is replaced at migration time (default 1536).

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Institutes (tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS institutes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id  UUID NOT NULL REFERENCES institutes(id),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_institute ON users(institute_id);

-- ============================================================
-- Batches (classes / sections)
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutes(id),
  name         TEXT NOT NULL,
  subject      TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institute_id, name)
);

CREATE INDEX IF NOT EXISTS idx_batches_institute ON batches(institute_id);

-- ============================================================
-- Batch members (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_members (
  batch_id    UUID NOT NULL REFERENCES batches(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  member_role TEXT NOT NULL CHECK (member_role IN ('teacher', 'student')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_members_user ON batch_members(user_id);

-- ============================================================
-- Documents
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id  UUID NOT NULL REFERENCES institutes(id),
  batch_id      UUID REFERENCES batches(id),
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  scope         TEXT NOT NULL DEFAULT 'batch' CHECK (scope IN ('batch', 'personal')),
  -- scope='personal' + owner_id lets students have private notebooks later
  owner_id      UUID REFERENCES users(id),
  title         TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'pptx', 'docx', 'txt')),
  storage_path  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  page_count    INT DEFAULT 0 CHECK (page_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'batch' AND batch_id IS NOT NULL) OR
    (scope = 'personal' AND owner_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_documents_institute ON documents(institute_id);
CREATE INDEX IF NOT EXISTS idx_documents_batch ON documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- ============================================================
-- Chunks
-- chunks.institute_id and chunks.batch_id are deliberately denormalized
-- from the parent document row so retrieval queries can filter by
-- institute + batch BEFORE the vector similarity search, keeping it fast.
-- ============================================================
CREATE TABLE IF NOT EXISTS chunks (
  id           BIGSERIAL PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES institutes(id),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- batch_id is denormalized for fast retrieval filtering
  batch_id     UUID REFERENCES batches(id),
  page_number  INT NOT NULL CHECK (page_number >= 1),
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector({{EMBED_DIM}}),
  content_tsv  tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_batch ON chunks(batch_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING GIN (content_tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- Generated items (notes, quizzes, flashcards, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id  UUID NOT NULL REFERENCES institutes(id),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_type     TEXT NOT NULL CHECK (item_type IN ('summary', 'notes', 'key_points', 'quiz', 'flashcards')),
  title         TEXT,
  content       JSONB NOT NULL,
  source_pages  INT[] DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  is_stale      BOOLEAN NOT NULL DEFAULT false,
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_items_institute ON generated_items(institute_id);
CREATE INDEX IF NOT EXISTS idx_generated_items_document ON generated_items(document_id);

-- ============================================================
-- Jobs (worker queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutes(id),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  job_type     TEXT NOT NULL CHECK (job_type IN (
    'process_document', 'generate_notes', 'generate_quiz', 'generate_flashcards'
  )),
  payload      JSONB DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts     INT NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_institute ON jobs(institute_id);
CREATE INDEX IF NOT EXISTS idx_jobs_document ON jobs(document_id);

-- ============================================================
-- Chat messages
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutes(id),
  batch_id     UUID NOT NULL REFERENCES batches(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  citations    JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_lookup ON chat_messages(batch_id, user_id, created_at);

-- ============================================================
-- Quiz attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutes(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  quiz_id      UUID NOT NULL REFERENCES generated_items(id),
  score        INT NOT NULL CHECK (score >= 0),
  total        INT NOT NULL CHECK (total > 0),
  answers      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (score <= total)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- ============================================================
-- Tickets (doubt resolution)
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutes(id),
  batch_id     UUID NOT NULL REFERENCES batches(id),
  student_id   UUID NOT NULL REFERENCES users(id),
  question     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  answer       TEXT,
  answered_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_batch ON tickets(batch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_student ON tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_tickets_institute_status ON tickets(institute_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_batch_created ON chat_messages(batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_institute ON quiz_attempts(institute_id);
