/**
 * Tests for src/app/robots.ts — generates robots.txt metadata
 *
 * Covers:
 * - Returns correct structure with userAgent, allow, disallow rules
 * - Disallows /api/ path
 * - Includes sitemap URL pointing to production
 */

import robots from '@/app/robots';

describe('robots.ts', () => {
  it('returns rules with userAgent "*"', () => {
    const result = robots();
    expect(result.rules).toBeDefined();
    // rules can be an object or array — this file uses a single object
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.userAgent).toBe('*');
  });

  it('allows root path "/"', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.allow).toBe('/');
  });

  it('disallows /api/ path', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.disallow).toBe('/api/');
  });

  it('includes sitemap URL pointing to production domain', () => {
    const result = robots();
    expect(result.sitemap).toBe('https://ecoticker.sidsinsights.com/sitemap.xml');
  });

  it('returns a well-formed MetadataRoute.Robots object', () => {
    const result = robots();
    expect(result).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: '/api/' },
      sitemap: 'https://ecoticker.sidsinsights.com/sitemap.xml',
    });
  });
});
