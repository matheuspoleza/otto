import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFileForPath,
  collectPageScope,
  endpointMatcher,
  pageFileForRoute,
  prismaModelMatcher,
  traceStaticEdges,
} from './static-trace';

vi.mock('./adapters/github', () => ({
  getFileContent: vi.fn(),
  getRepoTree: vi.fn(),
}));

const { getFileContent, getRepoTree } = await import('./adapters/github');
const mockedGetFileContent = vi.mocked(getFileContent);
const mockedGetRepoTree = vi.mocked(getRepoTree);

describe('pageFileForRoute', () => {
  describe('Given the root route', () => {
    it('then returns app/page.tsx', () => {
      expect(pageFileForRoute('/')).toBe('app/page.tsx');
    });
  });

  describe('Given an empty string', () => {
    it('then also returns app/page.tsx', () => {
      expect(pageFileForRoute('')).toBe('app/page.tsx');
    });
  });

  describe('Given a simple top-level route', () => {
    it('then returns app/<segment>/page.tsx', () => {
      expect(pageFileForRoute('/pricing')).toBe('app/pricing/page.tsx');
    });
  });

  describe('Given a nested route with trailing slash', () => {
    it('then strips leading and trailing slashes', () => {
      expect(pageFileForRoute('/settings/team/')).toBe('app/settings/team/page.tsx');
    });
  });
});

describe('apiFileForPath', () => {
  describe('Given a static API path', () => {
    it('then returns app/<segments>/route.ts', () => {
      expect(apiFileForPath('/api/v1/health')).toBe('app/api/v1/health/route.ts');
    });
  });

  describe('Given an API path with {param} segments', () => {
    it('then converts {param} to Next bracket form', () => {
      expect(apiFileForPath('/api/v1/workspaces/{id}/usage')).toBe(
        'app/api/v1/workspaces/[id]/usage/route.ts',
      );
    });
  });

  describe('Given an API path with :param segments', () => {
    it('then converts :param to Next bracket form', () => {
      expect(apiFileForPath('/api/v1/users/:userId/tokens')).toBe(
        'app/api/v1/users/[userId]/tokens/route.ts',
      );
    });
  });
});

describe('endpointMatcher', () => {
  describe('Given a static path', () => {
    it('then matches that exact path in source text', () => {
      const matcher = endpointMatcher('/api/v1/health');
      expect(matcher.test('await fetch("/api/v1/health")')).toBe(true);
    });

    it('then does not match an unrelated path', () => {
      const matcher = endpointMatcher('/api/v1/health');
      expect(matcher.test('await fetch("/api/v2/health")')).toBe(false);
    });
  });

  describe('Given a path with {param} segments', () => {
    it('then matches a template literal that interpolates that segment', () => {
      const matcher = endpointMatcher('/api/v1/workspaces/{id}/usage');
      const source = 'fetch(`/api/v1/workspaces/${workspaceId}/usage`)';
      expect(matcher.test(source)).toBe(true);
    });

    it('then matches a concrete value substituted into that segment', () => {
      const matcher = endpointMatcher('/api/v1/workspaces/{id}/usage');
      expect(matcher.test('fetch("/api/v1/workspaces/abc-123/usage")')).toBe(true);
    });

    it('then does not match if a non-param segment differs', () => {
      const matcher = endpointMatcher('/api/v1/workspaces/{id}/usage');
      expect(matcher.test('fetch("/api/v1/teams/abc/usage")')).toBe(false);
    });
  });
});

describe('prismaModelMatcher', () => {
  describe('Given a PascalCase table name', () => {
    it('then matches the corresponding prisma.<camelCase> accessor', () => {
      const matcher = prismaModelMatcher('AIUsageEvent');
      expect(matcher.test('await prisma.aIUsageEvent.create({})')).toBe(true);
    });
  });

  describe('Given a single-word table name', () => {
    it('then matches prisma.<lowercased> as a whole word', () => {
      const matcher = prismaModelMatcher('User');
      expect(matcher.test('prisma.user.findMany()')).toBe(true);
    });

    it('then does not match a longer accessor that starts the same way', () => {
      const matcher = prismaModelMatcher('User');
      expect(matcher.test('prisma.userProfile.findMany()')).toBe(false);
    });
  });
});

describe('traceStaticEdges', () => {
  const baseParams = { owner: 'o', repo: 'r', headSha: 'sha' };

  beforeEach(() => {
    mockedGetFileContent.mockReset();
    mockedGetRepoTree.mockReset();
    mockedGetRepoTree.mockResolvedValue({ entries: [] });
  });

  describe('Given a page that fetches an endpoint by literal path', () => {
    it('then emits a page→api edge', async () => {
      mockedGetRepoTree.mockResolvedValue({
        entries: [{ path: 'app/page.tsx', type: 'blob', sha: 's' }],
      });
      mockedGetFileContent.mockResolvedValue('fetch("/api/health")');

      const result = await traceStaticEdges({
        ...baseParams,
        pages: [{ id: 'page:/', routePath: '/' }],
        endpoints: [{ id: 'api:GET:/api/health', method: 'GET', path: '/api/health' }],
        tables: [],
      });

      expect(result.pageToApi).toEqual([
        { source: 'page:/', target: 'api:GET:/api/health', method: 'GET' },
      ]);
    });
  });

  describe('Given a page whose file cannot be fetched', () => {
    it('then emits no edges and does not throw', async () => {
      mockedGetRepoTree.mockResolvedValue({
        entries: [{ path: 'app/page.tsx', type: 'blob', sha: 's' }],
      });
      mockedGetFileContent.mockRejectedValue(new Error('not found'));

      const result = await traceStaticEdges({
        ...baseParams,
        pages: [{ id: 'page:/', routePath: '/' }],
        endpoints: [{ id: 'api:GET:/api/health', method: 'GET', path: '/api/health' }],
        tables: [],
      });

      expect(result.pageToApi).toEqual([]);
    });
  });

  describe('Given an API route that calls prisma.<model>', () => {
    it('then emits an api→table edge', async () => {
      mockedGetRepoTree.mockResolvedValue({ entries: [] });
      mockedGetFileContent.mockResolvedValue('await prisma.user.findMany()');

      const result = await traceStaticEdges({
        ...baseParams,
        pages: [],
        endpoints: [{ id: 'api:GET:/api/users', method: 'GET', path: '/api/users' }],
        tables: [{ id: 'table:User', name: 'User' }],
      });

      expect(result.apiToTable).toEqual([
        { source: 'api:GET:/api/users', target: 'table:User' },
      ]);
    });
  });

  describe('Given no pages or endpoints', () => {
    it('then returns empty edges without fetching anything', async () => {
      const result = await traceStaticEdges({
        ...baseParams,
        pages: [],
        endpoints: [],
        tables: [],
      });

      expect(result).toEqual({ pageToApi: [], apiToTable: [] });
      expect(mockedGetFileContent).not.toHaveBeenCalled();
      expect(mockedGetRepoTree).not.toHaveBeenCalled();
    });
  });
});

describe('collectPageScope', () => {
  const baseArgs = { owner: 'o', repo: 'r', ref: 'sha' };

  describe('Given the page file itself in the tree', () => {
    it('then includes the page file in the result', async () => {
      const tree = [{ path: 'app/pricing/page.tsx', type: 'blob' }];
      const result = await collectPageScope({
        ...baseArgs,
        pageFile: 'app/pricing/page.tsx',
        tree,
      });
      expect(result).toEqual(['app/pricing/page.tsx']);
    });
  });

  describe('Given a sibling file in the same directory', () => {
    it('then includes that sibling', async () => {
      const tree = [
        { path: 'app/pricing/page.tsx', type: 'blob' },
        { path: 'app/pricing/PriceTable.tsx', type: 'blob' },
      ];
      const result = await collectPageScope({
        ...baseArgs,
        pageFile: 'app/pricing/page.tsx',
        tree,
      });
      expect(result).toContain('app/pricing/PriceTable.tsx');
    });
  });

  describe('Given a file in a nested subdirectory', () => {
    it('then excludes it (belongs to another route)', async () => {
      const tree = [
        { path: 'app/pricing/page.tsx', type: 'blob' },
        { path: 'app/pricing/enterprise/page.tsx', type: 'blob' },
      ];
      const result = await collectPageScope({
        ...baseArgs,
        pageFile: 'app/pricing/page.tsx',
        tree,
      });
      expect(result).not.toContain('app/pricing/enterprise/page.tsx');
    });
  });

  describe('Given a non-scanned file extension', () => {
    it('then excludes it', async () => {
      const tree = [
        { path: 'app/pricing/page.tsx', type: 'blob' },
        { path: 'app/pricing/styles.css', type: 'blob' },
        { path: 'app/pricing/icon.svg', type: 'blob' },
      ];
      const result = await collectPageScope({
        ...baseArgs,
        pageFile: 'app/pricing/page.tsx',
        tree,
      });
      expect(result).toEqual(['app/pricing/page.tsx']);
    });
  });

  describe('Given a tree entry that is not a blob', () => {
    it('then excludes it', async () => {
      const tree = [
        { path: 'app/pricing/page.tsx', type: 'blob' },
        { path: 'app/pricing/components', type: 'tree' },
      ];
      const result = await collectPageScope({
        ...baseArgs,
        pageFile: 'app/pricing/page.tsx',
        tree,
      });
      expect(result).toEqual(['app/pricing/page.tsx']);
    });
  });
});
