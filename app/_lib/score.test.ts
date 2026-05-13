import { describe, expect, it } from 'vitest';
import {
  deriveDomains,
  detectSignals,
  materializeSignals,
  scoreRisk,
  type SignalContext,
} from './score';
import type { APIChanges, DataChanges } from './types';

const emptyAPI = (): APIChanges => ({
  count: 0,
  description: '',
  endpoints: [],
  warning: null,
});

const emptyData = (): DataChanges => ({
  count: 0,
  description: '',
  newTables: [],
  modifiedTables: [],
  droppedTables: [],
  isReversible: true,
  warning: null,
});

const ctx = (overrides: Partial<SignalContext> = {}): SignalContext => ({
  prChanges: 0,
  changedFileCount: 0,
  files: [],
  api: emptyAPI(),
  data: emptyData(),
  ...overrides,
});

describe('detectSignals', () => {
  describe('Given a file path containing "billing"', () => {
    it('then emits touches_billing', () => {
      const result = detectSignals(ctx({ files: [{ filename: 'lib/billing.ts', status: 'added' }] }));
      expect(result).toContain('touches_billing');
    });
  });

  describe('Given a data pillar with a Subscription table', () => {
    it('then emits touches_billing via table-name match', () => {
      const result = detectSignals(
        ctx({
          data: {
            ...emptyData(),
            newTables: [{ name: 'Subscription', columns: [] }],
            count: 1,
          },
        }),
      );
      expect(result).toContain('touches_billing');
    });
  });

  describe('Given paths with /auth/ or session', () => {
    it('then emits touches_auth', () => {
      const result = detectSignals(ctx({ files: [{ filename: 'lib/auth/session.ts', status: 'modified' }] }));
      expect(result).toContain('touches_auth');
    });
  });

  describe('Given an API pillar with a breaking endpoint', () => {
    it('then emits breaking_api', () => {
      const result = detectSignals(
        ctx({
          api: {
            ...emptyAPI(),
            count: 1,
            endpoints: [
              {
                method: 'POST',
                path: '/x',
                changeType: 'breaking',
                requestBefore: null,
                requestAfter: null,
                responseBefore: null,
                responseAfter: null,
                breakingReason: 'r',
              },
            ],
          },
        }),
      );
      expect(result).toContain('breaking_api');
    });
  });

  describe('Given an API pillar with only added endpoints', () => {
    it('then does NOT emit breaking_api', () => {
      const result = detectSignals(
        ctx({
          api: {
            ...emptyAPI(),
            count: 1,
            endpoints: [
              {
                method: 'GET',
                path: '/x',
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
      expect(result).not.toContain('breaking_api');
    });
  });

  describe('Given a data pillar with isReversible=false and count>0', () => {
    it('then emits irreversible_migration', () => {
      const result = detectSignals(
        ctx({ data: { ...emptyData(), isReversible: false, count: 1 } }),
      );
      expect(result).toContain('irreversible_migration');
    });
  });

  describe('Given prChanges >= 500', () => {
    it('then emits large_diff_500_plus', () => {
      expect(detectSignals(ctx({ prChanges: 500 }))).toContain('large_diff_500_plus');
    });
  });

  describe('Given prChanges < 500', () => {
    it('then does NOT emit large_diff_500_plus', () => {
      expect(detectSignals(ctx({ prChanges: 499 }))).not.toContain('large_diff_500_plus');
    });
  });

  describe('Given a test file added in the PR', () => {
    it('then emits tests_added (not no_tests_added)', () => {
      const result = detectSignals(
        ctx({ files: [{ filename: 'app/foo.test.tsx', status: 'added' }] }),
      );
      expect(result).toContain('tests_added');
      expect(result).not.toContain('no_tests_added');
    });
  });

  describe('Given no test files added', () => {
    it('then emits no_tests_added', () => {
      const result = detectSignals(
        ctx({ files: [{ filename: 'app/foo.tsx', status: 'modified' }] }),
      );
      expect(result).toContain('no_tests_added');
    });
  });

  describe('Given 1 changed file with < 100 line changes', () => {
    it('then emits small_isolated_change', () => {
      expect(detectSignals(ctx({ changedFileCount: 1, prChanges: 50 }))).toContain(
        'small_isolated_change',
      );
    });
  });

  describe('Given 1 file but 100+ lines changed', () => {
    it('then does NOT emit small_isolated_change', () => {
      expect(detectSignals(ctx({ changedFileCount: 1, prChanges: 100 }))).not.toContain(
        'small_isolated_change',
      );
    });
  });
});

describe('scoreRisk', () => {
  describe('Given no signals', () => {
    it('then returns the baseline 30 / Low', () => {
      expect(scoreRisk([])).toEqual({ score: 30, level: 'Low' });
    });
  });

  describe('Given a touches_billing signal alone', () => {
    it('then returns 55 / Medium', () => {
      expect(scoreRisk(['touches_billing'])).toEqual({ score: 55, level: 'Medium' });
    });
  });

  describe('Given enough signals to cross 70', () => {
    it('then returns level High', () => {
      const result = scoreRisk(['touches_billing', 'large_diff_500_plus', 'no_tests_added', 'breaking_api']);
      expect(result.score).toBe(90);
      expect(result.level).toBe('High');
    });
  });

  describe('Given a negative signal that would drop below 0', () => {
    it('then clamps to 0', () => {
      expect(
        scoreRisk(['tests_added', 'tests_added', 'tests_added', 'tests_added', 'small_isolated_change']),
      ).toEqual({ score: 0, level: 'Low' });
    });
  });

  describe('Given signals that would exceed 100', () => {
    it('then clamps to 100', () => {
      expect(
        scoreRisk([
          'touches_billing',
          'touches_auth',
          'breaking_api',
          'irreversible_migration',
          'large_diff_500_plus',
          'no_tests_added',
        ]).score,
      ).toBe(100);
    });
  });

  describe('Given a score of exactly 40', () => {
    it('then level is Medium (inclusive lower bound)', () => {
      // 30 base + 10 (large_diff) = 40
      expect(scoreRisk(['large_diff_500_plus']).level).toBe('Medium');
    });
  });

  describe('Given a score just below 40', () => {
    it('then level is Low', () => {
      // 30 base + 5 (no_tests_added) = 35
      expect(scoreRisk(['no_tests_added']).level).toBe('Low');
    });
  });

  describe('Given a score of exactly 70', () => {
    it('then level is High (inclusive lower bound)', () => {
      // 30 base + 25 (touches_billing) + 10 (large_diff) + 5 (no_tests) = 70
      expect(scoreRisk(['touches_billing', 'large_diff_500_plus', 'no_tests_added']).level).toBe(
        'High',
      );
    });
  });
});

describe('materializeSignals', () => {
  describe('Given a list of signal keys', () => {
    it('then maps each to a RiskSignal with type and text', () => {
      const result = materializeSignals(['touches_billing', 'tests_added']);
      expect(result).toEqual([
        { key: 'touches_billing', type: 'warn', text: 'Touches production billing flow' },
        { key: 'tests_added', type: 'good', text: 'Tests added for the new code' },
      ]);
    });
  });

  describe('Given an override map with custom text and evidence', () => {
    it('then uses the override text and evidenceFiles, keeping the canonical type', () => {
      const overrides = new Map([
        [
          'touches_billing' as const,
          {
            text: 'Changes how AI credits are billed for Pro customers',
            evidenceFiles: ['lib/billing.ts'],
          },
        ],
      ]);
      const result = materializeSignals(['touches_billing'], overrides);
      expect(result[0]).toEqual({
        key: 'touches_billing',
        type: 'warn',
        text: 'Changes how AI credits are billed for Pro customers',
        evidenceFiles: ['lib/billing.ts'],
      });
    });
  });

  describe('Given a key without an override', () => {
    it('then falls back to the canonical text', () => {
      const overrides = new Map([
        ['touches_billing' as const, { text: 'custom', evidenceFiles: ['x'] }],
      ]);
      const result = materializeSignals(['tests_added'], overrides);
      expect(result[0]).toEqual({
        key: 'tests_added',
        type: 'good',
        text: 'Tests added for the new code',
      });
    });
  });
});

describe('deriveDomains', () => {
  describe('Given touches_billing', () => {
    it('then emits "Billing"', () => {
      expect(deriveDomains(['touches_billing'])).toEqual(['Billing']);
    });
  });

  describe('Given both touches_billing and touches_auth', () => {
    it('then emits both domains', () => {
      expect(deriveDomains(['touches_billing', 'touches_auth'])).toEqual(['Billing', 'Auth']);
    });
  });

  describe('Given duplicate signals', () => {
    it('then deduplicates domains', () => {
      expect(deriveDomains(['touches_billing', 'touches_billing'])).toEqual(['Billing']);
    });
  });

  describe('Given signals with no domain mapping', () => {
    it('then returns an empty list', () => {
      expect(deriveDomains(['large_diff_500_plus', 'no_tests_added'])).toEqual([]);
    });
  });
});
