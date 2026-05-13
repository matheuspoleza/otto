import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractEdges } from './edges';
import type { APIChanges, DataChanges, UIChanges } from '../types';

vi.mock('../adapters/github', () => ({
  getFileContent: vi.fn(),
  getRepoTree: vi.fn(),
}));

const { getFileContent, getRepoTree } = await import('../adapters/github');
const mockedGetFileContent = vi.mocked(getFileContent);
const mockedGetRepoTree = vi.mocked(getRepoTree);

const emptyUI = (): UIChanges => ({ description: '', changedComponents: [], screenshots: [] });
const emptyAPI = (): APIChanges => ({ description: '', endpoints: [] });
const emptyData = (): DataChanges => ({
  description: '',
  newTables: [],
  modifiedTables: [],
  droppedTables: [],
  isReversible: true,
});

const baseArgs = { owner: 'o', repo: 'r', headSha: 'sha' };

describe('extractEdges', () => {
  beforeEach(() => {
    mockedGetFileContent.mockReset();
    mockedGetRepoTree.mockReset();
    mockedGetRepoTree.mockResolvedValue({ entries: [] });
    mockedGetFileContent.mockResolvedValue(null);
  });

  describe('Given no pages and no endpoints', () => {
    it('then returns no edges and skips all I/O', async () => {
      const result = await extractEdges({
        ...baseArgs,
        ui: emptyUI(),
        api: emptyAPI(),
        data: emptyData(),
      });
      expect(result).toEqual([]);
      expect(mockedGetFileContent).not.toHaveBeenCalled();
      expect(mockedGetRepoTree).not.toHaveBeenCalled();
    });
  });

  describe('Given a page whose source calls an endpoint and an endpoint that calls prisma', () => {
    it('then emits a page→api and an api→table edge', async () => {
      mockedGetRepoTree.mockResolvedValue({
        entries: [{ path: 'app/page.tsx', type: 'blob', sha: 's' }],
      });
      mockedGetFileContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'app/page.tsx') return 'fetch("/api/users")';
        if (path === 'app/api/users/route.ts') return 'await prisma.user.findMany()';
        return null;
      });

      const result = await extractEdges({
        ...baseArgs,
        ui: {
          ...emptyUI(),
          screenshots: [{ path: '/', name: 'Home', beforeUrl: 'b', afterUrl: 'a' }],
        },
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'GET',
              path: '/api/users',
              changeType: 'modified',
              requestBefore: null,
              requestAfter: null,
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
          ],
        },
        data: { ...emptyData(), newTables: [{ name: 'User', columns: [] }] },
      });

      expect(result).toEqual([
        {
          id: 'edge:page:/->api:GET:/api/users',
          source: 'page:/',
          target: 'api:GET:/api/users',
          label: 'GET',
          status: 'modified',
        },
        {
          id: 'edge:api:GET:/api/users->table:User',
          source: 'api:GET:/api/users',
          target: 'table:User',
          label: 'writes',
          status: 'modified',
        },
      ]);
    });
  });

  describe('Given an endpoint with an unusual method', () => {
    it('then the edge label is null', async () => {
      mockedGetFileContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'app/page.tsx') return 'fetch("/api/x")';
        return null;
      });
      mockedGetRepoTree.mockResolvedValue({
        entries: [{ path: 'app/page.tsx', type: 'blob', sha: 's' }],
      });

      const result = await extractEdges({
        ...baseArgs,
        ui: {
          ...emptyUI(),
          screenshots: [{ path: '/', name: 'Home', beforeUrl: 'b', afterUrl: 'a' }],
        },
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'HEAD',
              path: '/api/x',
              changeType: 'modified',
              requestBefore: null,
              requestAfter: null,
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
          ],
        },
        data: emptyData(),
      });

      expect(result[0].label).toBeNull();
    });
  });
});
