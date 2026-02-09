import { createTestDb } from "./test-db";

let pool: any;
let backup: any;

beforeAll(() => {
  const testDb = createTestDb();
  pool = testDb.pool;
  backup = testDb.backup;
});

beforeEach(() => {
  backup.restore();
});

async function queryTicker() {
  const { rows } = await pool.query(`
    SELECT name, slug, current_score as score,
      (current_score - previous_score) as change
    FROM topics
    ORDER BY current_score DESC
    LIMIT 15
  `);
  return rows as { name: string; slug: string; score: number; change: number }[];
}

describe("GET /api/ticker — query logic", () => {
  test("returns top 15 topics by score", async () => {
    for (let i = 0; i < 20; i++) {
      await pool.query(
        "INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)",
        [`Topic ${i}`, `topic-${i}`, 100 - i, 90 - i]
      );
    }

    const items = await queryTicker();
    expect(items).toHaveLength(15);
    expect(items[0].score).toBe(100);
    expect(items[14].score).toBe(86);
  });

  test("returns lightweight payload (only name, slug, score, change)", async () => {
    await pool.query(
      "INSERT INTO topics (name, slug, current_score, previous_score, urgency, category, impact_summary) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["Test", "test", 80, 70, "critical", "climate", "Some long summary"]
    );

    const items = await queryTicker();
    expect(items).toHaveLength(1);
    const keys = Object.keys(items[0]);
    expect(keys).toEqual(["name", "slug", "score", "change"]);
  });

  test("computes change correctly", async () => {
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Up", "up", 80, 65]);
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Down", "down", 40, 55]);

    const items = await queryTicker();
    expect(items[0].change).toBe(15);
    expect(items[1].change).toBe(-15);
  });

  test("returns empty array when no topics", async () => {
    const items = await queryTicker();
    expect(items).toEqual([]);
  });

  test("returns fewer than 15 if less topics exist", async () => {
    await pool.query("INSERT INTO topics (name, slug, current_score, previous_score) VALUES ($1, $2, $3, $4)", ["Only", "only", 50, 50]);
    const items = await queryTicker();
    expect(items).toHaveLength(1);
  });
});
