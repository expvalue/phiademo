#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running migrations..."
psql "${DATABASE_URL}" -f db/migrations/001_init.sql

echo "Seeding data..."
psql "${DATABASE_URL}" -f db/seed.sql

echo "Generating embeddings..."
python scripts/embed_products.py
