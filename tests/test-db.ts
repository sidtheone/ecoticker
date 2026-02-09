import { newDb, DataType } from "pg-mem";
import fs from "fs";
import path from "path";

/**
 * Creates an in-memory PostgreSQL database using pg-mem
 * with the schema loaded from db/schema.sql.
 * Returns a pg-compatible Pool for use in tests.
 */
export function createTestDb() {
  const db = newDb();

  // Register NOW()
  db.public.registerFunction({
    name: "now",
    args: [],
    returns: DataType.timestamptz,
    implementation: () => new Date(),
  });

  // Register ABS() — pg-mem doesn't include it by default
  db.public.registerFunction({
    name: "abs",
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: (x: number) => Math.abs(x),
  });

  // Register STRING_AGG()
  db.public.registerFunction({
    name: "string_agg",
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (...args: any[]) => args[0],
    allowRecursive: true,
  } as any);

  // Register COALESCE for mixed types
  db.public.registerFunction({
    name: "coalesce",
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (a: any, b: any) => a ?? b,
  });

  // Load schema
  const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8");

  // pg-mem doesn't support CREATE INDEX IF NOT EXISTS, so strip index statements
  const schemaWithoutIndexes = schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("CREATE INDEX"))
    .join("\n");

  db.public.none(schemaWithoutIndexes);

  // Create a backup for fast reset between tests
  const backup = db.backup();

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  return { pool, backup, db };
}
