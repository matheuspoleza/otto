import { describe, expect, it } from 'vitest';
import { deriveDomains } from './domains';

describe('deriveDomains', () => {
  describe('Given no paths and no tables', () => {
    it('then returns an empty list', () => {
      expect(deriveDomains({ paths: [], tableNames: [] })).toEqual([]);
    });
  });

  describe('Given a billing-related file path', () => {
    it('then includes "Billing"', () => {
      expect(deriveDomains({ paths: ['lib/billing.ts'], tableNames: [] })).toContain('Billing');
    });
  });

  describe('Given a billing-related table name (no path match)', () => {
    it('then still includes "Billing"', () => {
      expect(deriveDomains({ paths: ['lib/x.ts'], tableNames: ['Subscription'] })).toContain(
        'Billing',
      );
    });
  });

  describe('Given an auth-related path', () => {
    it('then includes "Auth"', () => {
      expect(deriveDomains({ paths: ['lib/auth/session.ts'], tableNames: [] })).toContain('Auth');
    });
  });

  describe('Given an auth-related table only', () => {
    it('then does NOT include "Auth" (auth keywords match paths only)', () => {
      expect(deriveDomains({ paths: [], tableNames: ['Session'] })).not.toContain('Auth');
    });
  });

  describe('Given paths matching both billing and auth', () => {
    it('then returns both, in declaration order (Billing first)', () => {
      expect(
        deriveDomains({ paths: ['lib/auth.ts', 'lib/billing.ts'], tableNames: [] }),
      ).toEqual(['Billing', 'Auth']);
    });
  });

  describe('Given paths that match no keywords', () => {
    it('then returns an empty list', () => {
      expect(deriveDomains({ paths: ['lib/random.ts'], tableNames: ['Other'] })).toEqual([]);
    });
  });

  describe('Given case-insensitive matches', () => {
    it('then still matches', () => {
      expect(deriveDomains({ paths: ['lib/Billing.ts'], tableNames: [] })).toContain('Billing');
    });
  });
});
