import { NextRequest, NextResponse } from 'next/server';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { getAuditLogs, getAuditStats } from '@/lib/audit-log';
import { createErrorResponse } from '@/lib/errors';

/**
 * Audit Logs API
 *
 * GET /api/audit-logs - View audit logs and statistics (admin only)
 */
export async function GET(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const showStats = searchParams.get('stats') === 'true';

    if (showStats) {
      const stats = await getAuditStats();

      return NextResponse.json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    const limit = Math.min(
      parseInt(searchParams.get('limit') || '100'),
      1000
    );
    const offset = parseInt(searchParams.get('offset') || '0');

    const { logs, total } = await getAuditLogs(limit, offset);

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch audit logs');
  }
}
