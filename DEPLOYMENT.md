# Deployment guide

This project ships a Next.js frontend, a FastAPI backend, Postgres for relational data, and Chroma for vector search.

## 1) Postgres
Use Supabase (or any hosted Postgres) and create a database.

Set the connection string as `DB_URL` in your backend environment.

## 2) Chroma
You can deploy Chroma as a small container service (Render/Fly.io) or keep it alongside the backend.

Recommended container:
```
chromadb/chroma:latest
```

Expose port `8000` and use persistent storage. Set:
```
CHROMA_URL=https://<your-chroma-host>
```

## 3) Backend (FastAPI)
Deploy `backend/Dockerfile` to Render/Fly.io.

Environment variables:
- `DB_URL`
- `CHROMA_URL`
- `VOYAGE_API_KEY`
- `VOYAGE_MODEL` (default: `voyage-2`)
- `CONFIDENCE_DISTANCE_HIGH`
- `CONFIDENCE_DISTANCE_MED`

On first run, the backend seeds relational data and populates Chroma if empty.

## 4) Frontend (Next.js)
Deploy the root `Dockerfile` to Vercel.

Environment variables:
- `NEXT_PUBLIC_API_URL` (e.g. `https://your-backend-url`)

## 5) Verify endpoints
1. `GET /api/recommendations?q=serum`
2. `GET /api/debug/vector?q=lamp`
3. Confirm confidence badges render in the UI.

## Demo mode (easy sharing)
Set:
```
VOYAGE_API_KEY=...
VOYAGE_MODEL=voyage-2
CONFIDENCE_DISTANCE_HIGH=0.25
CONFIDENCE_DISTANCE_MED=0.45
```
Use a hosted Chroma instance with persistent storage so results are stable across demos.
