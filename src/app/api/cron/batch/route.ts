import { NextRequest, NextResponse } from 'next/server';
import { POST as seedPOST } from '@/app/api/seed/route';
import { POST as batchPOST } from '@/app/api/batch/route';

/**
 * Cron endpoint for triggering the batch job
 *
 * This endpoint allows external cron services (like cron-job.org or Railway Cron)
 * to trigger batch processing.
 *
 * Usage:
 * 1. Set CRON_SECRET environment variable in Railway
 * 2. Configure cron service to call:
 *    GET https://your-app.railway.app/api/cron/batch
 *    Authorization: Bearer <CRON_SECRET>
 *
 * Schedule: 0 6 * * * (daily at 6am UTC)
 *
 * Behavior:
 * - If NEWSAPI_KEY and OPENROUTER_API_KEY are set: Fetches real news and processes with LLM
 * - Otherwise: Seeds database with demo data
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

    // Check if API keys are configured for real data processing
    const hasApiKeys = process.env.NEWSAPI_KEY && process.env.OPENROUTER_API_KEY;

    let response;
    if (hasApiKeys) {
      console.log('API keys detected - using real batch processing');
      // Call /api/batch to fetch and process real news
      const batchRequest = new NextRequest(new URL('/api/batch', request.url), {
        method: 'POST',
      });
      response = await batchPOST(batchRequest);
    } else {
      console.log('No API keys - using demo seed data');
      // Call /api/seed to populate with demo data
      const seedRequest = new NextRequest(new URL('/api/seed', request.url), {
        method: 'POST',
      });
      response = await seedPOST(seedRequest);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;
    console.log(`Batch job completed in ${duration}ms`);

    if (!response.ok) {
      throw new Error(data.error || 'Batch endpoint failed');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      mode: hasApiKeys ? 'real-data' : 'demo-data',
      stats: data.stats,
      message: data.message,
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

    // Check if API keys are configured for real data processing
    const hasApiKeys = process.env.NEWSAPI_KEY && process.env.OPENROUTER_API_KEY;

    let response;
    if (hasApiKeys) {
      console.log('API keys detected - using real batch processing');
      const batchRequest = new NextRequest(new URL('/api/batch', request.url), {
        method: 'POST',
      });
      response = await batchPOST(batchRequest);
    } else {
      console.log('No API keys - using demo seed data');
      const seedRequest = new NextRequest(new URL('/api/seed', request.url), {
        method: 'POST',
      });
      response = await seedPOST(seedRequest);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Batch endpoint failed');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      manual: true,
      mode: hasApiKeys ? 'real-data' : 'demo-data',
      stats: data.stats,
      message: data.message,
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
