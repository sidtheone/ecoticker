import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { NextRequest } from 'next/server';

describe('requireAdminKey', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should return true when X-API-Key matches ADMIN_API_KEY (timing-safe)', () => {
    process.env.ADMIN_API_KEY = 'test-admin-key-123';
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-api-key': 'test-admin-key-123' },
    });

    expect(requireAdminKey(req)).toBe(true);
  });

  it('should return false when X-API-Key does not match ADMIN_API_KEY', () => {
    process.env.ADMIN_API_KEY = 'test-admin-key-123';
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-api-key': 'wrong-key' },
    });

    expect(requireAdminKey(req)).toBe(false);
  });

  it('should return false when ADMIN_API_KEY is not set', () => {
    delete process.env.ADMIN_API_KEY;
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-api-key': 'some-key' },
    });

    expect(requireAdminKey(req)).toBe(false);
  });

  it('should return false when X-API-Key header is missing', () => {
    process.env.ADMIN_API_KEY = 'test-admin-key-123';
    const req = new NextRequest('http://localhost:3000/api/test');

    expect(requireAdminKey(req)).toBe(false);
  });

  it('should handle keys of different lengths without throwing', () => {
    process.env.ADMIN_API_KEY = 'short';
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-api-key': 'a-much-longer-key-that-differs-in-length' },
    });

    // Should not throw, just return false
    expect(() => requireAdminKey(req)).not.toThrow();
    expect(requireAdminKey(req)).toBe(false);
  });

  it('should use timing-safe comparison (crypto.timingSafeEqual)', async () => {
    // Verify the implementation uses timingSafeEqual by checking the module source
    const authModule = await import('@/lib/auth');
    const sourceFile = require('fs').readFileSync(
      require('path').resolve(__dirname, '../src/lib/auth.ts'),
      'utf-8'
    );
    expect(sourceFile).toContain('timingSafeEqual');
    expect(sourceFile).not.toMatch(/apiKey\s*===\s*adminKey/);
  });
});

describe('getUnauthorizedResponse', () => {
  it('should return 401 status with error message', () => {
    const res = getUnauthorizedResponse();
    expect(res.status).toBe(401);
  });
});
