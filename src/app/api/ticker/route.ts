import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT name, slug, current_score as score,
      (current_score - previous_score) as change
    FROM topics
    ORDER BY current_score DESC
    LIMIT 15
  `).all() as { name: string; slug: string; score: number; change: number }[];

  return NextResponse.json({ items: rows });
}
