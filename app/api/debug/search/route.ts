import { NextRequest, NextResponse } from "next/server";
import { cosineSimilarity, deterministicEmbedding, embedText, formatVector } from "@/lib/embeddings";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryText = searchParams.get("q")?.trim() ?? "";
  if (!queryText) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const openAiEnabled = Boolean(process.env.OPENAI_API_KEY);
  const [{ count: embeddingsCount = 0 } = { count: 0 }] = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM product_embeddings"
  );
  const semanticMode = openAiEnabled && embeddingsCount > 0 ? "openai" : "fallback";

  if (semanticMode === "fallback") {
    console.warn("Semantic mode disabled; using deterministic similarity fallback.");
    const rows = await query<{
      id: number;
      name: string;
      brand: string;
      category: string;
      description: string;
    }>(
      `
      SELECT DISTINCT
        p.id,
        p.name,
        p.brand,
        p.category,
        p.description
      FROM friend_events fe
      JOIN products p ON p.id = fe.product_id
      `
    );

    const queryEmbedding = deterministicEmbedding(queryText);
    const matches = rows
      .map((row) => {
        const productEmbedding = deterministicEmbedding(
          `${row.name}. ${row.brand}. ${row.category}. ${row.description}`
        );
        return {
          id: row.id,
          name: row.name,
          similarity: cosineSimilarity(queryEmbedding, productEmbedding)
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    return NextResponse.json({
      query: queryText,
      openAiEnabled,
      embeddingsCount,
      mode: semanticMode,
      matches
    });
  }

  const embedding = await embedText(queryText);
  const vectorLiteral = formatVector(embedding);
  const rows = await query<{
    id: number;
    name: string;
    similarity: number;
  }>(
    `
    SELECT
      p.id,
      p.name,
      1 - (pe.embedding <=> $1::vector) AS similarity
    FROM friend_events fe
    JOIN products p ON p.id = fe.product_id
    JOIN product_embeddings pe ON pe.product_id = p.id
    GROUP BY p.id, p.name, pe.embedding
    ORDER BY similarity DESC
    LIMIT 5
    `,
    [vectorLiteral]
  );

  return NextResponse.json({
    query: queryText,
    openAiEnabled,
    embeddingsCount,
    mode: semanticMode,
    matches: rows
  });
}
