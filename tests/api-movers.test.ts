import { Pool } from "pg";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://ecoticker:ecoticker@localhost:5432/ecoticker_test";

let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8");
  await pool.query(schema);
});

beforeEach(async () => {
  await pool.query("DELETE FROM topic_keywords");
  await pool.query("DELETE FROM score_history");
  await pool.query("DELETE FROM articles");
  await pool.query("DELETE FROM topics");
});

afterAll(async () => {
  await pool.end();
});

async function queryMovers() {
  const { rows } = await pool.query(`
    SELECT name, slug, current_score, previous_score,
      (current_score - previous_score) as change,
      urgency
    FROM topics
    WHERE current_score != previous_score
    ORDER BY ABS(current_score - previous_score) DESC
    LIMIT 5
  `);
  return rows;
}

describe("GET /api/movers — query logic", () => {
  test("returns top 5 movers sorted by absolute change", async () => {
    const insert = "INSERT INTO topics (name, slug, current_score, previous_score, urgency) VALUES ($1, $2, $3, $4, $5)";
    await pool.query(insert, ["Big Up", "big-up", 90, 50, "breaking"]);
    await pool.query(insert, ["Big Down", "big-down", 30, 65, "moderate"]);
    await pool.query(insert, ["Medium", "medium", 70, 55, "critical"]);
    await pool.query(insert, ["Small", "small", 50, 45, "moderate"]);
    await pool.query(insert, ["Tiny", "tiny", 20, 18, "informational"]);
    await pool.query(insert, ["Also Big", "also-big", 80, 55, "breaking"]);
    await pool.query(insert, ["Stable", "stable", 60, 60, "moderate"]);

    const rows = await queryMovers();
    expect(rows).toHaveLength(5);
    expect(rows[0].name).toBe("Big Up");
    expect(rows[1].name).toBe("Big Down");
    expect(rows[2].name).toBe("Also Big");
    expect(rows[3].name).toBe("Medium");
    expect(rows[4].name).toBe("Small");
  });

  test("excludes topics with zero change", async () => {
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Stable", "stable", 50, 50]);
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Moving", "moving", 70, 55]);

    const rows = await queryMovers();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Moving");
  });

  test("includes both positive and negative movers", async () => {
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Worsening", "worse", 80, 60]);
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Improving", "better", 30, 55]);

    const rows = await queryMovers();
    expect(rows).toHaveLength(2);
    const changes = rows.map((r: any) => r.change as number);
    expect(changes.some((c) => c > 0)).toBe(true);
    expect(changes.some((c) => c < 0)).toBe(true);
  });

  test("returns empty array when all topics are stable", async () => {
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Stable", "stable", 50, 50]);
    const rows = await queryMovers();
    expect(rows).toEqual([]);
  });

  test("returns fewer than 5 if fewer movers exist", async () => {
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Only", "only", 60, 40]);
    const rows = await queryMovers();
    expect(rows).toHaveLength(1);
  });
});
