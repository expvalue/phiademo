import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await query<{
    id: number;
    name: string;
    avatar_url: string;
    strength: number;
  }>(
    "SELECT id, name, avatar_url, strength FROM friends ORDER BY strength DESC"
  );

  return NextResponse.json({
    friends: rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar_url,
      strength: row.strength
    }))
  });
}
