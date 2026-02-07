import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Cron endpoint for triggering the batch job
 *
 * This endpoint allows external cron services (like cron-job.org or Railway Cron)
 * to trigger the batch data processing script.
 *
 * Usage:
 * 1. Set CRON_SECRET environment variable in Railway
 * 2. Configure cron service to call:
 *    GET https://your-app.railway.app/api/cron/batch
 *    Authorization: Bearer <CRON_SECRET>
 *
 * Schedule: 0 6 * * * (daily at 6am UTC)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized runs
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not set in environment variables');
    return NextResponse.json(
      { error: 'Service misconfigured' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized cron job attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting batch job via cron endpoint...');
    const startTime = Date.now();

    const { stdout, stderr } = await execAsync('npx tsx scripts/batch.ts', {
      timeout: 600000, // 10 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
    });

    const duration = Date.now() - startTime;
    console.log(`Batch job completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      stdout: stdout.substring(0, 2000), // Truncate for response
      stderr: stderr ? stderr.substring(0, 1000) : null,
    });
  } catch (error) {
    console.error('Batch job failed:', error);

    return NextResponse.json(
      {
        error: 'Batch job failed',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual trigger with optional parameters
 * Useful for testing or forcing a batch run outside schedule
 */
export async function POST(request: NextRequest) {
  // Same authentication as GET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;

    console.log(`Manual batch job trigger (force: ${force})`);

    // Could add force flag handling to batch.ts if needed
    const { stdout, stderr } = await execAsync('npx tsx scripts/batch.ts', {
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      manual: true,
      stdout: stdout.substring(0, 2000),
      stderr: stderr ? stderr.substring(0, 1000) : null,
    });
  } catch (error) {
    console.error('Manual batch job failed:', error);

    return NextResponse.json(
      {
        error: 'Batch job failed',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
