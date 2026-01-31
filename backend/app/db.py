from __future__ import annotations

import contextlib
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import get_settings


@contextlib.contextmanager
def get_conn() -> Iterator[psycopg2.extensions.connection]:
    settings = get_settings()
    if not settings.db_url:
        raise RuntimeError("DB_URL is not set")
    conn = psycopg2.connect(settings.db_url, cursor_factory=RealDictCursor)
    conn.autocommit = True
    try:
        yield conn
    finally:
        conn.close()


def fetch_all(query: str, params: tuple | None = None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()


def fetch_one(query: str, params: tuple | None = None) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def execute(query: str, params: tuple | None = None) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
