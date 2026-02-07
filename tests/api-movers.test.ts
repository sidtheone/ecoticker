import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

function createTestDb() {
  const dbPath = path.join(os.tmpdir(), `ecoticker-movers-test-${Date.now()}.db`);
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

function queryMovers(db: Database.Database) {
  return db.prepare(`
    SELECT name, slug, current_score, previous_score,
      (current_score - previous_score) as change,
      urgency
    FROM topics
    WHERE current_score != previous_score
    ORDER BY ABS(current_score - previous_score) DESC
    LIMIT 5
  `).all() as Record<string, unknown>[];
}

describe("GET /api/movers — query logic", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    ({ db, dbPath } = createTestDb());
  });
  afterEach(() => cleanup(db, dbPath));

  test("returns top 5 movers sorted by absolute change", () => {
    const insert = db.prepare("INSERT INTO topics (name, slug, current_score, previous_score, urgency) VALUES (?, ?, ?, ?, ?)");
    insert.run("Big Up", "big-up", 90, 50, "breaking");       // +40
    insert.run("Big Down", "big-down", 30, 65, "moderate");    // -35
    insert.run("Medium", "medium", 70, 55, "critical");        // +15
    insert.run("Small", "small", 50, 45, "moderate");          // +5
    insert.run("Tiny", "tiny", 20, 18, "informational");       // +2
    insert.run("Also Big", "also-big", 80, 55, "breaking");    // +25
    insert.run("Stable", "stable", 60, 60, "moderate");        // 0 — excluded

    const rows = queryMovers(db);
    expect(rows).toHaveLength(5);
    expect(rows[0].name).toBe("Big Up");       // |+40|
    expect(rows[1].name).toBe("Big Down");     // |-35|
    expect(rows[2].name).toBe("Also Big");     // |+25|
    expect(rows[3].name).toBe("Medium");       // |+15|
    expect(rows[4].name).toBe("Small");        // |+5|
  });

  test("excludes topics with zero change", () => {
    const insert = db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)");
    insert.run("Stable", "stable", 50, 50);
    insert.run("Moving", "moving", 70, 55);

    const rows = queryMovers(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Moving");
  });

  test("includes both positive and negative movers", () => {
    const insert = db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)");
    insert.run("Worsening", "worse", 80, 60);
    insert.run("Improving", "better", 30, 55);

    const rows = queryMovers(db);
    expect(rows).toHaveLength(2);
    const changes = rows.map((r) => r.change as number);
    expect(changes.some((c) => c > 0)).toBe(true);
    expect(changes.some((c) => c < 0)).toBe(true);
  });

  test("returns empty array when all topics are stable", () => {
    db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)").run("Stable", "stable", 50, 50);
    const rows = queryMovers(db);
    expect(rows).toEqual([]);
  });

  test("returns fewer than 5 if fewer movers exist", () => {
    db.prepare("INSERT INTO topics (name, slug, current_score, previous_score) VALUES (?, ?, ?, ?)").run("Only", "only", 60, 40);
    const rows = queryMovers(db);
    expect(rows).toHaveLength(1);
  });
});
