import { NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { desc, sql, ne } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        name: topics.name,
        slug: topics.slug,
        currentScore: topics.currentScore,
        previousScore: topics.previousScore,
        change: sql<number>`${topics.currentScore} - ${topics.previousScore}`,
        urgency: topics.urgency,
      })
      .from(topics)
      .where(ne(topics.currentScore, topics.previousScore))
      .orderBy(desc(sql`ABS(${topics.currentScore} - ${topics.previousScore})`))
      .limit(5);

    return NextResponse.json(
      { movers: rows },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching movers:", error);
    return NextResponse.json(
      { error: "Failed to fetch movers" },
      { status: 500 }
    );
  }
}
