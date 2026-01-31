from __future__ import annotations

import datetime as dt
import random

from .db import execute, fetch_all, fetch_one
from .embeddings import embed_documents
from .vector_store import get_collection


FRIENDS = [
    "Ava Patel",
    "Liam Ortega",
    "Maya Chen",
    "Sofia Rossi",
    "Jordan Blake",
    "Noah Park",
    "Amelia Brooks",
    "Ethan Rivera",
    "Harper Lee",
    "Lucas Kim",
    "Isla Morgan",
    "Mateo Silva",
    "Aria Bennett",
    "Henry Walker",
    "Zoe Foster",
    "Oliver Quinn",
    "Ella Hughes",
    "Leo Singh",
    "Camila Torres",
    "Caleb Nguyen",
]


CORE_PRODUCTS = [
    {
        "title": "Eden Skin Serum",
        "brand": "Velvet Labs",
        "category": "Beauty",
        "price": 62.0,
        "description": "Hydrating serum with peptides, niacinamide, and ceramides for a luminous glow.",
    },
    {
        "title": "Lumen Smart Desk Lamp",
        "brand": "Lumen",
        "category": "Home",
        "price": 89.0,
        "description": "Adaptive desk lamp with circadian presets, wireless charging, and matte brass finish.",
    },
    {
        "title": "Nimbus Noise-Canceling Headphones",
        "brand": "Aurora Audio",
        "category": "Electronics",
        "price": 249.0,
        "description": "Immersive over-ear headphones with adaptive ANC and 36-hour battery life.",
    },
    {
        "title": "Atlas Carry-On",
        "brand": "Atlas Travel",
        "category": "Travel",
        "price": 215.0,
        "description": "Expandable carry-on with silent glide wheels, hard shell, and smart packing cubes.",
    },
]


PRODUCT_CATEGORIES = {
    "Beauty": ["serum", "cleanser", "mask", "body oil", "toner", "lip balm"],
    "Home": ["lamp", "throw", "diffuser", "desk organizer", "air purifier", "coffee maker"],
    "Electronics": ["headphones", "smartwatch", "speaker", "camera", "tablet", "earbuds"],
    "Travel": ["carry-on", "weekender", "packing cubes", "neck pillow", "travel kit"],
    "Fitness": ["yoga mat", "resistance set", "water bottle", "foam roller", "training shoes"],
    "Fashion": ["sneakers", "jacket", "tote bag", "denim", "sweater", "scarf"],
}

BRANDS = [
    "Luna & Co",
    "Brightline",
    "Everlane Studio",
    "Verve",
    "Northwind",
    "Solace",
    "Citrine",
    "Aster",
    "Marina",
    "Studio 8",
    "Viva",
    "Oasis",
]


def _random_description(category: str, item: str) -> str:
    phrases = [
        f"Designed for modern routines with premium materials and thoughtful details.",
        f"Soft-touch finish and lightweight profile keep it easy to use every day.",
        f"Built to feel luxurious with clean lines and a calming aesthetic.",
        f"Pairs effortless style with practical functionality for daily life.",
    ]
    return f"A {item} tailored for {category.lower()} lovers. {random.choice(phrases)}"


def seed_database() -> None:
    random.seed(42)
    existing_friends = fetch_all("SELECT id FROM friends LIMIT 1")
    if existing_friends:
        print("Seed data already present. Skipping seeding.")
        return

    execute("INSERT INTO users (name) VALUES (%s)", ("You",))

    for idx, name in enumerate(FRIENDS, start=1):
        avatar = f"https://i.pravatar.cc/100?img={idx}"
        strength = round(random.uniform(0.45, 0.98), 2)
        execute(
            "INSERT INTO friends (name, avatar_url, strength) VALUES (%s, %s, %s)",
            (name, avatar, strength),
        )

    products = list(CORE_PRODUCTS)
    while len(products) < 200:
        category = random.choice(list(PRODUCT_CATEGORIES.keys()))
        item = random.choice(PRODUCT_CATEGORIES[category])
        title = f"{random.choice(['Aura', 'Pulse', 'Nova', 'Echo', 'Glow', 'Summit'])} {item.title()}"
        brand = random.choice(BRANDS)
        price = round(random.uniform(28, 320), 2)
        products.append(
            {
                "title": title,
                "brand": brand,
                "category": category,
                "price": price,
                "description": _random_description(category, item),
            }
        )

    for product in products:
        execute(
            "INSERT INTO products (title, brand, category, price, description) VALUES (%s, %s, %s, %s, %s)",
            (
                product["title"],
                product["brand"],
                product["category"],
                product["price"],
                product["description"],
            ),
        )

    friend_ids = [row["id"] for row in fetch_all("SELECT id FROM friends")]
    product_ids = [row["id"] for row in fetch_all("SELECT id FROM products")]
    now = dt.datetime.now(dt.timezone.utc)

    for friend_id in friend_ids:
        purchases = random.sample(product_ids, k=random.randint(10, 25))
        views = random.sample(product_ids, k=random.randint(15, 40))
        for product_id in purchases:
            timestamp = now - dt.timedelta(days=random.randint(0, 40))
            execute(
                "INSERT INTO friend_events (friend_id, product_id, event_type, created_at) VALUES (%s, %s, %s, %s)",
                (friend_id, product_id, "purchase", timestamp),
            )
        for product_id in views:
            timestamp = now - dt.timedelta(days=random.randint(0, 40))
            execute(
                "INSERT INTO friend_events (friend_id, product_id, event_type, created_at) VALUES (%s, %s, %s, %s)",
                (friend_id, product_id, "view", timestamp),
            )


def rebuild_vector_store() -> None:
    events = fetch_all(
        """
        SELECT
            friend_events.id AS event_id,
            friend_events.friend_id,
            friend_events.product_id,
            friend_events.event_type,
            friend_events.created_at,
            friends.name AS friend_name,
            friends.avatar_url,
            friends.strength,
            products.title,
            products.brand,
            products.category,
            products.price,
            products.description
        FROM friend_events
        JOIN friends ON friends.id = friend_events.friend_id
        JOIN products ON products.id = friend_events.product_id
        """
    )
    if not events:
        return

    collection = get_collection()
    collection.delete(where={})

    documents = [f"{row['title']} {row['description']}" for row in events]
    embeddings = embed_documents(documents)

    metadata = [
        {
            "product_id": row["product_id"],
            "friend_id": row["friend_id"],
            "event_type": row["event_type"],
            "timestamp": row["created_at"].isoformat(),
            "category": row["category"],
            "title": row["title"],
            "brand": row["brand"],
            "description": row["description"],
            "friend_name": row["friend_name"],
            "friend_avatar": row["avatar_url"],
            "friend_strength": row["strength"],
            "price": float(row["price"]),
        }
        for row in events
    ]

    ids = [str(row["event_id"]) for row in events]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        metadatas=metadata,
        documents=documents,
    )


def ensure_seeded() -> None:
    row = fetch_one("SELECT COUNT(*) AS count FROM friends")
    if row and row["count"] == 0:
        seed_database()
        rebuild_vector_store()
        print("Seeded DB and populated Chroma.")


def ensure_vector_ready() -> None:
    collection = get_collection()
    if collection.count() == 0:
        rebuild_vector_store()
        print("Chroma was empty. Rebuilt vectors.")
