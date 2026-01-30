import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cosineSimilarity, deterministicEmbedding, embedText, formatVector } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;

function computeKeywordMatches(queryText: string, description: string, title: string) {
  if (!queryText) return [];
  const tokens = queryText
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (!tokens.length) return [];
  const descriptionTokens = new Set(
    `${title} ${description}`
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
  );
  return tokens.filter((token) => descriptionTokens.has(token));
}

function tokenizeQuery(queryText: string) {
  return queryText
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

function lexicalBoost(queryText: string, title: string, description: string) {
  if (!queryText) return 0;
  const tokens = tokenizeQuery(queryText);
  if (!tokens.length) return 0;
  const haystack = `${title} ${description}`.toLowerCase();
  if (haystack.includes(queryText.toLowerCase())) return 1;
  const matched = tokens.some((token) => haystack.includes(token));
  return matched ? 0.6 : 0;
}

function diversifyResults(items: Recommendation[]) {
  const seenCategories = new Set<string>();
  const seenBrands = new Set<string>();
  const diversified: Recommendation[] = [];

  for (const item of items) {
    const categoryKey = item.category.toLowerCase();
    const brandKey = item.brand.toLowerCase();
    const hasCategory = seenCategories.has(categoryKey);
    const hasBrand = seenBrands.has(brandKey);

    if (!hasCategory || !hasBrand || diversified.length < 6) {
      diversified.push(item);
      seenCategories.add(categoryKey);
      seenBrands.add(brandKey);
    }
  }

  if (diversified.length < items.length) {
    for (const item of items) {
      if (diversified.length >= items.length) break;
      if (!diversified.find((existing) => existing.id === item.id)) {
        diversified.push(item);
      }
    }
  }

  return diversified;
}

type Recommendation = {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: string;
  description: string;
  friendName: string;
  friendAvatar: string;
  eventType: "purchase" | "view";
  similarity: number | null;
  friendStrength: number;
  recency: number;
  eventWeight: number;
  score: number;
  reason: string;
  keywords: string[];
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryText = searchParams.get("q")?.trim() ?? "";
  const limit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const category = searchParams.get("category")?.trim() ?? "";

  if (queryText) {
    const openAiEnabled = Boolean(process.env.OPENAI_API_KEY);
    const [{ count: embeddingsCount = 0 } = { count: 0 }] = await query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM product_embeddings"
    );
    const semanticMode = openAiEnabled && embeddingsCount > 0 ? "openai" : "fallback";

    if (semanticMode === "fallback") {
      console.warn("Semantic mode disabled; using deterministic similarity fallback.");
      const fallbackRows = await query<{
        id: number;
        name: string;
        brand: string;
        category: string;
        price: string;
        description: string;
        friend_name: string;
        friend_avatar: string;
        event_type: "purchase" | "view";
        friend_strength: number;
        event_ts: string;
      }>(
        `
        SELECT
          p.id,
          p.name,
          p.brand,
          p.category,
          p.price::text,
          p.description,
          f.name AS friend_name,
          f.avatar_url AS friend_avatar,
          fe.event_type,
          f.strength AS friend_strength,
          fe.event_ts
        FROM friend_events fe
        JOIN friends f ON f.id = fe.friend_id
        JOIN products p ON p.id = fe.product_id
        ${category ? "WHERE p.category = $1" : ""}
        `,
        category ? [category] : []
      );

      const queryEmbedding = deterministicEmbedding(queryText);
      const now = Date.now();
      const byProduct = new Map<number, Recommendation>();

      for (const row of fallbackRows) {
        const productEmbedding = deterministicEmbedding(
          `${row.name}. ${row.brand}. ${row.category}. ${row.description}`
        );
        const similarity = cosineSimilarity(queryEmbedding, productEmbedding);
        const recency =
          1 /
          (1 + (now - new Date(row.event_ts).getTime()) / 1000 / 86400);
        const eventWeight = row.event_type === "purchase" ? 1 : 0.6;
        const existing = byProduct.get(row.id);

        const candidate: Recommendation = {
          id: row.id,
          name: row.name,
          brand: row.brand,
          category: row.category,
          price: row.price,
          description: row.description,
          friendName: row.friend_name,
          friendAvatar: row.friend_avatar,
          eventType: row.event_type,
          similarity,
          friendStrength: row.friend_strength,
          recency,
          eventWeight,
          score: 0,
          reason: `Because ${row.friend_name} ${row.event_type === "purchase" ? "bought" : "viewed"} ${row.name}`,
          keywords: computeKeywordMatches(queryText, row.description, row.name)
        };

        if (!existing || similarity > (existing.similarity ?? 0)) {
          byProduct.set(row.id, candidate);
        }
      }

      const candidates = Array.from(byProduct.values());
      const similarities = candidates.map((item) => item.similarity ?? 0);
      const minSim = similarities.length ? Math.min(...similarities) : 0;
      const maxSim = similarities.length ? Math.max(...similarities) : 0;
      const scored = candidates.map((item) => {
        const similarityNorm = maxSim === minSim ? 1 : ((item.similarity ?? 0) - minSim) / (maxSim - minSim);
        const boost = lexicalBoost(queryText, item.name, item.description);
        const score = 0.75 * similarityNorm + 0.1 * item.friendStrength + 0.1 * item.recency + 0.05 * boost;
        return { ...item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return NextResponse.json({
        query: queryText,
        mode: semanticMode,
        items: diversifyResults(scored).slice(0, limit)
      });
    }

    const embedding = await embedText(queryText);
    const vectorLiteral = formatVector(embedding);

    const topK = Math.max(limit * 6, 40);
    const rows = await query<{
      id: number;
      name: string;
      brand: string;
      category: string;
      price: string;
      description: string;
      friend_name: string;
      friend_avatar: string;
      event_type: "purchase" | "view";
      friend_strength: number;
      recency: number;
      similarity: number;
      lexical_boost: number;
      event_weight: number;
      score: number;
    }>(
      `
      WITH base AS (
        SELECT
          p.id,
          p.name,
          p.brand,
          p.category,
          p.price::text,
          p.description,
          f.name AS friend_name,
          f.avatar_url AS friend_avatar,
          fe.event_type,
          f.strength AS friend_strength,
          CASE WHEN fe.event_type = 'purchase' THEN 1.0 ELSE 0.6 END AS event_weight,
          1 / (1 + EXTRACT(EPOCH FROM (NOW() - fe.event_ts)) / 86400) AS recency,
          1 - (pe.embedding <=> $1::vector) AS similarity,
          CASE
            WHEN p.name ILIKE '%' || $2 || '%' THEN 1.0
            WHEN p.description ILIKE '%' || $2 || '%' THEN 0.6
            ELSE 0.0
          END AS lexical_boost
        FROM friend_events fe
        JOIN friends f ON f.id = fe.friend_id
        JOIN products p ON p.id = fe.product_id
        JOIN product_embeddings pe ON pe.product_id = p.id
        ${category ? "WHERE p.category = $4" : ""}
      ),
      top_similar AS (
        SELECT *
        FROM base
        ORDER BY similarity DESC
        LIMIT $3
      ),
      scored AS (
        SELECT *,
          CASE
            WHEN MAX(similarity) OVER () = MIN(similarity) OVER () THEN 1
            ELSE (similarity - MIN(similarity) OVER ()) / NULLIF(MAX(similarity) OVER () - MIN(similarity) OVER (), 0)
          END AS similarity_norm
        FROM top_similar
      ),
      weighted AS (
        SELECT *,
          (
            0.75 * similarity_norm +
            0.1 * friend_strength +
            0.1 * recency +
            0.05 * lexical_boost
          ) AS score
        FROM scored
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY score DESC) AS rn
        FROM weighted
      )
      SELECT * FROM ranked
      WHERE rn = 1
      ORDER BY score DESC
      LIMIT $2
      `,
      category ? [vectorLiteral, queryText, topK, limit, category] : [vectorLiteral, queryText, topK, limit]
    );

    const mapped = rows.map((row) => {
      const keywords = computeKeywordMatches(queryText, row.description, row.name);
      return {
        id: row.id,
        name: row.name,
        brand: row.brand,
        category: row.category,
        price: row.price,
        description: row.description,
        friendName: row.friend_name,
        friendAvatar: row.friend_avatar,
        eventType: row.event_type,
        similarity: row.similarity,
        friendStrength: row.friend_strength,
        recency: row.recency,
        eventWeight: row.event_weight,
        score: row.score,
        reason: `Because ${row.friend_name} ${row.event_type === "purchase" ? "bought" : "viewed"} ${row.name}`,
        keywords
      } satisfies Recommendation;
    });

    return NextResponse.json({
      query: queryText,
      mode: semanticMode,
      items: diversifyResults(mapped).slice(0, limit)
    });
  }

  const rows = await query<{
    id: number;
    name: string;
    brand: string;
    category: string;
    price: string;
    description: string;
    friend_name: string;
    friend_avatar: string;
    event_type: "purchase" | "view";
    friend_strength: number;
    recency: number;
    event_weight: number;
    score: number;
  }>(
    `
    WITH base AS (
      SELECT
        p.id,
        p.name,
        p.brand,
        p.category,
        p.price::text,
        p.description,
        f.name AS friend_name,
        f.avatar_url AS friend_avatar,
        fe.event_type,
        f.strength AS friend_strength,
        CASE WHEN fe.event_type = 'purchase' THEN 1.0 ELSE 0.6 END AS event_weight,
        1 / (1 + EXTRACT(EPOCH FROM (NOW() - fe.event_ts)) / 86400) AS recency
      FROM friend_events fe
      JOIN friends f ON f.id = fe.friend_id
      JOIN products p ON p.id = fe.product_id
      ${category ? "WHERE p.category = $2" : ""}
    ),
    scored AS (
      SELECT *,
        (0.5 * friend_strength + 0.3 * recency + 0.2 * event_weight) AS score
      FROM base
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY id ORDER BY score DESC) AS rn
      FROM scored
    )
    SELECT * FROM ranked
    WHERE rn = 1
    ORDER BY score DESC
    LIMIT $1
    `,
    category ? [limit, category] : [limit]
  );

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: row.price,
    description: row.description,
    friendName: row.friend_name,
    friendAvatar: row.friend_avatar,
    eventType: row.event_type,
    similarity: null,
    friendStrength: row.friend_strength,
    recency: row.recency,
    eventWeight: row.event_weight,
    score: row.score,
    reason: `Because ${row.friend_name} ${row.event_type === "purchase" ? "bought" : "viewed"} ${row.name}`,
    keywords: []
  } satisfies Recommendation));

  return NextResponse.json({
    query: "",
    mode: "social",
    items: diversifyResults(mapped).slice(0, limit)
  });
}
