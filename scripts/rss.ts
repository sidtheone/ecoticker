/**
 * Re-export shim for backward compatibility (Story 8-1).
 *
 * All RSS pipeline logic now lives in src/lib/batch-pipeline.ts.
 * This file is kept so that:
 *   - tests/rss.test.ts (which imports from "../scripts/rss") continues to work
 *   - The RSS_FEEDS env var override test (uses jest.resetModules + require) continues to work
 *
 * Note: relative imports required — @/ alias does not work outside Next.js context.
 */
export {
  fetchRssFeeds,
  feedHostname,
  DEFAULT_FEEDS,
  type NewsArticle,
  type FeedHealth,
} from "../src/lib/batch-pipeline";
