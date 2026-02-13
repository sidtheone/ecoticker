import type { SeverityLevel } from "./types";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

/**
 * Severity level score ranges.
 * Each level maps to a [min, max] score range.
 */
export const LEVEL_RANGES: Record<string, [number, number]> = {
  MINIMAL: [0, 25],
  MODERATE: [26, 50],
  SIGNIFICANT: [51, 75],
  SEVERE: [76, 100],
};

/**
 * Dimension weights for computing the overall score.
 * Weights sum to 1.0:
 * - Ecological (40%): Core mission
 * - Health (35%): Most salient to users
 * - Economic (25%): Contextual
 */
export const DIMENSION_WEIGHTS = {
  eco: 0.4,
  health: 0.35,
  econ: 0.25,
} as const;

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface ValidatedScore {
  level: string;
  score: number;
  clamped: boolean;
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────

/**
 * Validates and clamps a score to its severity level's allowed range.
 *
 * @param level - The severity level (MINIMAL, MODERATE, SIGNIFICANT, SEVERE, INSUFFICIENT_DATA)
 * @param score - The numeric score from the LLM
 * @returns Validated score with clamping indicator
 *
 * @example
 * validateScore("MINIMAL", 30)  // { level: "MINIMAL", score: 25, clamped: true }
 * validateScore("SEVERE", 85)   // { level: "SEVERE", score: 85, clamped: false }
 * validateScore("INSUFFICIENT_DATA", -1)  // { level: "INSUFFICIENT_DATA", score: -1, clamped: false }
 */
export function validateScore(level: string, score: number): ValidatedScore {
  // Handle insufficient data case
  if (level === "INSUFFICIENT_DATA" || score === -1) {
    return { level: "INSUFFICIENT_DATA", score: -1, clamped: false };
  }

  // Handle unknown level — fall back to MODERATE with warning
  if (!LEVEL_RANGES[level]) {
    console.warn(
      `Unknown severity level "${level}", falling back to MODERATE. ` +
        `Valid levels: ${Object.keys(LEVEL_RANGES).join(", ")}`
    );
    const clampedScore = Math.max(26, Math.min(50, score));
    return { level: "MODERATE", score: clampedScore, clamped: true };
  }

  // Clamp score to the level's valid range
  const [min, max] = LEVEL_RANGES[level];
  const clampedScore = Math.max(min, Math.min(max, score));

  return {
    level,
    score: clampedScore,
    clamped: clampedScore !== score,
  };
}

// ─────────────────────────────────────────────────────────────────
// AGGREGATION
// ─────────────────────────────────────────────────────────────────

/**
 * Computes the overall weighted score from health, ecological, and economic scores.
 *
 * Dimensions with score = -1 (INSUFFICIENT_DATA) are excluded from the average.
 * Remaining weights are renormalized to sum to 1.0.
 *
 * @param healthScore - Health dimension score (0-100 or -1 for insufficient data)
 * @param ecoScore - Ecological dimension score (0-100 or -1 for insufficient data)
 * @param econScore - Economic dimension score (0-100 or -1 for insufficient data)
 * @returns Overall score (0-100), or 50 if all dimensions are insufficient
 *
 * @example
 * computeOverallScore(50, 60, 40)  // 51 (all valid)
 * computeOverallScore(50, -1, 40)  // 46 (eco excluded, health+econ renormalized)
 * computeOverallScore(-1, -1, -1)  // 50 (fallback)
 */
export function computeOverallScore(
  healthScore: number,
  ecoScore: number,
  econScore: number
): number {
  // Build list of valid dimensions (exclude INSUFFICIENT_DATA = -1)
  const dimensions: { score: number; weight: number }[] = [];

  if (healthScore >= 0) dimensions.push({ score: healthScore, weight: DIMENSION_WEIGHTS.health });
  if (ecoScore >= 0) dimensions.push({ score: ecoScore, weight: DIMENSION_WEIGHTS.eco });
  if (econScore >= 0) dimensions.push({ score: econScore, weight: DIMENSION_WEIGHTS.econ });

  // Fallback if all dimensions are insufficient
  if (dimensions.length === 0) {
    console.warn("All dimensions marked as INSUFFICIENT_DATA, using fallback score of 50");
    return 50;
  }

  // Normalize weights to sum to 1.0
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0);

  return Math.round(weightedSum);
}

// ─────────────────────────────────────────────────────────────────
// URGENCY MAPPING
// ─────────────────────────────────────────────────────────────────

/**
 * Maps an overall score to an urgency level.
 *
 * Urgency levels (backward compatible with existing system):
 * - breaking: 80+ (catastrophic)
 * - critical: 60-79 (serious)
 * - moderate: 30-59 (localized)
 * - informational: 0-29 (negligible)
 *
 * @param overallScore - The computed overall score (0-100)
 * @returns Urgency level string
 *
 * @example
 * deriveUrgency(85)  // "breaking"
 * deriveUrgency(65)  // "critical"
 * deriveUrgency(45)  // "moderate"
 * deriveUrgency(15)  // "informational"
 */
export function deriveUrgency(overallScore: number): string {
  if (overallScore >= 80) return "breaking";
  if (overallScore >= 60) return "critical";
  if (overallScore >= 30) return "moderate";
  return "informational";
}

// ─────────────────────────────────────────────────────────────────
// ANOMALY DETECTION
// ─────────────────────────────────────────────────────────────────

/**
 * Detects anomalous score changes (jumps >25 points = one full severity level).
 *
 * Logs a warning when an anomaly is detected.
 *
 * @param previousScore - The previous score for this dimension
 * @param newScore - The new score for this dimension
 * @param topicName - The topic name (for logging)
 * @param dimension - The dimension name (for logging: "health", "eco", "econ")
 * @returns True if the change is anomalous
 *
 * @example
 * detectAnomaly(40, 70, "Amazon Deforestation", "eco")  // true (30pt jump)
 * detectAnomaly(40, 60, "Amazon Deforestation", "eco")  // false (20pt jump)
 */
export function detectAnomaly(
  previousScore: number,
  newScore: number,
  topicName: string,
  dimension: string
): boolean {
  // Skip detection if no previous score exists or if insufficient data
  if (previousScore === null || previousScore === -1 || newScore === -1) {
    return false;
  }

  const delta = Math.abs(newScore - previousScore);

  if (delta > 25) {
    // One full severity level jump
    console.warn(
      `ANOMALY DETECTED: "${topicName}" ${dimension} score jumped ${delta} points ` +
        `(${previousScore} → ${newScore}). Manual review recommended.`
    );
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────
// REVERSE MAPPING (UTILITIES)
// ─────────────────────────────────────────────────────────────────

/**
 * Reverse mapping: score → severity level.
 *
 * Useful for seed data generation and tests.
 *
 * @param score - The numeric score (0-100)
 * @returns The severity level that this score falls into
 *
 * @example
 * scoreToLevel(15)  // "MINIMAL"
 * scoreToLevel(40)  // "MODERATE"
 * scoreToLevel(65)  // "SIGNIFICANT"
 * scoreToLevel(90)  // "SEVERE"
 * scoreToLevel(-1)  // "INSUFFICIENT_DATA"
 */
export function scoreToLevel(score: number): SeverityLevel {
  if (score === -1) return "INSUFFICIENT_DATA";
  if (score >= 0 && score <= 25) return "MINIMAL";
  if (score >= 26 && score <= 50) return "MODERATE";
  if (score >= 51 && score <= 75) return "SIGNIFICANT";
  if (score >= 76 && score <= 100) return "SEVERE";

  // Fallback for out-of-range scores (shouldn't happen)
  console.warn(`scoreToLevel: score ${score} is out of range, defaulting to MODERATE`);
  return "MODERATE";
}
