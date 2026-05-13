import { describe, expect, it } from 'vitest';
import { buildRawGitHubURL, discoverScreenshots, slugifyRouteName } from './ui';
import type { PRLensConfigRoute, Viewport } from '../types';

describe('slugifyRouteName', () => {
  describe('Given a single PascalCase name', () => {
    it('then returns lowercase', () => {
      expect(slugifyRouteName('Pricing')).toBe('pricing');
    });
  });

  describe('Given a multi-word name with spaces', () => {
    it('then joins with hyphens', () => {
      expect(slugifyRouteName('Workspace Overview')).toBe('workspace-overview');
    });
  });

  describe('Given a name with special characters', () => {
    it('then strips them and collapses to hyphens', () => {
      expect(slugifyRouteName('Workspace / Settings!')).toBe('workspace-settings');
    });
  });
});

describe('buildRawGitHubURL', () => {
  describe('Given owner, repo, sha, and a file path', () => {
    it('then returns the raw.githubusercontent.com URL', () => {
      expect(
        buildRawGitHubURL('acme', 'demo', 'abc123', '.prlens/screenshots/pricing-desktop.after.png'),
      ).toBe(
        'https://raw.githubusercontent.com/acme/demo/abc123/.prlens/screenshots/pricing-desktop.after.png',
      );
    });
  });
});

const baseParams = {
  owner: 'acme',
  repo: 'demo',
  headSha: 'sha',
};

describe('discoverScreenshots', () => {
  describe('Given no routes', () => {
    it('then returns an empty array', () => {
      expect(
        discoverScreenshots({
          ...baseParams,
          routes: [],
          viewports: ['desktop'],
          treePaths: new Set(),
        }),
      ).toEqual([]);
    });
  });

  describe('Given a route whose both before and after files exist in the tree', () => {
    it('then returns one RouteScreenshot with both URLs populated', () => {
      const routes: PRLensConfigRoute[] = [{ path: '/pricing', name: 'Pricing' }];
      const viewports: Viewport[] = ['desktop'];
      const treePaths = new Set([
        '.prlens/screenshots/pricing-desktop.before.png',
        '.prlens/screenshots/pricing-desktop.after.png',
      ]);
      const result = discoverScreenshots({ ...baseParams, routes, viewports, treePaths });
      expect(result).toEqual([
        {
          path: '/pricing',
          name: 'Pricing',
          beforeUrl: 'https://raw.githubusercontent.com/acme/demo/sha/.prlens/screenshots/pricing-desktop.before.png',
          afterUrl: 'https://raw.githubusercontent.com/acme/demo/sha/.prlens/screenshots/pricing-desktop.after.png',
        },
      ]);
    });
  });

  describe('Given only the after file exists (new route)', () => {
    it('then beforeUrl is null and afterUrl is set', () => {
      const result = discoverScreenshots({
        ...baseParams,
        routes: [{ path: '/pricing', name: 'Pricing' }],
        viewports: ['desktop'],
        treePaths: new Set(['.prlens/screenshots/pricing-desktop.after.png']),
      });
      expect(result).toHaveLength(1);
      expect(result[0].beforeUrl).toBeNull();
      expect(result[0].afterUrl).toMatch(/pricing-desktop\.after\.png$/);
    });
  });

  describe('Given only the before file exists (removed route)', () => {
    it('then afterUrl is null and beforeUrl is set', () => {
      const result = discoverScreenshots({
        ...baseParams,
        routes: [{ path: '/legacy', name: 'Legacy' }],
        viewports: ['desktop'],
        treePaths: new Set(['.prlens/screenshots/legacy-desktop.before.png']),
      });
      expect(result).toHaveLength(1);
      expect(result[0].beforeUrl).toMatch(/legacy-desktop\.before\.png$/);
      expect(result[0].afterUrl).toBeNull();
    });
  });

  describe('Given a route where neither file exists', () => {
    it('then the route is omitted from the result', () => {
      const result = discoverScreenshots({
        ...baseParams,
        routes: [{ path: '/foo', name: 'Foo' }],
        viewports: ['desktop'],
        treePaths: new Set([]),
      });
      expect(result).toEqual([]);
    });
  });

  describe('Given multiple viewports configured', () => {
    it('then each viewport gets its own entry and the name is labeled', () => {
      const result = discoverScreenshots({
        ...baseParams,
        routes: [{ path: '/pricing', name: 'Pricing' }],
        viewports: ['desktop', 'mobile'],
        treePaths: new Set([
          '.prlens/screenshots/pricing-desktop.after.png',
          '.prlens/screenshots/pricing-mobile.after.png',
        ]),
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Pricing (desktop)');
      expect(result[1].name).toBe('Pricing (mobile)');
    });
  });

  describe('Given a single viewport configured', () => {
    it('then the name is not labeled with the viewport', () => {
      const result = discoverScreenshots({
        ...baseParams,
        routes: [{ path: '/pricing', name: 'Pricing' }],
        viewports: ['desktop'],
        treePaths: new Set(['.prlens/screenshots/pricing-desktop.after.png']),
      });
      expect(result[0].name).toBe('Pricing');
    });
  });

  describe('Given a multi-word route name', () => {
    it('then the slug derivation matches the file convention', () => {
      const result = discoverScreenshots({
        ...baseParams,
        routes: [{ path: '/workspaces/acme', name: 'Workspace Overview' }],
        viewports: ['desktop'],
        treePaths: new Set(['.prlens/screenshots/workspace-overview-desktop.after.png']),
      });
      expect(result).toHaveLength(1);
      expect(result[0].afterUrl).toMatch(/workspace-overview-desktop\.after\.png$/);
    });
  });
});
