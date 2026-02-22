import { NextResponse } from "next/server";
import { db } from "@/db";
import { scoreHistory } from "@/db/schema";
import { max } from "drizzle-orm";

// GET /api/health
// Public endpoint — no auth required (read-only health check)
// Success response shape: { lastBatchAt: string | null, isStale: boolean }
// Error response shape:   { error: string } with HTTP 500
//
// Staleness note: recordedAt is DATE type (day-level granularity, not timestamp).
// AC2 mentions "18 hours" but the implementation uses day comparison:
// isStale = true if lastBatchDate < today (UTC). Acceptable for MVP — batch runs daily at 6 AM UTC.
export async function GET(): Promise<NextResponse> {
  try {
    const result = await db
      .select({ lastBatchAt: max(scoreHistory.recordedAt) })
      .from(scoreHistory);

    // MAX on empty table returns [{ lastBatchAt: null }]; result can also be []
    const lastBatchAt = result[0]?.lastBatchAt ?? null;

    // UTC date string: "YYYY-MM-DD" — must use UTC to align with 6 AM UTC batch schedule
    const todayUtc = new Date().toISOString().slice(0, 10);

    // Stale if no data or last batch date is before today in UTC
    const isStale = lastBatchAt === null || lastBatchAt < todayUtc;

    return NextResponse.json({ lastBatchAt, isStale });
  } catch (err) {
    console.error("[/api/health] DB query failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
