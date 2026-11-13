#!/usr/bin/env bash
# setup.sh — Cognify project setup (does NOT touch secrets)
set -euo pipefail

echo "=== Cognify Setup ==="

# Check for .env
if [ ! -f .env ]; then
  echo "Copying .env.example → .env  (fill in DATABASE_URL before continuing)"
  cp .env.example .env
fi

# Root install
echo "Installing root dependencies…"
npm install

# Web install
echo "Installing web dependencies…"
npm --prefix web install

# Copy .env to web/.env.local if it doesn't exist
if [ ! -f web/.env.local ]; then
  echo "Copying .env → web/.env.local"
  cp .env web/.env.local
fi

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Edit .env and set DATABASE_URL (Supabase/Neon connection string)"
echo "  2. Edit web/.env.local with the same values"
echo "  3. npm run db:migrate"
echo "  4. npm run db:seed"
echo "  5. npm run db:check"
echo "  6. npm run dev"
