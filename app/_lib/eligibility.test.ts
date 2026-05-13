import { describe, expect, it } from 'vitest';
import { parseConfig, resolvePath } from './eligibility';

describe('parseConfig', () => {
  describe('Given malformed JSON', () => {
    it('then returns null', () => {
      expect(parseConfig('{ not json')).toBeNull();
    });
  });

  describe('Given valid JSON that is not an object', () => {
    it('then returns null for an array', () => {
      expect(parseConfig('[]')).toBeNull();
    });
    it('then returns null for a string', () => {
      expect(parseConfig('"hello"')).toBeNull();
    });
  });

  describe('Given an empty object', () => {
    it('then returns an empty config', () => {
      expect(parseConfig('{}')).toEqual({});
    });
  });

  describe('Given a config with openapi and prisma paths', () => {
    it('then captures both paths', () => {
      const raw = JSON.stringify({ openapi: 'spec.yaml', prisma: 'db/schema.prisma' });
      expect(parseConfig(raw)).toEqual({
        openapi: 'spec.yaml',
        prisma: 'db/schema.prisma',
      });
    });
  });

  describe('Given a config with non-string openapi field', () => {
    it('then drops it silently', () => {
      const raw = JSON.stringify({ openapi: 42, prisma: 'x' });
      expect(parseConfig(raw)).toEqual({ prisma: 'x' });
    });
  });

  describe('Given a config with valid viewports', () => {
    it('then keeps only desktop and mobile', () => {
      const raw = JSON.stringify({ viewports: ['desktop', 'mobile', 'tablet', 'watch'] });
      expect(parseConfig(raw)?.viewports).toEqual(['desktop', 'mobile']);
    });
  });

  describe('Given a config where viewports has no valid entries', () => {
    it('then omits the viewports field', () => {
      const raw = JSON.stringify({ viewports: ['tablet', 'watch'] });
      expect(parseConfig(raw)?.viewports).toBeUndefined();
    });
  });

  describe('Given a preview with an invalid provider', () => {
    it('then drops the preview entirely', () => {
      const raw = JSON.stringify({ preview: { provider: 'aws', routes: [] } });
      expect(parseConfig(raw)?.preview).toBeUndefined();
    });
  });

  describe('Given a preview with valid provider and well-formed routes', () => {
    it('then keeps the routes in order', () => {
      const raw = JSON.stringify({
        preview: {
          provider: 'vercel',
          routes: [
            { path: '/', name: 'Landing' },
            { path: '/pricing', name: 'Pricing' },
          ],
        },
      });
      expect(parseConfig(raw)?.preview).toEqual({
        provider: 'vercel',
        routes: [
          { path: '/', name: 'Landing' },
          { path: '/pricing', name: 'Pricing' },
        ],
      });
    });
  });

  describe('Given a preview with some malformed route entries', () => {
    it('then keeps only the well-formed ones', () => {
      const raw = JSON.stringify({
        preview: {
          provider: 'vercel',
          routes: [
            { path: '/ok', name: 'OK' },
            { path: '/missing-name' },
            { name: 'missing-path' },
            'not-an-object',
            null,
          ],
        },
      });
      expect(parseConfig(raw)?.preview?.routes).toEqual([{ path: '/ok', name: 'OK' }]);
    });
  });

  describe('Given a preview without a routes array', () => {
    it('then drops the preview', () => {
      const raw = JSON.stringify({ preview: { provider: 'vercel' } });
      expect(parseConfig(raw)?.preview).toBeUndefined();
    });
  });
});

describe('resolvePath', () => {
  const paths = new Set(['openapi.yaml', 'specs/openapi.yaml', 'prisma/schema.prisma']);

  describe('Given a declared path that exists in the repo', () => {
    it('then returns the declared path', () => {
      expect(resolvePath({ declared: 'openapi.yaml', candidates: [], paths })).toBe(
        'openapi.yaml',
      );
    });
  });

  describe('Given a declared path that does NOT exist in the repo', () => {
    it('then returns null (does not fall back to candidates)', () => {
      expect(
        resolvePath({
          declared: 'missing.yaml',
          candidates: ['openapi.yaml'],
          paths,
        }),
      ).toBeNull();
    });
  });

  describe('Given no declared path and the first candidate exists', () => {
    it('then returns the first candidate', () => {
      expect(
        resolvePath({
          candidates: ['openapi.yaml', 'specs/openapi.yaml'],
          paths,
        }),
      ).toBe('openapi.yaml');
    });
  });

  describe('Given no declared path and only a later candidate exists', () => {
    it('then returns the first matching candidate in order', () => {
      expect(
        resolvePath({
          candidates: ['nonexistent.yaml', 'specs/openapi.yaml'],
          paths,
        }),
      ).toBe('specs/openapi.yaml');
    });
  });

  describe('Given no declared path and no candidate matches', () => {
    it('then returns null', () => {
      expect(
        resolvePath({
          candidates: ['nope.yaml', 'also-nope.yaml'],
          paths,
        }),
      ).toBeNull();
    });
  });
});
