# Deployment Guide

This guide walks through deploying phiademo to hosted services.

## 1) Database (Supabase + pgvector)
1. Create a Supabase project.
2. In the SQL editor, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run `db/migrations/001_init.sql` and `db/seed.sql` in Supabase.
4. Save your connection string as `DATABASE_URL`.

## 2) Backend / API (Next.js API Routes)
phiademo uses Next.js API routes (no separate backend).

## 3) Frontend (Vercel)
1. Create a new Vercel project and connect this repository.
2. Set environment variables:
   - `DATABASE_URL`
   - `OPENAI_API_KEY` (optional, for real embeddings)
   - `OPENAI_EMBEDDING_MODEL` (optional)
3. Deploy.

## 4) Embeddings pipeline
- Run `python scripts/embed_products.py` locally or in a one-off job with access to the database.
- For OpenAI embeddings, ensure the API key is set.
- Without the key, the deterministic fallback embedding keeps the app functional.

## 5) Verification
- `GET https://<your-domain>/api/health`
- `GET https://<your-domain>/api/debug/stats`
- `GET https://<your-domain>/api/recommendations?q=cozy+travel+bag`
