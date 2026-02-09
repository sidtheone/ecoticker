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
  await seedTopics();
});

afterAll(async () => {
  await pool.end();
});

async function seedTopics() {
  const insert = `
    INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, article_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  await pool.query(insert, ["Arctic Ice Decline", "arctic-ice-decline", "climate", "Arctic", 85, 79, "breaking", "Sea ice at record lows", 5]);
  await pool.query(insert, ["Delhi Air Quality", "delhi-air-quality", "air_quality", "South Asia", 91, 88, "breaking", "AQI hazardous", 8]);
  await pool.query(insert, ["Ganges Cleanup", "ganges-cleanup", "water", "South Asia", 45, 52, "moderate", "Cleanup progress", 3]);
  await pool.query(insert, ["Renewable Growth", "renewable-growth", "energy", "Global", 22, 28, "informational", "Solar up 15%", 2]);
}

async function queryTopics(urgency?: string, category?: string) {
  let query = `
    SELECT id, name, slug, category, region,
      current_score, previous_score,
      (current_score - previous_score) as change,
      urgency, impact_summary, image_url, article_count, updated_at
    FROM topics
  `;
  const conditions: string[] = [];
  const params: string[] = [];
  let pi = 1;
  if (urgency) { conditions.push(`urgency = $${pi++}`); params.push(urgency); }
  if (category) { conditions.push(`category = $${pi++}`); params.push(category); }
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY current_score DESC";
  const { rows } = await pool.query(query, params);
  return rows;
}

describe("GET /api/topics — query logic", () => {
  test("returns all topics sorted by score descending", async () => {
    const rows = await queryTopics();
    expect(rows).toHaveLength(4);
    expect(rows[0].name).toBe("Delhi Air Quality");
    expect(rows[1].name).toBe("Arctic Ice Decline");
    expect(rows[3].name).toBe("Renewable Growth");
  });

  test("computes change correctly", async () => {
    const rows = await queryTopics();
    const arctic = rows.find((r: any) => r.slug === "arctic-ice-decline");
    expect(arctic!.change).toBe(6);
    const ganges = rows.find((r: any) => r.slug === "ganges-cleanup");
    expect(ganges!.change).toBe(-7);
  });

  test("filters by urgency", async () => {
    const rows = await queryTopics("breaking");
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.urgency === "breaking")).toBe(true);
  });

  test("filters by category", async () => {
    const rows = await queryTopics(undefined, "water");
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("ganges-cleanup");
  });

  test("filters by both urgency and category", async () => {
    const rows = await queryTopics("breaking", "air_quality");
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("delhi-air-quality");
  });

  test("returns empty array for no matches", async () => {
    const rows = await queryTopics("breaking", "waste");
    expect(rows).toHaveLength(0);
  });

  test("sparkline query returns last 7 scores in chronological order", async () => {
    const { rows: [{ id: topicId }] } = await pool.query("SELECT id FROM topics WHERE slug = 'arctic-ice-decline'");
    for (let i = 0; i < 10; i++) {
      await pool.query(
        "INSERT INTO score_history (topic_id, score, recorded_at) VALUES ($1, $2, $3)",
        [topicId, 60 + i, `2026-01-${String(i + 1).padStart(2, "0")}`]
      );
    }
    const { rows: history } = await pool.query(
      "SELECT score FROM score_history WHERE topic_id = $1 ORDER BY recorded_at DESC LIMIT 7",
      [topicId]
    );
    const sparkline = history.map((h: any) => h.score).reverse();
    expect(sparkline).toEqual([63, 64, 65, 66, 67, 68, 69]);
    expect(sparkline).toHaveLength(7);
  });
});
