import { describe, expect, it } from 'vitest';
import { validateLLMResponse } from './llm';

describe('validateLLMResponse', () => {
  describe('Given a completely empty input', () => {
    it('then returns the empty enrichment shape', () => {
      expect(validateLLMResponse({})).toEqual({
        subtitle: '',
        businessRules: [],
      });
    });
  });

  describe('Given a valid subtitle string', () => {
    it('then passes it through', () => {
      const out = validateLLMResponse({ subtitle: 'Custom subtitle' });
      expect(out.subtitle).toBe('Custom subtitle');
    });
  });

  describe('Given a non-string subtitle (number, object)', () => {
    it('then returns empty subtitle', () => {
      expect(validateLLMResponse({ subtitle: 42 }).subtitle).toBe('');
      expect(validateLLMResponse({ subtitle: {} }).subtitle).toBe('');
    });
  });

  describe('Given a null raw input', () => {
    it('then returns empty enrichment without crashing', () => {
      expect(validateLLMResponse(null)).toMatchObject({ subtitle: '' });
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
      const out = validateLLMResponse(raw);
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
      expect(validateLLMResponse(raw).businessRules).toEqual([]);
    });
  });

  describe('Given a rule with missing beforeText/afterText', () => {
    it('then defaults each missing field to an empty string', () => {
      const raw = {
        businessRules: [
          { name: 'Rule X', beforeExamples: [], afterExamples: [], highlights: [] },
        ],
      };
      const out = validateLLMResponse(raw);
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
      const out = validateLLMResponse(raw);
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
      const out = validateLLMResponse(raw);
      expect(out.businessRules[0].beforeExamples).toEqual(['ok', 'also ok']);
    });
  });

  describe('Given more than 3 business rules', () => {
    it('then caps to the first 3', () => {
      const rule = (n: number) => ({
        name: `R${n}`,
        beforeText: '',
        afterText: '',
        beforeExamples: [],
        afterExamples: [],
        highlights: [],
      });
      const out = validateLLMResponse({
        businessRules: [rule(1), rule(2), rule(3), rule(4)],
      });
      expect(out.businessRules.map((r) => r.name)).toEqual(['R1', 'R2', 'R3']);
    });
  });
});
