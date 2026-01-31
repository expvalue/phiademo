from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import get_settings
from .db import execute, fetch_all, fetch_one
from .embeddings import embed_documents, embed_query, lexical_boost, voyage_enabled
from .seed_data import ensure_seeded, ensure_vector_ready
from .vector_store import get_collection


app = FastAPI(title="phiademo API")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestPayload(BaseModel):
    friend_id: int
    product_id: int
    event_type: str = "purchase"


def _distance_to_confidence(distance: float) -> str:
    if distance <= settings.confidence_distance_high:
        return "High"
    if distance <= settings.confidence_distance_med:
        return "Medium"
    return "Low"


def _event_verb(event_type: str) -> str:
    return "bought" if event_type == "purchase" else "viewed"


def _normalize(value: float, min_value: float, max_value: float) -> float:
    if max_value - min_value <= 1e-6:
        return 0.0
    return (value - min_value) / (max_value - min_value)


@app.on_event("startup")
def on_startup() -> None:
    ensure_seeded()
    ensure_vector_ready()


@app.get("/api/friends")
def get_friends() -> dict[str, Any]:
    friends = fetch_all("SELECT id, name, avatar_url, strength FROM friends ORDER BY name")
    return {"friends": friends}


@app.get("/api/debug/vector")
def debug_vector(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    collection = get_collection()
    query_embedding = embed_query(q)
    results = collection.query(query_embeddings=[query_embedding], n_results=10)
    matches = []
    for metadata, distance in zip(results["metadatas"][0], results["distances"][0]):
        matches.append(
            {
                "product_id": metadata["product_id"],
                "title": metadata["title"],
                "friend_name": metadata["friend_name"],
                "event_type": metadata["event_type"],
                "distance": distance,
                "category": metadata["category"],
            }
        )
    return {
        "voyageEnabled": voyage_enabled(),
        "model": settings.voyage_model,
        "collectionCount": collection.count(),
        "matches": matches,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    db_connected = True
    tables_present = True
    seeded = False
    chroma_connected = True
    embedding_mode = "voyage" if voyage_enabled() else "fallback"

    try:
        fetch_one("SELECT 1")
    except Exception:
        db_connected = False
        tables_present = False

    if db_connected:
        try:
            table_check = fetch_one(
                """
                SELECT COUNT(*) AS count
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('friends', 'products', 'friend_events', 'users')
                """
            )
            tables_present = bool(table_check and table_check["count"] == 4)
            seed_check = fetch_one("SELECT COUNT(*) AS count FROM friends")
            seeded = bool(seed_check and seed_check["count"] > 0)
        except Exception:
            tables_present = False

    try:
        collection = get_collection()
        collection.count()
    except Exception:
        chroma_connected = False

    return {
        "db_connected": db_connected,
        "tables_present": tables_present,
        "seeded": seeded,
        "chroma_connected": chroma_connected,
        "embedding_mode": embedding_mode,
    }


@app.get("/api/recommendations")
def recommendations(
    q: str | None = None,
    category: str | None = None,
    limit: int = Query(12, ge=1, le=50),
) -> dict[str, Any]:
    query = (q or "").strip()

    if query:
        return _semantic_recommendations(query, category, limit)

    return _social_recommendations(category, limit)


def _semantic_recommendations(query: str, category: str | None, limit: int) -> dict[str, Any]:
    collection = get_collection()
    query_embedding = embed_query(query)
    results = collection.query(query_embeddings=[query_embedding], n_results=50)

    provider = "voyage" if voyage_enabled() else "fallback"

    if not results["ids"] or not results["ids"][0]:
        return {"mode": "semantic", "embeddingProvider": provider, "items": []}

    distances = results["distances"][0]
    min_distance = min(distances)
    max_distance = max(distances)

    grouped: dict[int, dict[str, Any]] = {}

    for metadata, distance in zip(results["metadatas"][0], distances):
        product_id = int(metadata["product_id"])
        if category and metadata["category"].lower() != category.lower():
            continue

        entry = grouped.setdefault(
            product_id,
            {
                "product": metadata,
                "matches": [],
                "best_distance": distance,
                "best_event": metadata,
            },
        )
        entry["matches"].append({**metadata, "distance": distance})
        if distance < entry["best_distance"]:
            entry["best_distance"] = distance
            entry["best_event"] = metadata

    scored_items = []
    now = dt.datetime.now(dt.timezone.utc)

    for product_id, payload in grouped.items():
        product_meta = payload["product"]
        best_distance = payload["best_distance"]
        similarity = max(0.0, 1 - best_distance)
        similarity_norm = 1 - _normalize(best_distance, min_distance, max_distance)

        strongest_friend = max(match["friend_strength"] for match in payload["matches"])
        latest_ts = max(dt.datetime.fromisoformat(match["timestamp"]) for match in payload["matches"])
        days_ago = (now - latest_ts).days
        recency_score = max(0.0, 1 - min(days_ago / 30.0, 1))

        event_weight = max(1.0 if match["event_type"] == "purchase" else 0.6 for match in payload["matches"])
        lex_boost = lexical_boost(query, product_meta["title"], product_meta["description"])

        score = (
            0.75 * similarity_norm
            + 0.08 * strongest_friend
            + 0.07 * recency_score
            + 0.05 * event_weight
            + lex_boost
        )

        matches_sorted = sorted(payload["matches"], key=lambda item: item["distance"])[:3]
        best_event = payload["best_event"]

        scored_items.append(
            {
                "id": product_id,
                "title": product_meta["title"],
                "brand": product_meta.get("brand", ""),
                "category": product_meta["category"],
                "price": f"{float(product_meta['price']):.2f}",
                "description": product_meta["description"],
                "friendName": best_event["friend_name"],
                "friendAvatar": best_event["friend_avatar"],
                "eventType": best_event["event_type"],
                "distance": best_distance,
                "similarity": similarity,
                "confidence": _distance_to_confidence(best_distance),
                "score": score,
                "explanation": {
                    "summary": f"Because {best_event['friend_name']} {_event_verb(best_event['event_type'])} {product_meta['title']}",
                    "semanticScore": round(similarity_norm, 3),
                    "friendStrength": round(strongest_friend, 3),
                    "recencyScore": round(recency_score, 3),
                    "eventWeight": event_weight,
                    "lexicalBoost": round(lex_boost, 3),
                    "matches": [
                        {
                            "friendName": match["friend_name"],
                            "eventType": match["event_type"],
                            "distance": match["distance"],
                            "timestamp": match["timestamp"],
                            "productTitle": match["title"],
                        }
                        for match in matches_sorted
                    ],
                },
            }
        )

    scored_items.sort(key=lambda item: item["score"], reverse=True)
    return {"mode": "semantic", "embeddingProvider": provider, "items": scored_items[:limit]}


def _social_recommendations(category: str | None, limit: int) -> dict[str, Any]:
    events = fetch_all(
        """
        SELECT
            friend_events.id,
            friend_events.event_type,
            friend_events.created_at,
            friends.name AS friend_name,
            friends.avatar_url,
            friends.strength,
            products.id AS product_id,
            products.title,
            products.brand,
            products.category,
            products.price,
            products.description
        FROM friend_events
        JOIN friends ON friends.id = friend_events.friend_id
        JOIN products ON products.id = friend_events.product_id
        ORDER BY friend_events.created_at DESC
        LIMIT 200
        """
    )

    grouped: dict[int, dict[str, Any]] = defaultdict(lambda: {"events": []})
    now = dt.datetime.now(dt.timezone.utc)

    for event in events:
        if category and event["category"].lower() != category.lower():
            continue
        grouped[event["product_id"]]["product"] = event
        grouped[event["product_id"]]["events"].append(event)

    scored_items = []

    for product_id, payload in grouped.items():
        product = payload["product"]
        event_list = payload["events"]

        strongest_friend = max(item["strength"] for item in event_list)
        latest_ts = max(item["created_at"] for item in event_list)
        days_ago = (now - latest_ts).days
        recency_score = max(0.0, 1 - min(days_ago / 30.0, 1))
        event_weight = max(1.0 if item["event_type"] == "purchase" else 0.6 for item in event_list)

        score = 0.45 * strongest_friend + 0.35 * recency_score + 0.2 * event_weight
        best_event = event_list[0]
        matches_sorted = sorted(event_list, key=lambda item: item["created_at"], reverse=True)[:3]

        scored_items.append(
            {
                "id": product_id,
                "title": product["title"],
                "brand": product["brand"],
                "category": product["category"],
                "price": f"{float(product['price']):.2f}",
                "description": product["description"],
                "friendName": best_event["friend_name"],
                "friendAvatar": best_event["avatar_url"],
                "eventType": best_event["event_type"],
                "distance": None,
                "similarity": None,
                "confidence": "Social",
                "score": score,
                "explanation": {
                    "summary": f"Because {best_event['friend_name']} {_event_verb(best_event['event_type'])} {product['title']}",
                    "semanticScore": None,
                    "friendStrength": round(strongest_friend, 3),
                    "recencyScore": round(recency_score, 3),
                    "eventWeight": event_weight,
                    "lexicalBoost": 0.0,
                    "matches": [
                        {
                            "friendName": match["friend_name"],
                            "eventType": match["event_type"],
                            "distance": None,
                            "timestamp": match["created_at"].isoformat(),
                            "productTitle": match["title"],
                        }
                        for match in matches_sorted
                    ],
                },
            }
        )

    scored_items.sort(key=lambda item: item["score"], reverse=True)
    return {"mode": "social", "items": scored_items[:limit]}


@app.post("/api/ingest")
def ingest(payload: IngestPayload) -> dict[str, Any]:
    product = fetch_one(
        """
        SELECT products.id, products.title, products.brand, products.description, products.category, products.price,
               friends.name AS friend_name, friends.avatar_url, friends.strength
        FROM products
        JOIN friends ON friends.id = %s
        WHERE products.id = %s
        """,
        (payload.friend_id, payload.product_id),
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product or friend not found")

    event_type = payload.event_type if payload.event_type in {"purchase", "view"} else "purchase"
    execute(
        "INSERT INTO friend_events (friend_id, product_id, event_type, created_at) VALUES (%s, %s, %s, %s)",
        (payload.friend_id, payload.product_id, event_type, dt.datetime.now(dt.timezone.utc)),
    )

    collection = get_collection()
    document = f"{product['title']} {product['description']}"
    embedding = embed_documents([document])[0]

    event_row = fetch_one("SELECT id FROM friend_events ORDER BY id DESC LIMIT 1")
    event_id = str(event_row["id"]) if event_row else None
    if event_id:
        collection.add(
            ids=[event_id],
            embeddings=[embedding],
            metadatas=[
                {
                    "product_id": product["id"],
                    "friend_id": payload.friend_id,
                    "event_type": event_type,
                    "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "category": product["category"],
                    "title": product["title"],
                    "brand": product["brand"],
                    "description": product["description"],
                    "friend_name": product["friend_name"],
                    "friend_avatar": product["avatar_url"],
                    "friend_strength": product["strength"],
                    "price": float(product["price"]),
                }
            ],
            documents=[document],
        )

    return {"status": "ok"}
