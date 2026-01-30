CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  strength NUMERIC(4,2) NOT NULL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(8,2) NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_events (
  id SERIAL PRIMARY KEY,
  friend_id INTEGER NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'view')),
  event_ts TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_embeddings (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS friend_events_product_idx ON friend_events(product_id);
CREATE INDEX IF NOT EXISTS friend_events_friend_idx ON friend_events(friend_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

CREATE INDEX IF NOT EXISTS product_embeddings_embedding_idx
  ON product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
