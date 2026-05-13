import { describe, expect, it } from 'vitest';
import { combine, pageId, ruleId, tableId } from './combine';
import type {
  APIChanges,
  ApiChange,
  BusinessChanges,
  DataChanges,
  PRMeta,
  RuleChange,
  TableChange,
  UIChanges,
} from './types';

const emptyMeta = (): PRMeta => ({
  owner: 'acme',
  repo: 'web',
  number: 1,
  title: 't',
  subtitle: '',
  author: 'a',
  state: 'open',
  mergedAt: null,
  stateLabel: 'Open',
  htmlUrl: '',
  headSha: 'sha',
});

const emptyUI = (): UIChanges => ({
  description: '',
  changedComponents: [],
  screenshots: [],
});

const emptyAPI = (): APIChanges => ({ description: '', endpoints: [] });

const emptyData = (): DataChanges => ({
  description: '',
  newTables: [],
  modifiedTables: [],
  droppedTables: [],
  isReversible: true,
});

const emptyBusiness = (): BusinessChanges => ({ description: '', rules: [] });

const baseInput = () => ({
  meta: emptyMeta(),
  domains: [],
  ui: emptyUI(),
  api: emptyAPI(),
  data: emptyData(),
  business: emptyBusiness(),
  edges: [],
});

describe('combine', () => {
  describe('Given all pillars empty', () => {
    it('then returns an empty ChangeSet preserving meta and domains', () => {
      const result = combine({ ...baseInput(), domains: ['Billing'] });
      expect(result.meta).toEqual(emptyMeta());
      expect(result.domains).toEqual(['Billing']);
      expect(result.changes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('Given a new page screenshot', () => {
    it('then emits a page Change with status "added" and pageId', () => {
      const result = combine({
        ...baseInput(),
        ui: {
          ...emptyUI(),
          screenshots: [
            { path: '/pricing', name: 'Pricing', beforeUrl: null, afterUrl: 'a.png' },
          ],
        },
      });
      expect(result.changes).toEqual([
        {
          kind: 'page',
          id: pageId('/pricing'),
          route: '/pricing',
          name: 'Pricing',
          status: 'added',
          preview: { kind: 'page', afterUrl: 'a.png', routePath: '/pricing' },
          detail: {
            screenshot: { path: '/pricing', name: 'Pricing', beforeUrl: null, afterUrl: 'a.png' },
          },
        },
      ]);
    });
  });

  describe('Given a removed page screenshot', () => {
    it('then page Change has status "removed"', () => {
      const result = combine({
        ...baseInput(),
        ui: {
          ...emptyUI(),
          screenshots: [
            { path: '/x', name: 'X', beforeUrl: 'b.png', afterUrl: null },
          ],
        },
      });
      expect(result.changes[0].status).toBe('removed');
    });
  });

  describe('Given an endpoint with changeType "added"', () => {
    it('then preview hint is "New endpoint"', () => {
      const result = combine({
        ...baseInput(),
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'POST',
              path: '/api/v1/users',
              changeType: 'added',
              requestBefore: null,
              requestAfter: { name: 'x' },
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
          ],
        },
      });
      const change = result.changes[0];
      expect(change.kind).toBe('api');
      expect(change.kind === 'api' && change.preview.hint).toBe('New endpoint');
    });
  });

  describe('Given a modified endpoint with request and response field deltas', () => {
    it('then api hint reports +/- counts per side', () => {
      const result = combine({
        ...baseInput(),
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'PATCH',
              path: '/api/v1/users',
              changeType: 'modified',
              requestBefore: { name: 'x' },
              requestAfter: { name: 'x', email: 'y', age: 1 },
              responseBefore: { id: 'x', name: 'x' },
              responseAfter: { id: 'x' },
              breakingReason: null,
            },
          ],
        },
      });
      const change = result.changes[0];
      expect(change.kind === 'api' && change.preview.hint).toBe('+2 request · -1 response');
    });
  });

  describe('Given a breaking endpoint with a breakingReason', () => {
    it('then api hint surfaces the reason', () => {
      const result = combine({
        ...baseInput(),
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'POST',
              path: '/api/v1/users',
              changeType: 'breaking',
              requestBefore: { name: 'x' },
              requestAfter: { name: 'x', email: 'y' },
              responseBefore: null,
              responseAfter: null,
              breakingReason: 'required field added',
            },
          ],
        },
      });
      const change = result.changes[0];
      expect(change.kind === 'api' && change.preview.hint).toBe('required field added');
    });
  });

  describe('Given a new table with more than 3 columns', () => {
    it('then preview keeps the first 3 hints and reports the rest as moreCount', () => {
      const result = combine({
        ...baseInput(),
        data: {
          ...emptyData(),
          newTables: [
            {
              name: 'Account',
              columns: [
                { name: 'id', type: 'TEXT' },
                { name: 'name', type: 'TEXT' },
                { name: 'createdAt', type: 'TIMESTAMP' },
                { name: 'updatedAt', type: 'TIMESTAMP' },
                { name: 'deletedAt', type: 'TIMESTAMP' },
              ],
            },
          ],
        },
      });
      const change = result.changes[0];
      expect(change.kind).toBe('table');
      if (change.kind !== 'table') return;
      expect(change.preview.columnHints).toEqual([
        { prefix: '+', name: 'id' },
        { prefix: '+', name: 'name' },
        { prefix: '+', name: 'createdAt' },
      ]);
      expect(change.preview.moreCount).toBe(2);
      expect(change.detail).toEqual({
        variant: 'new',
        table: result.changes[0].kind === 'table'
          ? (change.detail as { variant: 'new'; table: unknown }).table
          : undefined,
      });
    });
  });

  describe('Given a dropped table', () => {
    it('then emits a Change with status "removed" and detail variant "dropped"', () => {
      const result = combine({
        ...baseInput(),
        data: { ...emptyData(), droppedTables: ['LegacyAccount'] },
      });
      expect(result.changes[0]).toMatchObject({
        kind: 'table',
        id: tableId('LegacyAccount'),
        status: 'removed',
        detail: { variant: 'dropped', name: 'LegacyAccount' },
        preview: { kind: 'table', tableName: 'LegacyAccount', isDropped: true },
      });
    });
  });

  describe('Given a modified table with added, type-changed and dropped columns', () => {
    it('then preview hints mix +, ~ and - prefixes in that order', () => {
      const result = combine({
        ...baseInput(),
        data: {
          ...emptyData(),
          modifiedTables: [
            {
              name: 'Account',
              addedColumns: [{ name: 'tier', type: 'TEXT' }],
              typeChanges: [{ column: 'createdAt', before: 'DATE', after: 'TIMESTAMP' }],
              droppedColumns: ['legacyFlag'],
            },
          ],
        },
      });
      const change = result.changes[0];
      if (change.kind !== 'table') throw new Error('expected table');
      expect(change.preview.columnHints).toEqual([
        { prefix: '+', name: 'tier' },
        { prefix: '~', name: 'createdAt' },
        { prefix: '-', name: 'legacyFlag' },
      ]);
    });
  });

  describe('Given business rules and multiple endpoints', () => {
    it('then distributes rule ids across api Changes round-robin', () => {
      const result = combine({
        ...baseInput(),
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'GET',
              path: '/api/a',
              changeType: 'modified',
              requestBefore: null,
              requestAfter: null,
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
            {
              method: 'POST',
              path: '/api/b',
              changeType: 'modified',
              requestBefore: null,
              requestAfter: null,
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
          ],
        },
        business: {
          ...emptyBusiness(),
          rules: [
            { name: 'R1', beforeText: '', afterText: '', beforeExamples: [], afterExamples: [], highlights: [] },
            { name: 'R2', beforeText: '', afterText: '', beforeExamples: [], afterExamples: [], highlights: [] },
            { name: 'R3', beforeText: '', afterText: '', beforeExamples: [], afterExamples: [], highlights: [] },
          ],
        },
      });
      const apis = result.changes.filter((c): c is ApiChange => c.kind === 'api');
      expect(apis[0].ruleIds).toEqual([ruleId('R1'), ruleId('R3')]);
      expect(apis[1].ruleIds).toEqual([ruleId('R2')]);
    });
  });

  describe('Given business rules but no endpoints', () => {
    it('then rule Changes have attachedToId = null', () => {
      const result = combine({
        ...baseInput(),
        business: {
          ...emptyBusiness(),
          rules: [
            { name: 'R1', beforeText: '', afterText: '', beforeExamples: [], afterExamples: [], highlights: [] },
          ],
        },
      });
      const rule = result.changes.find((c): c is RuleChange => c.kind === 'rule');
      expect(rule?.attachedToId).toBeNull();
    });
  });

  describe('Given the same input in different orders', () => {
    it('then changes are ordered page → api → table → rule', () => {
      const result = combine({
        ...baseInput(),
        ui: {
          ...emptyUI(),
          screenshots: [{ path: '/x', name: 'X', beforeUrl: null, afterUrl: 'a' }],
        },
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'GET',
              path: '/api/x',
              changeType: 'added',
              requestBefore: null,
              requestAfter: null,
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
          ],
        },
        data: { ...emptyData(), newTables: [{ name: 'T', columns: [] }] },
        business: {
          ...emptyBusiness(),
          rules: [
            { name: 'R', beforeText: '', afterText: '', beforeExamples: [], afterExamples: [], highlights: [] },
          ],
        },
      });
      expect(result.changes.map((c) => c.kind)).toEqual(['page', 'api', 'table', 'rule']);
    });
  });

  describe('Given edges in the input', () => {
    it('then edges pass through unchanged', () => {
      const edge = {
        id: 'e1',
        source: 'page:/',
        target: 'api:GET:/api/x',
        label: 'GET' as const,
        status: 'modified' as const,
      };
      const result = combine({ ...baseInput(), edges: [edge] });
      expect(result.edges).toEqual([edge]);
    });
  });

  describe('Given the round-robin pairing of N rules and M endpoints', () => {
    it('then every rule is reachable via at least one api Change', () => {
      const rules = ['R1', 'R2', 'R3', 'R4', 'R5'].map((name) => ({
        name,
        beforeText: '',
        afterText: '',
        beforeExamples: [],
        afterExamples: [],
        highlights: [],
      }));
      const endpoints = ['/a', '/b'].map((p) => ({
        method: 'GET' as const,
        path: p,
        changeType: 'modified' as const,
        requestBefore: null,
        requestAfter: null,
        responseBefore: null,
        responseAfter: null,
        breakingReason: null,
      }));
      const result = combine({
        ...baseInput(),
        api: { ...emptyAPI(), endpoints },
        business: { ...emptyBusiness(), rules },
      });
      const allRuleIds = result.changes
        .filter((c): c is TableChange | ApiChange => c.kind === 'api')
        .flatMap((c): string[] => (c.kind === 'api' ? c.ruleIds : []));
      for (const rule of rules) {
        expect(allRuleIds).toContain(ruleId(rule.name));
      }
    });
  });

  describe('Given the api endpoint id', () => {
    it('then it follows the `api:METHOD:PATH` shape', () => {
      const result = combine({
        ...baseInput(),
        api: {
          ...emptyAPI(),
          endpoints: [
            {
              method: 'POST',
              path: '/api/v1/users',
              changeType: 'added',
              requestBefore: null,
              requestAfter: null,
              responseBefore: null,
              responseAfter: null,
              breakingReason: null,
            },
          ],
        },
      });
      expect(result.changes[0].id).toBe('api:POST:/api/v1/users');
    });
  });
});
