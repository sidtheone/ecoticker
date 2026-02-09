import { Pool } from "pg";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://ecoticker:ecoticker@localhost:5432/ecoticker";

let pool: Pool | null = null;
let initialized = false;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
    console.log(`PostgreSQL pool created for: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);
  }
  return pool;
}

export async function initDb(): Promise<void> {
  if (initialized) return;

  const p = getDb();
  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    await p.query(schema);
  }

  initialized = true;
  console.log("Database schema initialized");
}

/**
 * Build a parameterized IN clause for PostgreSQL.
 * Returns { placeholders: "$1,$2,$3", params: [...values] } with offset support.
 */
export function buildInClause(values: (string | number)[], startIndex: number = 1): { placeholders: string; params: (string | number)[] } {
  const placeholders = values.map((_, i) => `$${startIndex + i}`).join(",");
  return { placeholders, params: values };
}

/**
 * Cascade-delete topics and all related data (keywords, scores, articles).
 * Returns the number of topics deleted.
 */
export async function cascadeDeleteTopics(topicIds: number[]): Promise<number> {
  if (topicIds.length === 0) return 0;
  const p = getDb();
  const { placeholders } = buildInClause(topicIds);
  await p.query(`DELETE FROM topic_keywords WHERE topic_id IN (${placeholders})`, topicIds);
  await p.query(`DELETE FROM score_history WHERE topic_id IN (${placeholders})`, topicIds);
  await p.query(`DELETE FROM articles WHERE topic_id IN (${placeholders})`, topicIds);
  const result = await p.query(`DELETE FROM topics WHERE id IN (${placeholders})`, topicIds);
  return result.rowCount ?? 0;
}
