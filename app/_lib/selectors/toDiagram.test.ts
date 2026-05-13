import { describe, expect, it } from 'vitest';
import { combine } from '../combine';
import type {
  APIChanges,
  BusinessChanges,
  DataChanges,
  PRMeta,
  UIChanges,
} from '../types';
import { toDiagram } from './toDiagram';

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

describe('toDiagram', () => {
  describe('Given an empty ChangeSet', () => {
    it('then all three pillars are empty and edges are empty', () => {
      const model = toDiagram(combine(baseInput()));
      expect(model.pillars).toEqual({ ui: [], api: [], data: [] });
      expect(model.edges).toEqual([]);
    });
  });

  describe('Given a page change', () => {
    it('then it lands in the ui pillar', () => {
      const model = toDiagram(
        combine({
          ...baseInput(),
          ui: {
            ...emptyUI(),
            screenshots: [{ path: '/x', name: 'X', beforeUrl: null, afterUrl: 'a' }],
          },
        }),
      );
      expect(model.pillars.ui).toHaveLength(1);
      expect(model.pillars.ui[0]).toMatchObject({
        kind: 'page',
        label: 'X',
        status: 'added',
        ruleBadges: [],
      });
    });
  });

  describe('Given an api change with attached business rules', () => {
    it('then ruleBadges resolve to the rule changes', () => {
      const model = toDiagram(
        combine({
          ...baseInput(),
          api: {
            ...emptyAPI(),
            endpoints: [
              {
                method: 'POST',
                path: '/api/a',
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
            ],
          },
        }),
      );
      expect(model.pillars.api[0].ruleBadges).toEqual([
        { changeId: 'rule:R1', summary: 'R1' },
      ]);
    });
  });

  describe('Given an api change label', () => {
    it('then it combines method and path', () => {
      const model = toDiagram(
        combine({
          ...baseInput(),
          api: {
            ...emptyAPI(),
            endpoints: [
              {
                method: 'POST',
                path: '/api/users',
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
      expect(model.pillars.api[0].label).toBe('POST /api/users');
    });
  });

  describe('Given a table change', () => {
    it('then it lands in the data pillar', () => {
      const model = toDiagram(
        combine({
          ...baseInput(),
          data: { ...emptyData(), newTables: [{ name: 'Account', columns: [] }] },
        }),
      );
      expect(model.pillars.data).toHaveLength(1);
      expect(model.pillars.data[0].label).toBe('Account');
    });
  });

  describe('Given rule changes', () => {
    it('then they do NOT appear in any structural pillar', () => {
      const model = toDiagram(
        combine({
          ...baseInput(),
          business: {
            ...emptyBusiness(),
            rules: [
              { name: 'R1', beforeText: '', afterText: '', beforeExamples: [], afterExamples: [], highlights: [] },
            ],
          },
        }),
      );
      expect(model.pillars.ui).toHaveLength(0);
      expect(model.pillars.api).toHaveLength(0);
      expect(model.pillars.data).toHaveLength(0);
    });
  });

  describe('Given edges in the ChangeSet', () => {
    it('then they pass through unchanged', () => {
      const edge = {
        id: 'e1',
        source: 'page:/',
        target: 'api:GET:/api/x',
        label: 'GET' as const,
        status: 'modified' as const,
      };
      const model = toDiagram(combine({ ...baseInput(), edges: [edge] }));
      expect(model.edges).toEqual([edge]);
    });
  });
});
