import { describe, expect, it } from 'vitest';
import { validateLLMResponse } from './llm';

describe('validateLLMResponse', () => {
  describe('Given a completely empty input', () => {
    it('then returns the empty enrichment shape', () => {
      expect(validateLLMResponse({}, { prPaths: [] })).toEqual({
        subtitle: '',
        signals: [],
        pillarDescriptions: {},
        pillarWarnings: {},
        actions: [],
        businessRules: [],
      });
    });
  });

  describe('Given a valid subtitle string', () => {
    it('then passes it through', () => {
      const out = validateLLMResponse({ subtitle: 'Custom subtitle' }, { prPaths: [] });
      expect(out.subtitle).toBe('Custom subtitle');
    });
  });

  describe('Given a non-string subtitle (number, object)', () => {
    it('then returns empty subtitle', () => {
      expect(validateLLMResponse({ subtitle: 42 }, { prPaths: [] }).subtitle).toBe('');
      expect(validateLLMResponse({ subtitle: {} }, { prPaths: [] }).subtitle).toBe('');
    });
  });

  describe('Given a null raw input', () => {
    it('then returns empty enrichment without crashing', () => {
      expect(validateLLMResponse(null, { prPaths: [] })).toMatchObject({ subtitle: '' });
    });
  });

  describe('Given a signal with a canonical key and at least one matching evidence file', () => {
    it('then keeps the signal', () => {
      const raw = {
        signals: [
          {
            key: 'touches_billing',
            text: 'Changes how invoices are calculated',
            evidenceFiles: ['lib/billing.ts'],
          },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: ['lib/billing.ts', 'app/page.tsx'] });
      expect(out.signals).toEqual([
        {
          key: 'touches_billing',
          text: 'Changes how invoices are calculated',
          evidenceFiles: ['lib/billing.ts'],
        },
      ]);
    });
  });

  describe('Given a signal whose evidenceFiles are not in the PR', () => {
    it('then drops the signal (no hallucinated paths)', () => {
      const raw = {
        signals: [
          {
            key: 'touches_billing',
            text: '...',
            evidenceFiles: ['lib/nonexistent.ts'],
          },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: ['lib/billing.ts'] });
      expect(out.signals).toEqual([]);
    });
  });

  describe('Given a signal with empty evidenceFiles', () => {
    it('then drops the signal (no uncited claim)', () => {
      const raw = {
        signals: [{ key: 'touches_billing', text: '...', evidenceFiles: [] }],
      };
      const out = validateLLMResponse(raw, { prPaths: ['lib/billing.ts'] });
      expect(out.signals).toEqual([]);
    });
  });

  describe('Given a signal with a non-canonical key', () => {
    it('then drops the signal', () => {
      const raw = {
        signals: [
          { key: 'invented_signal', text: '...', evidenceFiles: ['lib/billing.ts'] },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: ['lib/billing.ts'] });
      expect(out.signals).toEqual([]);
    });
  });

  describe('Given a signal where some evidence files are valid and some are not', () => {
    it('then keeps the signal with only the valid evidence files', () => {
      const raw = {
        signals: [
          {
            key: 'touches_billing',
            text: '...',
            evidenceFiles: ['lib/billing.ts', 'lib/hallucinated.ts'],
          },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: ['lib/billing.ts'] });
      expect(out.signals).toHaveLength(1);
      expect(out.signals[0].evidenceFiles).toEqual(['lib/billing.ts']);
    });
  });

  describe('Given signals that is not an array', () => {
    it('then returns no signals', () => {
      expect(
        validateLLMResponse({ signals: 'not an array' }, { prPaths: [] }).signals,
      ).toEqual([]);
    });
  });

  describe('Given a valid action', () => {
    it('then keeps it with iconKind, text, and urgency', () => {
      const raw = {
        actions: [
          { iconKind: 'bell', text: 'Notify #support about new pricing', urgency: 'Before merge' },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: [] });
      expect(out.actions).toEqual([
        { iconKind: 'bell', text: 'Notify #support about new pricing', urgency: 'Before merge' },
      ]);
    });
  });

  describe('Given an action with an unknown iconKind', () => {
    it('then drops it', () => {
      const raw = {
        actions: [{ iconKind: 'invalid', text: 'x', urgency: 'Before merge' }],
      };
      expect(validateLLMResponse(raw, { prPaths: [] }).actions).toEqual([]);
    });
  });

  describe('Given an action with an unknown urgency', () => {
    it('then drops it', () => {
      const raw = {
        actions: [{ iconKind: 'doc', text: 'x', urgency: 'Whenever' }],
      };
      expect(validateLLMResponse(raw, { prPaths: [] }).actions).toEqual([]);
    });
  });

  describe('Given an action without text', () => {
    it('then drops it', () => {
      const raw = {
        actions: [{ iconKind: 'doc', urgency: 'After merge' }],
      };
      expect(validateLLMResponse(raw, { prPaths: [] }).actions).toEqual([]);
    });
  });

  describe('Given valid pillar descriptions for known buckets', () => {
    it('then keeps each as a string', () => {
      const raw = {
        pillarDescriptions: {
          ui: 'Two routes touched',
          data: 'Schema is purely additive',
          business: 'New pricing rule',
        },
      };
      const out = validateLLMResponse(raw, { prPaths: [] });
      expect(out.pillarDescriptions).toEqual({
        ui: 'Two routes touched',
        data: 'Schema is purely additive',
        business: 'New pricing rule',
      });
    });
  });

  describe('Given a pillar description for an unknown bucket', () => {
    it('then drops it', () => {
      const raw = { pillarDescriptions: { auth: 'foo', ui: 'bar' } };
      expect(
        validateLLMResponse(raw, { prPaths: [] }).pillarDescriptions,
      ).toEqual({ ui: 'bar' });
    });
  });

  describe('Given pillar warnings (strings and explicit nulls)', () => {
    it('then keeps strings as-is and null as null', () => {
      const raw = { pillarWarnings: { ui: null, api: 'Be careful' } };
      expect(validateLLMResponse(raw, { prPaths: [] }).pillarWarnings).toEqual({
        ui: null,
        api: 'Be careful',
      });
    });
  });

  describe('Given a pillarDescriptions field with a non-string value', () => {
    it('then drops it', () => {
      const raw = { pillarDescriptions: { ui: 42, api: { obj: true } } };
      expect(
        validateLLMResponse(raw, { prPaths: [] }).pillarDescriptions,
      ).toEqual({});
    });
  });

  describe('Given a well-formed business rule', () => {
    it('then keeps it with all fields normalized', () => {
      const raw = {
        businessRules: [
          {
            name: 'AI feature pricing tiers',
            beforeText: 'AI features were unmetered.',
            afterText: 'Free 50, Starter 500 ($0.03/over), Pro 2500 ($0.02/over).',
            beforeExamples: ['Any plan: unlimited AI calls'],
            afterExamples: ['Free at 50: blocked', 'Pro at 2600: $2 overage'],
            highlights: ['Free', '50', 'Pro'],
          },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: ['lib/billing.ts'] });
      expect(out.businessRules).toHaveLength(1);
      expect(out.businessRules[0]).toEqual({
        name: 'AI feature pricing tiers',
        beforeText: 'AI features were unmetered.',
        afterText: 'Free 50, Starter 500 ($0.03/over), Pro 2500 ($0.02/over).',
        beforeExamples: ['Any plan: unlimited AI calls'],
        afterExamples: ['Free at 50: blocked', 'Pro at 2600: $2 overage'],
        highlights: ['Free', '50', 'Pro'],
      });
    });
  });

  describe('Given a rule without a name', () => {
    it('then drops it', () => {
      const raw = {
        businessRules: [
          { beforeText: 'x', afterText: 'y', beforeExamples: [], afterExamples: [], highlights: [] },
        ],
      };
      expect(validateLLMResponse(raw, { prPaths: [] }).businessRules).toEqual([]);
    });
  });

  describe('Given a rule with missing beforeText/afterText', () => {
    it('then defaults each missing field to an empty string', () => {
      const raw = {
        businessRules: [
          { name: 'Rule X', beforeExamples: [], afterExamples: [], highlights: [] },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: [] });
      expect(out.businessRules[0]).toMatchObject({
        name: 'Rule X',
        beforeText: '',
        afterText: '',
      });
    });
  });

  describe('Given a rule with non-array examples or highlights', () => {
    it('then defaults each invalid array field to []', () => {
      const raw = {
        businessRules: [
          {
            name: 'Rule Y',
            beforeText: 'a',
            afterText: 'b',
            beforeExamples: 'not an array',
            afterExamples: null,
            highlights: 42,
          },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: [] });
      expect(out.businessRules[0]).toMatchObject({
        beforeExamples: [],
        afterExamples: [],
        highlights: [],
      });
    });
  });

  describe('Given a rule with non-string array items', () => {
    it('then filters them out', () => {
      const raw = {
        businessRules: [
          {
            name: 'Rule Z',
            beforeText: 'a',
            afterText: 'b',
            beforeExamples: ['ok', 42, null, 'also ok'],
            afterExamples: [],
            highlights: [],
          },
        ],
      };
      const out = validateLLMResponse(raw, { prPaths: [] });
      expect(out.businessRules[0].beforeExamples).toEqual(['ok', 'also ok']);
    });
  });
});
