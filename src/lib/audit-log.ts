import { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, count, sql, and, gt } from "drizzle-orm";

/**
 * Audit logging for security monitoring
 * Tracks all write operations (POST/PUT/DELETE) to database
 */

export interface AuditLogEntry {
  ipAddress: string;
  endpoint: string;
  method: string;
  action: string;
  success: boolean;
  errorMessage?: string;
  details?: Record<string, unknown>;
}

/**
 * GDPR: Truncate IP address before storage
 * - IPv4: zero last octet (e.g., 192.168.1.0)
 * - IPv6: zero last 80 bits (e.g., 2001:db8:85a3::0)
 */
function truncateIP(ip: string): string {
  if (ip === "unknown" || !ip) return ip;

  // IPv4: zero last octet
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      parts[3] = "0";
      return parts.join(".");
    }
  }

  // IPv6: zero last 80 bits (keep first 48 bits)
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(":") + "::0";
    }
  }

  return ip; // fallback: return as-is if format unrecognized
}

/**
 * Log an API operation to the audit log
 *
 * @param request - Next.js request object
 * @param action - Descriptive action name (e.g., "seed_database", "create_article")
 * @param success - Whether the operation succeeded
 * @param details - Optional additional details to log
 * @param errorMessage - Optional error message if operation failed
 */
export async function logAuditEvent(
  request: NextRequest,
  action: string,
  success: boolean,
  details?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    const rawIP =
      request.headers.get("cf-connecting-ip") || // Cloudflare real IP
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipAddress = truncateIP(rawIP); // GDPR: truncate before storage
    const endpoint = request.nextUrl.pathname;
    const method = request.method;

    await db.insert(auditLogs).values({
      ipAddress,
      endpoint,
      method,
      action,
      success,
      errorMessage: errorMessage || null,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (error) {
    // Don't let audit logging failures break the main operation
    // Just log to console for debugging
    console.error("Failed to write audit log:", error);
  }
}

/**
 * Convenience wrapper for successful operations
 */
export async function logSuccess(
  request: NextRequest,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(request, action, true, details);
}

/**
 * Convenience wrapper for failed operations
 */
export async function logFailure(
  request: NextRequest,
  action: string,
  errorMessage: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(request, action, false, details, errorMessage);
}

/**
 * Get recent audit log entries
 *
 * @param limit - Maximum number of entries to return
 * @param offset - Pagination offset
 * @returns Array of audit log entries and total count
 */
export async function getAuditLogs(limit: number = 100, offset: number = 0) {
  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ count: count() }).from(auditLogs);
  const total = totalResult[0]?.count || 0;

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details as string) : null,
    })),
    total,
  };
}

/**
 * Get audit log statistics
 */
export async function getAuditStats() {
  // Overall stats
  const statsResult = await db
    .select({
      total: count(),
      successful: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.success} = true)`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.success} = false)`,
      uniqueIPs: sql<number>`COUNT(DISTINCT ${auditLogs.ipAddress})`,
      uniqueActions: sql<number>`COUNT(DISTINCT ${auditLogs.action})`,
    })
    .from(auditLogs);

  const stats = statsResult[0] || {
    total: 0,
    successful: 0,
    failed: 0,
    uniqueIPs: 0,
    uniqueActions: 0,
  };

  // Recent failures (last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentFailures = await db
    .select({
      action: auditLogs.action,
      count: count(),
    })
    .from(auditLogs)
    .where(
      and(
        sql`${auditLogs.success} = false`,
        gt(auditLogs.timestamp, twentyFourHoursAgo)
      )
    )
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  // Top actions (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const topActions = await db
    .select({
      action: auditLogs.action,
      count: count(),
    })
    .from(auditLogs)
    .where(gt(auditLogs.timestamp, sevenDaysAgo))
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    total: stats.total,
    successful: stats.successful,
    failed: stats.failed,
    uniqueIPs: stats.uniqueIPs,
    uniqueActions: stats.uniqueActions,
    recentFailures,
    topActions,
  };
}
