import hashlib
import json
import os
import random
import time
from typing import List

import psycopg2
import requests

EMBEDDING_DIMENSION = 1536
MODEL_NAME = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")


def deterministic_embedding(text: str, dimension: int = EMBEDDING_DIMENSION) -> List[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:4], "big")
    rng = random.Random(seed)
    return [rng.uniform(-1, 1) for _ in range(dimension)]


def openai_embedding(text: str) -> List[float]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return deterministic_embedding(text)

    response = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"input": text, "model": MODEL_NAME},
        timeout=30,
    )
    if response.status_code != 200:
        return deterministic_embedding(text)

    data = response.json()
    return data["data"][0]["embedding"]


def format_vector(vector: List[float]) -> str:
    return "[" + ",".join(f"{value:.6f}" for value in vector) + "]"


def main() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    conn = psycopg2.connect(database_url)
    conn.autocommit = True

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.id, p.name, p.brand, p.category, p.description
            FROM products p
            LEFT JOIN product_embeddings pe ON pe.product_id = p.id
            WHERE pe.product_id IS NULL
            ORDER BY p.id
            """
        )
        rows = cur.fetchall()

    if not rows:
        print("Embeddings already up to date.")
        return

    inserted = 0
    with conn.cursor() as cur:
        for product_id, name, brand, category, description in rows:
            text = f"{name}. {brand}. {category}. {description}"
            embedding = openai_embedding(text)
            vector_literal = format_vector(embedding)
            cur.execute(
                """
                INSERT INTO product_embeddings (product_id, embedding)
                VALUES (%s, %s::vector)
                ON CONFLICT (product_id) DO NOTHING
                """,
                (product_id, vector_literal),
            )
            inserted += 1
            time.sleep(0.05)

    print(json.dumps({"inserted": inserted}))


if __name__ == "__main__":
    main()
