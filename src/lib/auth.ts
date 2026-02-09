import { NextRequest, NextResponse } from 'next/server';

/**
 * Checks if the request includes a valid admin API key.
 * Compares the X-API-Key header against the ADMIN_API_KEY environment variable.
 *
 * @param request - The incoming Next.js request
 * @returns true if the API key is valid, false otherwise
 */
export function requireAdminKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error('ADMIN_API_KEY not configured in environment variables');
    return false;
  }

  return apiKey === adminKey;
}

/**
 * Returns a standardized 401 Unauthorized response.
 * Used when authentication fails on protected endpoints.
 *
 * @returns NextResponse with 401 status and error message
 */
export function getUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized - Valid API key required' },
    { status: 401, headers: { 'WWW-Authenticate': 'API-Key' } }
  );
}
