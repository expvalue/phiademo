CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.7
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_events (
  id SERIAL PRIMARY KEY,
  friend_id INTEGER NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_events_friend_id ON friend_events(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_events_product_id ON friend_events(product_id);
CREATE INDEX IF NOT EXISTS idx_friend_events_created_at ON friend_events(created_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
