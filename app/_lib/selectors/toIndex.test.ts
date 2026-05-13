import { describe, expect, it } from 'vitest';
import { combine } from '../combine';
import type {
  APIChanges,
  BusinessChanges,
  DataChanges,
  PRMeta,
  UIChanges,
} from '../types';
import { toIndex } from './toIndex';

const emptyMeta = (): PRMeta => ({
  owner: 'o',
  repo: 'r',
  number: 1,
  title: 't',
  subtitle: '',
  author: 'a',
  state: 'open',
  mergedAt: null,
  stateLabel: 'open',
  htmlUrl: '',
  headSha: 'sha',
});
const emptyUI = (): UIChanges => ({ description: '', changedComponents: [], screenshots: [] });
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
  domains: [] as string[],
  ui: emptyUI(),
  api: emptyAPI(),
  data: emptyData(),
  business: emptyBusiness(),
  edges: [] as never[],
});

describe('toIndex', () => {
  describe('Given an empty ChangeSet', () => {
    it('then returns no groups', () => {
      expect(toIndex(combine(baseInput()))).toEqual([]);
    });
  });

  describe('Given one change per kind', () => {
    it('then returns one group per kind in page → api → table → rule order', () => {
      const result = toIndex(
        combine({
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
        }),
      );
      expect(result.map((g) => g.kind)).toEqual(['page', 'api', 'table', 'rule']);
    });
  });

  describe('Given an api row', () => {
    it('then its label combines method and path', () => {
      const result = toIndex(
        combine({
          ...baseInput(),
          api: {
            ...emptyAPI(),
            endpoints: [
              {
                method: 'POST',
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
        }),
      );
      expect(result[0].rows[0].label).toBe('POST /api/x');
    });
  });

  describe('Given a kind with no changes', () => {
    it('then its group is omitted entirely', () => {
      const result = toIndex(
        combine({
          ...baseInput(),
          ui: {
            ...emptyUI(),
            screenshots: [{ path: '/x', name: 'X', beforeUrl: null, afterUrl: 'a' }],
          },
        }),
      );
      expect(result.map((g) => g.kind)).toEqual(['page']);
    });
  });
});
