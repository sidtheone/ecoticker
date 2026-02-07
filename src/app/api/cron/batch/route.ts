import { NextRequest, NextResponse } from 'next/server';
import { POST as seedPOST } from '@/app/api/seed/route';

/**
 * Cron endpoint for triggering the batch job
 *
 * This endpoint allows external cron services (like cron-job.org or Railway Cron)
 * to trigger database seeding with demo data.
 *
 * Usage:
 * 1. Set CRON_SECRET environment variable in Railway
 * 2. Configure cron service to call:
 *    GET https://your-app.railway.app/api/cron/batch
 *    Authorization: Bearer <CRON_SECRET>
 *
 * Schedule: 0 6 * * * (daily at 6am UTC)
 *
 * Note: Currently calls /api/seed internally. For real data, use the batch script
 * locally: npx tsx scripts/batch.ts with NEWSAPI_KEY and OPENROUTER_API_KEY set.
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

    // Call /api/seed internally to populate database
    const seedRequest = new NextRequest(new URL('/api/seed', request.url), {
      method: 'POST',
    });

    const seedResponse = await seedPOST(seedRequest);
    const seedData = await seedResponse.json();

    const duration = Date.now() - startTime;
    console.log(`Batch job completed in ${duration}ms`);

    if (!seedResponse.ok) {
      throw new Error(seedData.error || 'Seed endpoint failed');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      stats: seedData.stats,
      message: seedData.message,
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

    // Call /api/seed internally to populate database
    const seedRequest = new NextRequest(new URL('/api/seed', request.url), {
      method: 'POST',
    });

    const seedResponse = await seedPOST(seedRequest);
    const seedData = await seedResponse.json();

    if (!seedResponse.ok) {
      throw new Error(seedData.error || 'Seed endpoint failed');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      manual: true,
      stats: seedData.stats,
      message: seedData.message,
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
