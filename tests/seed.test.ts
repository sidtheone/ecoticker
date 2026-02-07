import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

describe("Seed Script", () => {
  const testDbPath = path.join(os.tmpdir(), `ecoticker-seed-test-${Date.now()}.db`);

  afterAll(() => {
    try { fs.unlinkSync(testDbPath); } catch {}
  });

  test("seed script populates database with expected data", () => {
    // Run seed script with a test DB path
    execSync(`npx tsx scripts/seed.ts`, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    const db = new Database(testDbPath);

    const topicCount = (db.prepare("SELECT COUNT(*) as c FROM topics").get() as { c: number }).c;
    expect(topicCount).toBe(12);

    const articleCount = (db.prepare("SELECT COUNT(*) as c FROM articles").get() as { c: number }).c;
    expect(articleCount).toBe(36); // 12 topics * 3 articles each

    const scoreCount = (db.prepare("SELECT COUNT(*) as c FROM score_history").get() as { c: number }).c;
    expect(scoreCount).toBe(84); // 12 topics * 7 days each

    const keywordCount = (db.prepare("SELECT COUNT(*) as c FROM topic_keywords").get() as { c: number }).c;
    expect(keywordCount).toBeGreaterThan(0);

    // Verify topics have expected fields populated
    const topics = db.prepare("SELECT * FROM topics").all() as Record<string, unknown>[];
    for (const t of topics) {
      expect(t.name).toBeTruthy();
      expect(t.slug).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.region).toBeTruthy();
      expect(t.impact_summary).toBeTruthy();
      expect(typeof t.current_score).toBe("number");
      expect(typeof t.previous_score).toBe("number");
      expect(["breaking", "critical", "moderate", "informational"]).toContain(t.urgency);
    }

    // Verify score_history has sub-scores
    const scores = db.prepare("SELECT * FROM score_history LIMIT 1").get() as Record<string, unknown>;
    expect(scores.health_score).toBeDefined();
    expect(scores.eco_score).toBeDefined();
    expect(scores.econ_score).toBeDefined();

    db.close();
  });
});
