#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DB_URL:-}" ]]; then
  echo "DB_URL is not set" >&2
  exit 1
fi

echo "Running migrations..."
psql "${DB_URL}" -f db/migrations/001_init.sql

echo "Seeding relational data..."
python scripts/seed_data.py

echo "Resetting vector store..."
python scripts/reset_vector_db.py
