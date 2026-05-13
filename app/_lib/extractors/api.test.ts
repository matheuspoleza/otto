import { describe, expect, it } from 'vitest';
import { buildAPIChanges, diffOpenAPI, type RawAPIDiff } from './api';

describe('diffOpenAPI', () => {
  describe('Given two specs with empty paths', () => {
    it('then returns no changes', () => {
      const result = diffOpenAPI({ paths: {} }, { paths: {} });
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.modified).toEqual([]);
    });
  });

  describe('Given a path added in the after spec', () => {
    it('then reports the new endpoint as added with its method and path', () => {
      const before = { paths: {} };
      const after = {
        paths: {
          '/foo': { get: { responses: { '200': { description: 'ok' } } } },
        },
      };
      const result = diffOpenAPI(before, after);
      expect(result.added).toHaveLength(1);
      expect(result.added[0]).toMatchObject({ method: 'GET', path: '/foo' });
      expect(result.removed).toEqual([]);
      expect(result.modified).toEqual([]);
    });
  });

  describe('Given a path removed in the after spec', () => {
    it('then reports the missing endpoint as removed', () => {
      const before = {
        paths: { '/old': { get: { responses: { '200': { description: 'ok' } } } } },
      };
      const after = { paths: {} };
      const result = diffOpenAPI(before, after);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toMatchObject({ method: 'GET', path: '/old' });
      expect(result.added).toEqual([]);
    });
  });

  describe('Given a path with multiple methods where only one is added', () => {
    it('then reports only the new method as added (not all methods on the path)', () => {
      const before = {
        paths: {
          '/foo': { get: { responses: { '200': { description: 'ok' } } } },
        },
      };
      const after = {
        paths: {
          '/foo': {
            get: { responses: { '200': { description: 'ok' } } },
            post: { responses: { '201': { description: 'created' } } },
          },
        },
      };
      const result = diffOpenAPI(before, after);
      expect(result.added).toHaveLength(1);
      expect(result.added[0]).toMatchObject({ method: 'POST', path: '/foo' });
      expect(result.removed).toEqual([]);
    });
  });

  describe('Given a request body adds a NEW required property', () => {
    it('then the modified endpoint is flagged as breaking', () => {
      const makeSpec = (props: string[], required: string[]) => ({
        paths: {
          '/foo': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: Object.fromEntries(props.map((p) => [p, { type: 'string' }])),
                      required,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const before = makeSpec(['a'], ['a']);
      const after = makeSpec(['a', 'b'], ['a', 'b']);
      const result = diffOpenAPI(before, after);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].breaking).toBe(true);
      expect(result.modified[0].breakingReasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/required.*\bb\b/i)]),
      );
    });
  });

  describe('Given a request body adds an OPTIONAL property', () => {
    it('then the modified endpoint is NOT flagged as breaking', () => {
      const before = {
        paths: {
          '/foo': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
                  },
                },
              },
            },
          },
        },
      };
      const after = {
        paths: {
          '/foo': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { a: { type: 'string' }, b: { type: 'integer' } },
                      required: ['a'],
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = diffOpenAPI(before, after);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].breaking).toBe(false);
      expect(result.modified[0].breakingReasons).toEqual([]);
    });
  });

  describe('Given an existing endpoint whose operation changed (non-breaking)', () => {
    it('then reports it as modified with before/after operations', () => {
      const before = {
        paths: {
          '/foo': {
            post: {
              requestBody: {
                content: {
                  'application/json': { schema: { type: 'object', properties: { a: { type: 'string' } } } },
                },
              },
            },
          },
        },
      };
      const after = {
        paths: {
          '/foo': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' } } },
                  },
                },
              },
            },
          },
        },
      };
      const result = diffOpenAPI(before, after);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0]).toMatchObject({ method: 'POST', path: '/foo' });
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });
  });
});

describe('buildAPIChanges', () => {
  describe('Given an empty diff', () => {
    it('then returns empty description and no endpoints', () => {
      const result = buildAPIChanges({ added: [], removed: [], modified: [] });
      expect(result.description).toBe('');
      expect(result.endpoints).toEqual([]);
    });
  });

  describe('Given one added endpoint', () => {
    const diff: RawAPIDiff = {
      added: [
        {
          method: 'GET',
          path: '/foo',
          operation: {
            requestBody: {
              content: { 'application/json': { schema: { type: 'object', properties: { a: { type: 'string' } } } } },
            },
            responses: {
              '200': {
                content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } },
              },
            },
          },
        },
      ],
      removed: [],
      modified: [],
    };

    it('then description says "Adds 1 new endpoint."', () => {
      expect(buildAPIChanges(diff).description).toBe('Adds 1 new endpoint.');
    });

    it('then the endpoint has changeType "added"', () => {
      expect(buildAPIChanges(diff).endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/foo',
        changeType: 'added',
      });
    });

    it('then requestBefore is null (endpoint did not exist before)', () => {
      expect(buildAPIChanges(diff).endpoints[0].requestBefore).toBeNull();
    });

    it('then requestAfter is extracted from the operation schema', () => {
      expect(buildAPIChanges(diff).endpoints[0].requestAfter).toEqual({
        type: 'object',
        properties: { a: { type: 'string' } },
      });
    });

    it('then responseAfter is extracted from the first 2xx response schema', () => {
      expect(buildAPIChanges(diff).endpoints[0].responseAfter).toEqual({
        type: 'object',
        properties: { ok: { type: 'boolean' } },
      });
    });
  });

  describe('Given multiple added endpoints', () => {
    it('then description uses plural', () => {
      const diff: RawAPIDiff = {
        added: [
          { method: 'GET', path: '/a', operation: {} },
          { method: 'GET', path: '/b', operation: {} },
        ],
        removed: [],
        modified: [],
      };
      expect(buildAPIChanges(diff).description).toBe('Adds 2 new endpoints.');
    });
  });

  describe('Given a removed endpoint', () => {
    const diff: RawAPIDiff = {
      added: [],
      removed: [
        {
          method: 'DELETE',
          path: '/foo',
          operation: {
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      ],
      modified: [],
    };

    it('then changeType is "removed"', () => {
      expect(buildAPIChanges(diff).endpoints[0]).toMatchObject({
        method: 'DELETE',
        path: '/foo',
        changeType: 'removed',
      });
    });

    it('then requestAfter is null (endpoint no longer exists)', () => {
      expect(buildAPIChanges(diff).endpoints[0].requestAfter).toBeNull();
    });

    it('then requestBefore is extracted from the previous operation', () => {
      expect(buildAPIChanges(diff).endpoints[0].requestBefore).toEqual({ type: 'object' });
    });

    it('then description mentions the removal', () => {
      expect(buildAPIChanges(diff).description).toMatch(/removes/i);
    });
  });

  describe('Given a non-breaking modified endpoint', () => {
    const diff: RawAPIDiff = {
      added: [],
      removed: [],
      modified: [
        {
          method: 'POST',
          path: '/foo',
          before: { requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } },
          after: {
            requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { x: {} } } } } },
          },
          breaking: false,
          breakingReasons: [],
        },
      ],
    };

    it('then changeType is "modified" (not "breaking")', () => {
      expect(buildAPIChanges(diff).endpoints[0].changeType).toBe('modified');
    });

    it('then requestBefore and requestAfter are both populated', () => {
      const ep = buildAPIChanges(diff).endpoints[0];
      expect(ep.requestBefore).toEqual({ type: 'object' });
      expect(ep.requestAfter).toEqual({ type: 'object', properties: { x: {} } });
    });
  });

  describe('Given a breaking modified endpoint', () => {
    const diff: RawAPIDiff = {
      added: [],
      removed: [],
      modified: [
        {
          method: 'POST',
          path: '/foo',
          before: {},
          after: {},
          breaking: true,
          breakingReasons: ['New required request property: b'],
        },
      ],
    };

    it('then changeType is "breaking"', () => {
      expect(buildAPIChanges(diff).endpoints[0].changeType).toBe('breaking');
    });

    it('then breakingReason is joined from the diff reasons', () => {
      expect(buildAPIChanges(diff).endpoints[0].breakingReason).toBe(
        'New required request property: b',
      );
    });
  });
});
