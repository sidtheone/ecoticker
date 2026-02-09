/**
 * Shared constants for the EcoTicker application
 */

/** Score thresholds for urgency classification */
export const SCORE_THRESHOLDS = {
  BREAKING: 80,
  CRITICAL: 60,
  MODERATE: 30,
} as const;

/** Rate limiting configuration */
export const RATE_LIMITS = {
  READ_WINDOW_MS: 60 * 1000,
  READ_MAX_REQUESTS: 100,
  WRITE_WINDOW_MS: 60 * 1000,
  WRITE_MAX_REQUESTS: 10,
  BATCH_WINDOW_MS: 60 * 60 * 1000,
  BATCH_MAX_REQUESTS: 2,
} as const;

/** API request timeouts */
export const TIMEOUTS = {
  NEWS_API_MS: 15_000,
  LLM_API_MS: 60_000,
} as const;

/** Batch processing configuration */
export const BATCH = {
  CLASSIFICATION_BATCH_SIZE: 10,
  KEYWORD_GROUP_SIZE: 4,
} as const;

/** Valid enum values for API validation */
export const VALID_URGENCIES = ["breaking", "critical", "moderate", "informational"] as const;
export const VALID_CATEGORIES = [
  "air_quality", "deforestation", "ocean", "climate", "pollution",
  "biodiversity", "wildlife", "energy", "waste", "water",
] as const;

/** Rate limiter cleanup interval (5 minutes) */
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
