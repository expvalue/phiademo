from __future__ import annotations

import time
from urllib.parse import urlparse

import chromadb

from .config import get_settings


def get_chroma_client(retries: int = 8, delay: float = 1.5) -> chromadb.HttpClient:
    settings = get_settings()
    parsed = urlparse(settings.chroma_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 8000
    ssl = parsed.scheme == "https"
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            return chromadb.HttpClient(host=host, port=port, ssl=ssl)
        except Exception as exc:  # pragma: no cover - best-effort retry
            last_error = exc
            time.sleep(delay)
    raise RuntimeError("Unable to connect to Chroma") from last_error


def get_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="friend_events",
        metadata={"hnsw:space": "cosine"},
    )
