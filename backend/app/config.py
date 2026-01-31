from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_url: str = os.getenv("DB_URL", "")
    chroma_url: str = os.getenv("CHROMA_URL", "http://localhost:8000")
    voyage_api_key: str = os.getenv("VOYAGE_API_KEY", "")
    voyage_model: str = os.getenv("VOYAGE_MODEL", "voyage-2")
    confidence_distance_high: float = float(os.getenv("CONFIDENCE_DISTANCE_HIGH", "0.25"))
    confidence_distance_med: float = float(os.getenv("CONFIDENCE_DISTANCE_MED", "0.45"))


def get_settings() -> Settings:
    return Settings()
