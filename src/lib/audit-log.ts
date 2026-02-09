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
 */
export async function logAuditEvent(
  request: NextRequest,
  action: string,
  success: boolean,
  details?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    const pool = getDb();

    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const endpoint = request.nextUrl.pathname;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await pool.query(`
      INSERT INTO audit_logs (
        ip_address, endpoint, method, action, success,
        error_message, details, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      ipAddress,
      endpoint,
      method,
      action,
      success,
      errorMessage || null,
      details ? JSON.stringify(details) : null,
      userAgent
    ]);
  } catch (error) {
    // Don't let audit logging failures break the main operation
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
 */
export async function getAuditLogs(limit: number = 100, offset: number = 0) {
  const pool = getDb();

  const { rows: logs } = await pool.query(`
    SELECT
      id, timestamp, ip_address, endpoint, method, action,
      success, error_message, details, user_agent, created_at
    FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const { rows: [totalRow] } = await pool.query('SELECT COUNT(*) as count FROM audit_logs');

  return {
    logs: logs.map((log: Record<string, unknown>) => ({
      ...log,
      success: Boolean(log.success),
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details ?? null,
    })),
    total: parseInt(totalRow.count as string),
  };
}

/**
 * Get audit log statistics
 */
export async function getAuditStats() {
  const pool = getDb();

  const { rows: [stats] } = await pool.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
      COUNT(DISTINCT ip_address) as unique_ips,
      COUNT(DISTINCT action) as unique_actions
    FROM audit_logs
  `);

  const { rows: recentFailures } = await pool.query(`
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE NOT success
      AND timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY action
    ORDER BY count DESC
    LIMIT 5
  `);

  const { rows: topActions } = await pool.query(`
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE timestamp > NOW() - INTERVAL '7 days'
    GROUP BY action
    ORDER BY count DESC
    LIMIT 10
  `);

  return {
    total: parseInt(stats.total),
    successful: parseInt(stats.successful || '0'),
    failed: parseInt(stats.failed || '0'),
    uniqueIPs: parseInt(stats.unique_ips),
    uniqueActions: parseInt(stats.unique_actions),
    recentFailures,
    topActions,
  };
}
