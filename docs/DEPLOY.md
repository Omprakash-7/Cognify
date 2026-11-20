# Cognify Deployment Guide

This document outlines deployment procedures for Cognify:
1. **Next.js Web Frontend & API** on Vercel.
2. **Background Worker Service** on Render or Railway.
3. **Database & Storage Infrastructure** on Supabase (PostgreSQL + pgvector + Supabase Storage).
4. **Key Rotation & Security Checklist**.
5. **Post-Deployment Smoke Tests**.

---

## 1. Web API Deployment on Vercel

Cognify's web tier is built with Next.js 16 App Router located in the `/web` subdirectory. Because `web` imports business logic and shared utilities from the parent `../lib/` directory, specific monorepo configuration is required.

### Vercel Configuration Settings

1. **Framework Preset**: `Next.js`
2. **Root Directory**: `web`
3. **Include Source Files Outside Root Directory**: **ENABLED** (Critical: this allows Next.js to import `../lib/` as configured with `experimental.externalDir: true` in `web/next.config.mjs`).
4. **Build Command**: `next build` (or `npm run build`)
5. **Output Directory**: `.next`
6. **Node.js Version**: `20.x` or `22.x`

### Function Duration

The cited chat route (`web/app/api/batches/[id]/chat/route.js`) streams responses via Server-Sent Events (SSE) and includes:
```javascript
export const maxDuration = 60; // Allows up to 60 seconds streaming on Vercel Pro
```

### Required Environment Variables on Vercel

| Variable | Description | Example / Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `JWT_SECRET` | Secret key for signing HS256 tokens | Must be at least 32 characters long |
| `STORAGE_URL` | Supabase API URL | `https://<project-ref>.supabase.co` |
| `STORAGE_KEY` | Supabase Service Role Secret Key | Keep secret; used server-side only |
| `STORAGE_BUCKET` | Storage bucket name | `cognify-files` (private bucket) |
| `LLM_API_KEY` | Google Gemini API key | From Google AI Studio |
| `LLM_CHAT_MODEL` | Gemini model for chat | `gemini-3.5-flash-lite` |
| `LLM_GEN_MODEL` | Gemini model for content generation | `gemini-3.5-flash-lite` |
| `LLM_EMBED_MODEL` | Gemini model for embeddings | `gemini-embedding-001` |
| `EMBED_DIM` | Vector dimensionality | `1536` (pinned to match pgvector index) |
| `MAX_UPLOAD_MB` | Maximum file upload size in MB | `25` |
| `MAX_PAGES` | Maximum page count for documents | `300` |
| `CHAT_MAX_PER_HOUR` | Per-user chat rate limit | `30` |
| `LOGIN_MAX_FAILS` | Max failed logins per 15 min | `5` |
| `SIGNED_URL_SECONDS`| Upload/download signed URL TTL | `300` |

---

## 2. Background Worker Deployment (Render / Railway)

The Cognify worker processes asynchronous background jobs (`process_document`, `generate_notes`, `generate_quiz`, `generate_flashcards`) by polling the PostgreSQL `jobs` table. It does not require external message queues like Redis or BullMQ.

### Render Configuration

1. Create a new **Background Worker** service.
2. Connect your Git repository.
3. **Environment**: `Node`
4. **Build Command**: `npm install`
5. **Start Command**: `npm run start:worker`
6. **Auto-Deploy**: `Yes`

### Railway Configuration

1. Create a new Service connected to the GitHub repo.
2. Set root directory to repository root `/`.
3. Set start command: `npm run start:worker`.

### Worker Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (session or transaction pooler) |
| `STORAGE_URL` | Supabase project URL |
| `STORAGE_KEY` | Supabase Service Role Secret Key |
| `STORAGE_BUCKET` | `cognify-files` |
| `LLM_API_KEY` | Google Gemini API key |
| `LLM_GEN_MODEL` | `gemini-3.5-flash-lite` |
| `LLM_EMBED_MODEL`| `gemini-embedding-001` |
| `EMBED_DIM` | `1536` |
| `WORKER_POLL_MS` | Job poll interval in milliseconds (default: `2000`) |

---

## 3. Supabase Infrastructure Checklist

1. **PostgreSQL Database**:
   - Ensure the `vector` extension is active:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```
2. **Execute Migrations**:
   - From your deployment environment or local machine:
     ```bash
     npm run db:migrate
     ```
   - All 11 tables and additive indexes will be created idempotently.
3. **Supabase Storage Bucket**:
   - Bucket Name: `cognify-files`
   - **Public**: `OFF` (Private bucket). Files must NEVER be publicly readable without signed URLs.
   - Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`.
   - File size limit: 25 MB.
4. **Database Connection Pooling**:
   - For serverless Next.js route handlers on Vercel, use Supabase's transaction pooler (port `6543` with `?pgbouncer=true`).
   - For the long-running worker on Render/Railway, session pooler (port `5432`) is recommended.

---

## 4. Key Rotation Procedures

### Rotating `JWT_SECRET`
1. Generate a new cryptographic secret:
   ```bash
   node -e "console.log(crypto.randomBytes(32).toString('hex'))"
   ```
2. Update `JWT_SECRET` in Vercel environment variables.
3. Redeploy the web service. Existing sessions will expire gracefully and prompt users to re-login.

### Rotating `STORAGE_KEY` (Supabase Service Key)
1. Go to Supabase Project Settings -> API -> Project API Keys.
2. Generate a new secret key.
3. Update `STORAGE_KEY` on Vercel and Render/Railway.
4. Redeploy both services.
5. Invalidate the old key in Supabase.

### Rotating `LLM_API_KEY` (Google Gemini)
1. Create a new API key in Google AI Studio.
2. Update `LLM_API_KEY` on Vercel and Render/Railway.
3. Run `npm run llm:check` to verify the new key.
4. Delete the old key in Google AI Studio.

---

## 5. Post-Deployment Smoke Tests

Execute these verification commands after every production deployment:

```bash
# 1. Database and pgvector verification
npm run db:check

# 2. Supabase storage upload/download roundtrip
npm run storage:check

# 3. Google Gemini API embeddings and JSON generation
npm run llm:check

# 4. HTTP Health Endpoint Check
curl -f https://<your-vercel-domain>/api/health
# Expected output: {"status":"ok","dbTime":"..."}
```
