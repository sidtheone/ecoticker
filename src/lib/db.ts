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
