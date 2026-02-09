import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readLimiter, writeLimiter, batchLimiter } from '@/lib/rate-limit';

export function middleware(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const path = request.nextUrl.pathname;
  const method = request.method;

  // Determine which rate limiter to use based on endpoint and method
  let limiter = readLimiter;
  if (path.includes('/batch') || path.includes('/seed')) {
    // Batch operations have strictest limits (2/hour)
    limiter = batchLimiter;
  } else if (method !== 'GET' && method !== 'HEAD') {
    // Write operations (POST/PUT/DELETE) have moderate limits (10/min)
    limiter = writeLimiter;
  }

  if (!limiter.check(ip)) {
    const resetTime = limiter.getResetTime(ip);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(resetTime),
      },
    });
  }

  const response = NextResponse.next();

  // Security headers (previously in nginx.conf, now handled by Next.js)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content-Security-Policy - Enable XSS protection
  // Next.js requires 'unsafe-inline' for script-src and style-src due to hydration
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +  // Next.js requires unsafe-inline
    "style-src 'self' 'unsafe-inline'; " +   // Tailwind requires unsafe-inline
    "img-src 'self' data: https:; " +        // External article images
    "connect-src 'self'; " +
    "font-src 'self' data:;"
  );

  return response;
}

export const config = {
  matcher: '/:path*',
};
