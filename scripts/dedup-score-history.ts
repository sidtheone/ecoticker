import { db, pool } from "../src/db";
import { scoreHistory } from "../src/db/schema";
import { sql, and, eq, ne } from "drizzle-orm";

export async function dedupScoreHistory(
  db: any,
  dryRun: boolean
): Promise<{ topicsAffected: number; rowsDeleted: number }> {
  // Find all (topic_id, recorded_at) groups, filter to those with more than one row
  const allGroups: any[] = await db
    .select({
      topicId: scoreHistory.topicId,
      recordedAt: scoreHistory.recordedAt,
      count: sql<number>`count(*)`,
      maxId: sql<number>`max(${scoreHistory.id})`,
    })
    .from(scoreHistory)
    .groupBy(scoreHistory.topicId, scoreHistory.recordedAt)
    .limit(Number.MAX_SAFE_INTEGER);

  const duplicateGroups = allGroups.filter((g) => Number(g.count) > 1);

  const topicsAffected = duplicateGroups.length;
  const rowsDeleted = duplicateGroups.reduce(
    (sum: number, g: any) => sum + (Number(g.count) - 1),
    0
  );

  if (dryRun) {
    return { topicsAffected, rowsDeleted };
  }

  for (const group of duplicateGroups) {
    await db
      .delete(scoreHistory)
      .where(
        and(
          eq(scoreHistory.topicId, group.topicId),
          eq(scoreHistory.recordedAt, group.recordedAt),
          ne(scoreHistory.id, group.maxId)
        )
      );
  }

  return { topicsAffected, rowsDeleted };
}

// CLI entry point
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  dedupScoreHistory(db, dryRun)
    .then(({ topicsAffected, rowsDeleted }) => {
      if (dryRun) {
        console.log(
          `[dry-run] Would delete ${rowsDeleted} duplicate rows across ${topicsAffected} topic/date groups`
        );
      } else {
        console.log(
          `Deleted ${rowsDeleted} duplicate rows across ${topicsAffected} topic/date groups`
        );
      }
    })
    .catch((err) => {
      console.error("dedup-score-history failed:", err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
