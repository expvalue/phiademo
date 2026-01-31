#!/usr/bin/env bash
set -euo pipefail

wait_for_service() {
  local name="$1"
  local host="$2"
  local port="$3"
  local retries=30
  local delay=2
  local count=0

  echo "Waiting for ${name} at ${host}:${port}..."
  while ! (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
    count=$((count + 1))
    if [[ "${count}" -ge "${retries}" ]]; then
      echo "Timed out waiting for ${name} at ${host}:${port}"
      return 1
    fi
    sleep "${delay}"
  done
  echo "${name} is available."
}

db_host="${DB_HOST:-db}"
db_port="${DB_PORT:-5432}"
chroma_host="${CHROMA_HOST:-chroma}"
chroma_port="${CHROMA_PORT:-8000}"

wait_for_service "Postgres" "${db_host}" "${db_port}"
wait_for_service "Chroma" "${chroma_host}" "${chroma_port}"

echo "Applying migrations..."
psql "${DB_URL}" -f /app/db/migrations/001_init.sql
echo "Migrations applied."

echo "Seeding database..."
python /app/scripts/seed_data.py
echo "DB seeded."

echo "Populating Chroma..."
python /app/scripts/reset_vector_db.py
echo "Chroma populated."

exec uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
