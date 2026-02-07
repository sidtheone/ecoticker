import { GET, POST } from '@/app/api/cron/batch/route';
import { NextRequest, NextResponse } from 'next/server';

// Mock the seed endpoint
jest.mock('@/app/api/seed/route', () => ({
  POST: jest.fn(),
}));

import { POST as seedPOST } from '@/app/api/seed/route';
const mockSeedPOST = seedPOST as jest.MockedFunction<typeof seedPOST>;

describe('/api/cron/batch', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('GET endpoint', () => {
    it('should return 500 when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({ error: 'Service misconfigured' });
    });

    it('should return 401 when authorization header is missing', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when authorization header is invalid', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer wrong-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when authorization header format is invalid', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'test-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should execute batch job successfully with valid auth', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json({
          success: true,
          message: 'Database seeded successfully',
          stats: { topics: 10, articles: 40, scoreHistory: 70 },
          timestamp: '2026-02-07T22:00:00.000Z',
        })
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        timestamp: expect.any(String),
        durationMs: expect.any(Number),
        stats: { topics: 10, articles: 40, scoreHistory: 70 },
        message: 'Database seeded successfully',
      });

      expect(mockSeedPOST).toHaveBeenCalled();
    });

    it('should include stats from seed endpoint', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json({
          success: true,
          message: 'Database seeded successfully',
          stats: { topics: 5, articles: 20, scoreHistory: 35 },
          timestamp: '2026-02-07T22:00:00.000Z',
        })
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(data.stats).toEqual({ topics: 5, articles: 20, scoreHistory: 35 });
      expect(data.message).toBe('Database seeded successfully');
    });

    it('should return 500 when seed endpoint fails', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json(
          { error: 'Failed to seed database', details: 'DB connection error' },
          { status: 500 }
        )
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Batch job failed',
        timestamp: expect.any(String),
        details: 'Failed to seed database',
      });
    });

    it('should handle seed endpoint exceptions', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockRejectedValue(new Error('Seed crashed'));

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.details).toBe('Seed crashed');
    });
  });

  describe('POST endpoint', () => {
    it('should return 401 when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'POST',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when authorization is invalid', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-secret' },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should execute batch job with valid auth', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json({
          success: true,
          message: 'Database seeded successfully',
          stats: { topics: 10, articles: 40, scoreHistory: 70 },
          timestamp: '2026-02-07T22:00:00.000Z',
        })
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'POST',
        headers: { authorization: 'Bearer test-secret' },
        body: JSON.stringify({ force: true }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        timestamp: expect.any(String),
        manual: true,
        stats: { topics: 10, articles: 40, scoreHistory: 70 },
        message: 'Database seeded successfully',
      });
    });

    it('should handle empty request body', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json({
          success: true,
          message: 'Database seeded successfully',
          stats: { topics: 10, articles: 40, scoreHistory: 70 },
          timestamp: '2026-02-07T22:00:00.000Z',
        })
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'POST',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.manual).toBe(true);
    });

    it('should handle malformed JSON body', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json({
          success: true,
          message: 'Database seeded successfully',
          stats: { topics: 10, articles: 40, scoreHistory: 70 },
          timestamp: '2026-02-07T22:00:00.000Z',
        })
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        body: 'invalid json',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.manual).toBe(true);
    });

    it('should return 500 when seed endpoint fails', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockSeedPOST.mockResolvedValue(
        NextResponse.json(
          { error: 'Failed to seed database', details: 'DB connection error' },
          { status: 500 }
        )
      );

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'POST',
        headers: { authorization: 'Bearer test-secret' },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Batch job failed',
        timestamp: expect.any(String),
        details: 'Failed to seed database',
      });
    });
  });

  describe('Security', () => {
    it('should not leak CRON_SECRET in error messages', async () => {
      process.env.CRON_SECRET = 'super-secret-key-12345';

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer wrong-secret' },
      });

      const res = await GET(req);
      const data = await res.json();
      const responseText = JSON.stringify(data);

      expect(responseText).not.toContain('super-secret-key-12345');
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should log warning for unauthorized attempts', async () => {
      process.env.CRON_SECRET = 'test-secret';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer wrong-secret' },
      });

      await GET(req);

      expect(consoleSpy).toHaveBeenCalledWith('Unauthorized cron job attempt');

      consoleSpy.mockRestore();
    });

    it('should log error when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const req = new NextRequest('http://localhost:3000/api/cron/batch', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      await GET(req);

      expect(consoleSpy).toHaveBeenCalledWith('CRON_SECRET not set in environment variables');

      consoleSpy.mockRestore();
    });
  });
});
