import "dotenv/config"; // Load .env for standalone script
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { runBatchPipeline, type BatchMode } from "../src/lib/batch-pipeline";

// ─────────────────────────────────────────────────────────────────
// DB SETUP
// ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─────────────────────────────────────────────────────────────────
// CLI ARG PARSING
// ─────────────────────────────────────────────────────────────────

function parseArgs(): { mode: BatchMode; from?: Date; to?: Date; days?: number } {
  const args = process.argv.slice(2);
  let mode: BatchMode = "daily";
  let from: Date | undefined;
  let to: Date | undefined;
  let days: number | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--mode":
        mode = args[++i] as BatchMode;
        if (!["daily", "backfill-full", "backfill-rescore"].includes(mode)) {
          console.error(`Invalid mode: ${mode}. Use: daily, backfill-full, backfill-rescore`);
          process.exit(1);
        }
        break;
      case "--from":
        from = new Date(args[++i]);
        break;
      case "--to":
        to = new Date(args[++i]);
        break;
      case "--days":
        days = parseInt(args[++i], 10);
        break;
    }
  }

  // --days convenience: compute from/to
  if (days && !from) {
    to = to || new Date();
    from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return { mode, from, to, days };
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────

async function main() {
  const { mode, from, to, days } = parseArgs();
  const result = await runBatchPipeline({ mode, db, from, to, days });

  console.log("\n=== Pipeline Result ===");
  console.log(JSON.stringify(result, null, 2));

  await pool.end();
}

export { main };

// Only execute when run directly as a script (not when imported in tests)
if (require.main === module) {
  main().catch((err) => {
    console.error("Batch pipeline failed:", err);
    process.exit(1);
  });
}
