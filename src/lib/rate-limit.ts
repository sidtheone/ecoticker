/**
 * In-memory rate limiting for API endpoints
 * Simple implementation suitable for demo/personal projects
 */

import { RATE_LIMITS, RATE_LIMIT_CLEANUP_INTERVAL_MS } from './constants';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries to prevent memory leaks
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  // Allow process to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Rate limiter class with sliding window implementation
 */
export class RateLimiter {
  constructor(
    private interval: number,  // Time window in milliseconds
    private maxRequests: number  // Max requests allowed in window
  ) {
    startCleanup();
  }

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier for the client (e.g., IP address)
   * @returns true if request is allowed, false if rate limit exceeded
   */
  check(identifier: string): boolean {
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || now > entry.resetTime) {
      store.set(identifier, { count: 1, resetTime: now + this.interval });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get the reset time for a given identifier
   * @param identifier - Unique identifier for the client
   * @returns Unix timestamp (ms) when the rate limit will reset
   */
  getResetTime(identifier: string): number {
    return store.get(identifier)?.resetTime || Date.now();
  }
}

// Pre-configured rate limiters for different endpoint types
export const readLimiter = new RateLimiter(RATE_LIMITS.READ_WINDOW_MS, RATE_LIMITS.READ_MAX_REQUESTS);
export const writeLimiter = new RateLimiter(RATE_LIMITS.WRITE_WINDOW_MS, RATE_LIMITS.WRITE_MAX_REQUESTS);
export const batchLimiter = new RateLimiter(RATE_LIMITS.BATCH_WINDOW_MS, RATE_LIMITS.BATCH_MAX_REQUESTS);
