#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"

if [[ -f "${ENV_FILE}" ]]; then
  echo ".env already exists at ${ENV_FILE}"
  exit 0
fi

if [[ ! -f "${EXAMPLE_FILE}" ]]; then
  echo "Missing ${EXAMPLE_FILE}. Please restore .env.example before running this script."
  exit 1
fi

cp "${EXAMPLE_FILE}" "${ENV_FILE}"
echo "Created ${ENV_FILE}. Add your VOYAGE_API_KEY to that file."
