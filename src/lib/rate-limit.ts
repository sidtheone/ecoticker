/**
 * In-memory rate limiting for API endpoints
 * Simple implementation suitable for demo/personal projects
 */

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

/**
 * Rate limiter class with sliding window implementation
 */
export class RateLimiter {
  constructor(
    private interval: number,  // Time window in milliseconds
    private maxRequests: number  // Max requests allowed in window
  ) {}

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier for the client (e.g., IP address)
   * @returns true if request is allowed, false if rate limit exceeded
   */
  check(identifier: string): boolean {
    const now = Date.now();
    const key = identifier;

    if (!store[key] || now > store[key].resetTime) {
      // First request or window has expired - allow and start new window
      store[key] = { count: 1, resetTime: now + this.interval };
      return true;
    }

    if (store[key].count >= this.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment count and allow request
    store[key].count++;
    return true;
  }

  /**
   * Get the reset time for a given identifier
   * @param identifier - Unique identifier for the client
   * @returns Unix timestamp (ms) when the rate limit will reset
   */
  getResetTime(identifier: string): number {
    return store[identifier]?.resetTime || Date.now();
  }
}

// Pre-configured rate limiters for different endpoint types
export const readLimiter = new RateLimiter(60 * 1000, 100);      // 100 requests per minute for GET
export const writeLimiter = new RateLimiter(60 * 1000, 10);      // 10 requests per minute for POST/PUT/DELETE
export const batchLimiter = new RateLimiter(60 * 60 * 1000, 2);  // 2 requests per hour for batch/seed
