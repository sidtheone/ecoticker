import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

function createTestDb() {
  const dbPath = path.join(os.tmpdir(), `ecoticker-ticker-test-${Date.now()}.db`);
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

function queryTicker(db: Database.Database) {
  return db.prepare(`
    SELECT name, slug, current_score as score,
      (current_score - previous_score) as change
    FROM topics
    ORDER BY current_score DESC
    LIMIT 15
  `).all() as { name: string; slug: string; score: number; change: number }[];
}

describe("GET /api/ticker — query logic", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    ({ db, dbPath } = createTestDb());
  });
  afterEach(() => cleanup(db, dbPath));

  test("returns top 15 topics by score", () => {
    const insert = db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)");
    for (let i = 0; i < 20; i++) {
      insert.run(`Topic ${i}`, `topic-${i}`, 100 - i, 90 - i);
    }

    const items = queryTicker(db);
    expect(items).toHaveLength(15);
    expect(items[0].score).toBe(100);
    expect(items[14].score).toBe(86);
  });

  test("returns lightweight payload (only name, slug, score, change)", () => {
    db.prepare("INSERT INTO topics (name, slug, current_score, previous_score, urgency, category, impact_summary) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("Test", "test", 80, 70, "critical", "climate", "Some long summary");

    const items = queryTicker(db);
    expect(items).toHaveLength(1);
    const keys = Object.keys(items[0]);
    expect(keys).toEqual(["name", "slug", "score", "change"]);
  });

  test("computes change correctly", () => {
    db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)").run("Up", "up", 80, 65);
    db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)").run("Down", "down", 40, 55);

    const items = queryTicker(db);
    expect(items[0].change).toBe(15);  // 80 - 65
    expect(items[1].change).toBe(-15); // 40 - 55
  });

  test("returns empty array when no topics", () => {
    const items = queryTicker(db);
    expect(items).toEqual([]);
  });

  test("returns fewer than 15 if less topics exist", () => {
    db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)").run("Only", "only", 50, 50);
    const items = queryTicker(db);
    expect(items).toHaveLength(1);
  });
});
