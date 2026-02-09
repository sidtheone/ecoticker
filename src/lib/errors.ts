import { NextResponse } from 'next/server';

/**
 * Centralized error handling utilities
 * Prevents information disclosure in production while maintaining debuggability
 */

/**
 * Create a safe error response
 * - In development: includes error details for debugging
 * - In production: hides implementation details to prevent information disclosure
 *
 * @param error - The error that occurred
 * @param userMessage - User-friendly error message (safe to expose)
 * @param statusCode - HTTP status code (default 500)
 * @returns NextResponse with appropriate error information
 */
export function createErrorResponse(
  error: unknown,
  userMessage: string,
  statusCode: number = 500
): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Always log the full error server-side for debugging
  console.error(`[${requestId}] ${userMessage}:`, error);

  // Return sanitized response based on environment
  return NextResponse.json(
    {
      error: userMessage,
      // Only include error details in development
      ...(isDev && error instanceof Error && { details: error.message }),
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}
