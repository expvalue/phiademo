import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [counts] = await query<{
    products: number;
    friends: number;
    events: number;
    embeddings: number;
  }>(
    `
    SELECT
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM friends) AS friends,
      (SELECT COUNT(*) FROM friend_events) AS events,
      (SELECT COUNT(*) FROM product_embeddings) AS embeddings
    `
  );

  return NextResponse.json({
    counts,
    embeddingStatus: counts.embeddings === counts.products ? "ready" : "pending"
  });
}
