import { describe, expect, it } from 'vitest';
import { isBusinessFile } from './business';

describe('isBusinessFile', () => {
  describe('Given a .ts file under lib/', () => {
    it('then returns true', () => {
      expect(isBusinessFile('lib/billing.ts')).toBe(true);
    });
  });

  describe('Given a .ts file under services/, domain/, or core/', () => {
    it('then returns true for each', () => {
      expect(isBusinessFile('services/payments.ts')).toBe(true);
      expect(isBusinessFile('domain/order.ts')).toBe(true);
      expect(isBusinessFile('core/permissions.ts')).toBe(true);
    });
  });

  describe('Given a .tsx file (UI)', () => {
    it('then returns false', () => {
      expect(isBusinessFile('lib/somecomponent.tsx')).toBe(false);
    });
  });

  describe('Given a test file', () => {
    it('then returns false', () => {
      expect(isBusinessFile('lib/billing.test.ts')).toBe(false);
      expect(isBusinessFile('lib/billing.spec.ts')).toBe(false);
    });
  });

  describe('Given a .ts file outside the business roots', () => {
    it('then returns false', () => {
      expect(isBusinessFile('app/foo.ts')).toBe(false);
      expect(isBusinessFile('scripts/build.ts')).toBe(false);
      expect(isBusinessFile('prisma/seed.ts')).toBe(false);
    });
  });
});
