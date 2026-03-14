import { db, pool } from "../src/db";
import { topics, articles } from "../src/db/schema";
import { sql, eq } from "drizzle-orm";

export interface ArticleCountMismatch {
  topicId: number;
  topicName: string;
  storedCount: number;
  actualCount: number;
}

export interface FixArticleCountsResult {
  topicsFixed: number;
  mismatches: ArticleCountMismatch[];
}

export async function fixArticleCounts(
  db: any,
  dryRun: boolean
): Promise<FixArticleCountsResult> {
  // Query 1: actual article counts per topic
  const articleCounts: { topicId: number; actualCount: number }[] = await db
    .select({
      topicId: articles.topicId,
      actualCount: sql<number>`count(*)`,
    })
    .from(articles)
    .groupBy(articles.topicId);

  // Query 2: stored article_count per topic
  const topicRows: { id: number; name: string; articleCount: number }[] = await db
    .select({
      id: topics.id,
      name: topics.name,
      articleCount: topics.articleCount,
    })
    .from(topics);

  // Build map: topicId → actual count
  const actualCountMap = new Map<number, number>();
  for (const row of articleCounts) {
    actualCountMap.set(row.topicId, row.actualCount);
  }

  // Find mismatches
  const mismatches: ArticleCountMismatch[] = [];
  for (const topic of topicRows) {
    const actual = actualCountMap.get(topic.id) ?? 0;
    if (topic.articleCount !== actual) {
      mismatches.push({
        topicId: topic.id,
        topicName: topic.name,
        storedCount: topic.articleCount,
        actualCount: actual,
      });
    }
  }

  // Apply fixes unless dry-run
  if (!dryRun) {
    for (const mismatch of mismatches) {
      await db
        .update(topics)
        .set({ articleCount: mismatch.actualCount })
        .where(eq(topics.id, mismatch.topicId));
    }
  }

  return { topicsFixed: mismatches.length, mismatches };
}

// CLI entry point
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  fixArticleCounts(db, dryRun)
    .then(({ topicsFixed, mismatches }) => {
      if (dryRun) {
        console.log(
          `[dry-run] Would fix ${topicsFixed} topic(s) with mismatched article counts`
        );
      } else {
        console.log(
          `Fixed ${topicsFixed} topic(s) with mismatched article counts`
        );
      }
      for (const m of mismatches) {
        console.log(
          `  ${m.topicName} (id=${m.topicId}): stored=${m.storedCount}, actual=${m.actualCount}`
        );
      }
    })
    .catch((err) => {
      console.error("fix-article-counts failed:", err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
