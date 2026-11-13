# Cognify

AI-powered study platform for coaching institutes (multi-tenant). Teachers upload
study material (PDF/PPTX/DOCX/TXT); the system parses, chunks, and embeds it,
then auto-generates notes, key points, quizzes, and flashcards as drafts. Teachers
review and approve; students access cited chat, notes, quizzes, flashcards, and
doubt tickets.

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/Omprakash-7/Cognify.git
cd Cognify

# 2. Environment
cp .env.example .env
# Edit .env — set DATABASE_URL to your Supabase / Neon connection string
cp .env web/.env.local

# 3. Install
npm install
npm --prefix web install

# 4. Database
npm run db:migrate
npm run db:seed
npm run db:check        # should print "Setup check passed."

# 5. Run
npm run dev             # Next.js dev server on http://localhost:3000
npm run worker          # in a second terminal

# 6. Verify
open http://localhost:3000/api/health
```

Or use the automated script (still need to fill in secrets manually):

```bash
chmod +x setup.sh && ./setup.sh
```

## Folder Structure

```
cognify/
├── CLAUDE.md           # Project context for AI assistants
├── README.md           # This file
├── .gitignore
├── .env.example        # Template (never commit .env)
├── package.json        # Root scripts & shared deps (pg, bcryptjs, dotenv)
├── setup.sh            # One-command setup
├── web/                # Next.js App Router (JavaScript, Tailwind CSS)
│   └── app/api/health/ # Health check endpoint
├── worker/             # Background job processor
│   ├── index.js        # Poll loop
│   └── handlers.js     # Job type stubs
├── db/                 # Database scripts
│   ├── schema.sql      # Full schema (idempotent)
│   ├── migrate.js      # Run migrations
│   ├── seed.js         # Demo data
│   └── check.js        # Verify setup
├── lib/                # Shared libraries
│   ├── env.js          # dotenv loader
│   ├── db.js           # pg Pool, query, transaction helpers
│   ├── vector.js       # pgvector helpers
│   ├── chunk.js        # Text chunking
│   └── chunk.test.js   # Chunk tests
└── docs/               # Documentation (future)
```

## Demo Logins

All passwords: `Password@123`

| Institute              | Email               | Role    |
| ---------------------- | ------------------- | ------- |
| Demo Coaching Institute| admin@demo.test     | admin   |
| Demo Coaching Institute| teacher@demo.test   | teacher |
| Demo Coaching Institute| student1@demo.test  | student |
| Demo Coaching Institute| student2@demo.test  | student |
| Demo Coaching Institute| student3@demo.test  | student |
| Rival Institute        | teacher@rival.test  | teacher |
| Rival Institute        | student@rival.test  | student |

## npm Scripts

| Script           | Description                       |
| ---------------- | --------------------------------- |
| `npm run dev`    | Start Next.js dev server          |
| `npm run worker` | Start background job worker       |
| `npm run db:migrate` | Run database migrations       |
| `npm run db:seed`    | Seed demo data               |
| `npm run db:check`   | Verify database setup         |
| `npm run test:chunk` | Run chunking unit tests       |

## Team Ownership

| Member | Area                                                     |
| ------ | -------------------------------------------------------- |
| A      | Frontend — web pages, review screen, chat UI             |
| B      | Backend — API routes, auth, upload, quiz scoring         |
| C      | AI pipeline — worker, parsing, chunking, embeddings      |
| D      | Database + quality — db/, storage, deploy, isolation tests |

## Rules

- **JavaScript only** (ESM, no TypeScript)
- **Tenant isolation**: every query filters by `institute_id` from JWT
- **Parameterised SQL only** — never interpolate user input
- **Branch per feature** → pull request → one reviewer
- **Never commit `.env`**; only `.env.example` goes into the repo
- Students see generated items only when `status = 'approved' AND is_stale = false`
