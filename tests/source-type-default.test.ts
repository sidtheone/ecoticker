/**
 * TDD tests for Story 8.2: Fix stale schema default for source_type
 *
 * RED phase: these tests are written BEFORE implementation.
 * They should FAIL against the current codebase which still has "newsapi" defaults.
 *
 * AC coverage:
 *   AC1 — Schema default is "unknown", not "newsapi"
 *   AC2 — Insert call sites in seed/route.ts and articles/route.ts explicitly set
 *          sourceType to "seed" and "api" respectively (not "newsapi")
 *   AC3 — Fallback reference in topics/[slug]/route.ts uses "unknown", not "newsapi"
 *   AC4 — No data migration (deployment constraint, noted as manual verification below)
 *   AC5 — Full test suite (covered by running npx jest; not re-tested here)
 *   AC6 — ArticleList badge logic is covered in tests/ArticleList.test.tsx
 *          (new tests added there; see "source attribution badge — story 8-2" describe block)
 */

import * as fs from "fs";
import * as path from "path";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ─── AC1: Schema default ─────────────────────────────────────────────────────

describe("AC1 — Schema default for source_type", () => {
  const schemaSource = readSrc("src/db/schema.ts");

  test('source_type column default is "unknown", not "newsapi"', () => {
    // After fix: .default("unknown") must be present
    expect(schemaSource).toContain('.default("unknown")');
  });

  test('source_type column does NOT have a default of "newsapi"', () => {
    // Extract only the articles table definition to avoid false positives from comments
    // The articles table block starts at "export const articles" and ends at the closing ");"
    const articlesTableMatch = schemaSource.match(
      /export const articles\s*=\s*pgTable\s*\([\s\S]+?\);/
    );
    expect(articlesTableMatch).not.toBeNull();
    const articlesTable = articlesTableMatch![0];
    expect(articlesTable).not.toContain('.default("newsapi")');
  });
});

// ─── AC2: Insert call sites ───────────────────────────────────────────────────

describe("AC2 — Insert call sites set explicit sourceType values", () => {
  describe("src/app/api/seed/route.ts", () => {
    const seedSource = readSrc("src/app/api/seed/route.ts");

    test('seed route sets sourceType to "seed" (not "newsapi")', () => {
      expect(seedSource).toContain('sourceType: "seed"');
    });

    test('seed route does NOT set sourceType to "newsapi"', () => {
      // Strip comments before checking to avoid false positives
      const noComments = seedSource
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(noComments).not.toContain('"newsapi"');
    });
  });

  describe("src/app/api/articles/route.ts", () => {
    const articlesRouteSource = readSrc("src/app/api/articles/route.ts");

    test('articles POST route sets sourceType to "api" (not "newsapi")', () => {
      expect(articlesRouteSource).toContain('sourceType: "api"');
    });

    test('articles POST route does NOT set sourceType to "newsapi"', () => {
      const noComments = articlesRouteSource
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(noComments).not.toContain('"newsapi"');
    });
  });

  describe("src/app/api/batch/route.ts — already explicit (no change needed)", () => {
    const batchSource = readSrc("src/app/api/batch/route.ts");

    test('batch route already sets sourceType explicitly to "gnews" or "rss"', () => {
      const noComments = batchSource
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      // Must not rely on the stale default
      expect(noComments).not.toContain('sourceType: "newsapi"');
      // Must have at least one explicit assignment to gnews or rss
      const hasGnews = noComments.includes('"gnews"');
      const hasRss = noComments.includes('"rss"');
      expect(hasGnews || hasRss).toBe(true);
    });
  });
});

// ─── AC3: No "newsapi" fallback references in src/ ───────────────────────────

describe('AC3 — No "newsapi" fallback references remain in src/', () => {
  test('topics/[slug]/route.ts fallback uses "unknown", not "newsapi"', () => {
    const slugRouteSource = readSrc("src/app/api/topics/[slug]/route.ts");
    // After fix: ?? "unknown" must be present (nullish coalescing for precision)
    expect(slugRouteSource).toContain('?? "unknown"');
    // Strip comments and assert newsapi is gone
    const noComments = slugRouteSource
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toContain('"newsapi"');
  });

  test('schema.ts does not contain "newsapi" in code (comments permitted)', () => {
    const schemaSource = readSrc("src/db/schema.ts");
    const noComments = schemaSource
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toContain('"newsapi"');
  });

  test("grep across all src/ files: zero code-level newsapi references", () => {
    // Walk src/ and collect all .ts / .tsx files
    function walkSync(dir: string, ext: string[]): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...walkSync(full, ext));
        } else if (ext.some((e) => entry.name.endsWith(e))) {
          files.push(full);
        }
      }
      return files;
    }

    const srcDir = path.join(ROOT, "src");
    const sourceFiles = walkSync(srcDir, [".ts", ".tsx"]);

    const hits: string[] = [];
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Strip single-line and block comments
      const noComments = content
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (noComments.includes('"newsapi"')) {
        hits.push(path.relative(ROOT, file));
      }
    }

    expect(hits).toEqual([]); // Expect zero files with newsapi in code
  });
});

// ─── AC4: No data migration ───────────────────────────────────────────────────

describe("AC4 — Existing data is not modified (deployment constraint)", () => {
  /**
   * This AC cannot be unit-tested — it is a deployment-time guarantee.
   *
   * Guarantee: `drizzle-kit push` with a default-only column change (no type
   * change, no constraint change) issues `ALTER TABLE articles ALTER COLUMN
   * source_type SET DEFAULT 'unknown'`.  PostgreSQL applies this to future
   * inserts only; existing rows with source_type = "newsapi" are untouched.
   *
   * Manual verification checklist (run in staging before prod deploy):
   *   1. SELECT COUNT(*) FROM articles WHERE source_type = 'newsapi';  -- record count
   *   2. npx drizzle-kit push
   *   3. SELECT COUNT(*) FROM articles WHERE source_type = 'newsapi';  -- must be same count
   *   4. SELECT column_default FROM information_schema.columns
   *      WHERE table_name = 'articles' AND column_name = 'source_type';
   *      -- must return 'unknown'
   */
  test("AC4 is a deployment-time guarantee — schema change is default-only (no data migration)", () => {
    const schemaSource = readSrc("src/db/schema.ts");
    // Verify the column remains type TEXT with no additional constraints added
    // (i.e., this is still a simple .default() change, not a .notNull() or enum change)
    const articlesTableMatch = schemaSource.match(
      /export const articles\s*=\s*pgTable\s*\([\s\S]+?\);/
    );
    expect(articlesTableMatch).not.toBeNull();
    const articlesTable = articlesTableMatch![0];

    // sourceType is still text() — no type change that would require migration
    expect(articlesTable).toMatch(/sourceType:\s*text\("source_type"\)/);
    // Still has a default (just a different value — no constraint removed)
    expect(articlesTable).toMatch(/sourceType:\s*text\("source_type"\)\.default\(/);
  });
});
