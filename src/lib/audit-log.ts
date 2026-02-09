import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

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
  userAgent?: string;
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
export function logAuditEvent(
  request: NextRequest,
  action: string,
  success: boolean,
  details?: Record<string, unknown>,
  errorMessage?: string
): void {
  try {
    const db = getDb();

    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const endpoint = request.nextUrl.pathname;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || 'unknown';

    db.prepare(`
      INSERT INTO audit_logs (
        ip_address, endpoint, method, action, success,
        error_message, details, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ipAddress,
      endpoint,
      method,
      action,
      success ? 1 : 0,
      errorMessage || null,
      details ? JSON.stringify(details) : null,
      userAgent
    );
  } catch (error) {
    // Don't let audit logging failures break the main operation
    // Just log to console for debugging
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Convenience wrapper for successful operations
 */
export function logSuccess(
  request: NextRequest,
  action: string,
  details?: Record<string, unknown>
): void {
  logAuditEvent(request, action, true, details);
}

/**
 * Convenience wrapper for failed operations
 */
export function logFailure(
  request: NextRequest,
  action: string,
  errorMessage: string,
  details?: Record<string, unknown>
): void {
  logAuditEvent(request, action, false, details, errorMessage);
}

/**
 * Get recent audit log entries
 *
 * @param limit - Maximum number of entries to return
 * @param offset - Pagination offset
 * @returns Array of audit log entries
 */
export function getAuditLogs(limit: number = 100, offset: number = 0) {
  const db = getDb();

  const logs = db.prepare(`
    SELECT
      id, timestamp, ip_address, endpoint, method, action,
      success, error_message, details, user_agent, created_at
    FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number };

  return {
    logs: logs.map((log: any) => ({
      ...log,
      success: Boolean(log.success),
      details: log.details ? JSON.parse(log.details) : null,
    })),
    total: total.count,
  };
}

/**
 * Get audit log statistics
 */
export function getAuditStats() {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
      COUNT(DISTINCT ip_address) as unique_ips,
      COUNT(DISTINCT action) as unique_actions
    FROM audit_logs
  `).get() as {
    total: number;
    successful: number;
    failed: number;
    unique_ips: number;
    unique_actions: number;
  };

  const recentFailures = db.prepare(`
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE success = 0
      AND timestamp > datetime('now', '-24 hours')
    GROUP BY action
    ORDER BY count DESC
    LIMIT 5
  `).all();

  const topActions = db.prepare(`
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE timestamp > datetime('now', '-7 days')
    GROUP BY action
    ORDER BY count DESC
    LIMIT 10
  `).all();

  return {
    total: stats.total,
    successful: stats.successful,
    failed: stats.failed,
    uniqueIPs: stats.unique_ips,
    uniqueActions: stats.unique_actions,
    recentFailures,
    topActions,
  };
}
