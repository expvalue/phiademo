from __future__ import annotations

import hashlib
import logging
import math
from typing import Iterable

import voyageai

from .config import get_settings

logger = logging.getLogger(__name__)


def _hash_embedding(text: str, dim: int = 256) -> list[float]:
    tokens = [t for t in text.lower().split() if t.strip()]
    vector = [0.0] * dim
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        for idx in range(0, len(digest), 4):
            bucket = digest[idx] % dim
            value = int.from_bytes(digest[idx : idx + 4], "little") % 1000
            vector[bucket] += value / 1000.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def embed_texts(texts: Iterable[str], input_type: str = "document") -> list[list[float]]:
    settings = get_settings()
    if not settings.voyage_api_key:
        logger.warning("VOYAGE_API_KEY missing; using deterministic fallback embeddings.")
        return [_hash_embedding(text) for text in texts]

    try:
        client = voyageai.Client(api_key=settings.voyage_api_key)
        response = client.embed(
            list(texts),
            model=settings.voyage_model,
            input_type=input_type,
        )
        return response.embeddings
    except voyageai.error.RateLimitError as e:
        logger.warning(
            "VoyageAI rate limit hit (%s); falling back to hash embeddings. "
            "Add a payment method at https://dashboard.voyageai.com/ for higher limits.",
            e,
        )
        return [_hash_embedding(text) for text in texts]


def embed_query(text: str) -> list[float]:
    return embed_texts([text], input_type="query")[0]


def embed_documents(texts: Iterable[str]) -> list[list[float]]:
    return embed_texts(texts, input_type="document")


def lexical_boost(query: str, title: str, description: str) -> float:
    tokens = [token for token in query.lower().split() if token.strip()]
    if not tokens:
        return 0.0
    haystack = f"{title} {description}".lower()
    matches = sum(1 for token in tokens if token in haystack)
    return min(matches * 0.05, 0.15)


def voyage_enabled() -> bool:
    return bool(get_settings().voyage_api_key)
