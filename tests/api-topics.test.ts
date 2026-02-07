import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

function createTestDb() {
  const dbPath = path.join(os.tmpdir(), `ecoticker-api-test-${Date.now()}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8"));
  return { db, dbPath };
}

function cleanup(db: Database.Database, dbPath: string) {
  db.close();
  try { fs.unlinkSync(dbPath); } catch {}
}

function seedTopics(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, article_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run("Arctic Ice Decline", "arctic-ice-decline", "climate", "Arctic", 85, 79, "breaking", "Sea ice at record lows", 5);
  insert.run("Delhi Air Quality", "delhi-air-quality", "air_quality", "South Asia", 91, 88, "breaking", "AQI hazardous", 8);
  insert.run("Ganges Cleanup", "ganges-cleanup", "water", "South Asia", 45, 52, "moderate", "Cleanup progress", 3);
  insert.run("Renewable Growth", "renewable-growth", "energy", "Global", 22, 28, "informational", "Solar up 15%", 2);
}

describe("GET /api/topics — query logic", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    ({ db, dbPath } = createTestDb());
    seedTopics(db);
  });
  afterEach(() => cleanup(db, dbPath));

  function queryTopics(urgency?: string, category?: string) {
    let query = `
      SELECT id, name, slug, category, region,
        current_score, previous_score,
        (current_score - previous_score) as change,
        urgency, impact_summary, image_url, article_count, updated_at
      FROM topics
    `;
    const conditions: string[] = [];
    const params: string[] = [];
    if (urgency) { conditions.push("urgency = ?"); params.push(urgency); }
    if (category) { conditions.push("category = ?"); params.push(category); }
    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY current_score DESC";
    return db.prepare(query).all(...params) as Record<string, unknown>[];
  }

  test("returns all topics sorted by score descending", () => {
    const rows = queryTopics();
    expect(rows).toHaveLength(4);
    expect(rows[0].name).toBe("Delhi Air Quality");
    expect(rows[1].name).toBe("Arctic Ice Decline");
    expect(rows[3].name).toBe("Renewable Growth");
  });

  test("computes change correctly", () => {
    const rows = queryTopics();
    const arctic = rows.find((r) => r.slug === "arctic-ice-decline");
    expect(arctic!.change).toBe(6); // 85 - 79
    const ganges = rows.find((r) => r.slug === "ganges-cleanup");
    expect(ganges!.change).toBe(-7); // 45 - 52
  });

  test("filters by urgency", () => {
    const rows = queryTopics("breaking");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.urgency === "breaking")).toBe(true);
  });

  test("filters by category", () => {
    const rows = queryTopics(undefined, "water");
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("ganges-cleanup");
  });

  test("filters by both urgency and category", () => {
    const rows = queryTopics("breaking", "air_quality");
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("delhi-air-quality");
  });

  test("returns empty array for no matches", () => {
    const rows = queryTopics("breaking", "waste");
    expect(rows).toHaveLength(0);
  });

  test("sparkline query returns last 7 scores in chronological order", () => {
    const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 'arctic-ice-decline'").get() as { id: number }).id;
    const insert = db.prepare("INSERT INTO score_history (topic_id, score, recorded_at) VALUES (?, ?, ?)");
    for (let i = 0; i < 10; i++) {
      insert.run(topicId, 60 + i, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`);
    }
    const history = db.prepare(
      "SELECT score FROM score_history WHERE topic_id = ? ORDER BY recorded_at DESC LIMIT 7"
    ).all(topicId) as { score: number }[];
    const sparkline = history.map((h) => h.score).reverse();
    expect(sparkline).toEqual([63, 64, 65, 66, 67, 68, 69]);
    expect(sparkline).toHaveLength(7);
  });
});
