import { describe, expect, it } from 'vitest';
import { buildUIChanges, deriveComponentName, isUIFile, type UIFileInput } from './ui';

describe('isUIFile', () => {
  describe('Given a .tsx file under app/', () => {
    it('then returns true', () => {
      expect(isUIFile('app/workspaces/[slug]/settings/page.tsx')).toBe(true);
    });
  });

  describe('Given a .tsx file under components/', () => {
    it('then returns true', () => {
      expect(isUIFile('components/UserCard.tsx')).toBe(true);
    });
  });

  describe('Given a non-tsx file (.ts)', () => {
    it('then returns false', () => {
      expect(isUIFile('lib/billing.ts')).toBe(false);
    });
  });

  describe('Given an API route handler under app/api/', () => {
    it('then returns false (API routes are not UI even if .tsx)', () => {
      expect(isUIFile('app/api/v1/checkout/route.ts')).toBe(false);
      expect(isUIFile('app/api/v1/checkout/route.tsx')).toBe(false);
    });
  });

  describe('Given a test file', () => {
    it('then returns false', () => {
      expect(isUIFile('app/_pages/PRDiagram/components/ChangeTabs.test.tsx')).toBe(false);
      expect(isUIFile('app/foo.spec.tsx')).toBe(false);
    });
  });

  describe('Given a file under a deeply nested non-app/components path', () => {
    it('then returns false (only app/ and components/ count as UI)', () => {
      expect(isUIFile('scripts/build.tsx')).toBe(false);
      expect(isUIFile('lib/internal/util.tsx')).toBe(false);
    });
  });
});

describe('deriveComponentName', () => {
  describe('Given a Next.js page.tsx under a meaningful route folder', () => {
    it('then returns "<Folder> page"', () => {
      expect(deriveComponentName('app/workspaces/[slug]/settings/page.tsx')).toBe('Settings page');
    });
  });

  describe('Given app/page.tsx (root)', () => {
    it('then returns "Home"', () => {
      expect(deriveComponentName('app/page.tsx')).toBe('Home');
    });
  });

  describe('Given app/layout.tsx (root)', () => {
    it('then returns "Root layout"', () => {
      expect(deriveComponentName('app/layout.tsx')).toBe('Root layout');
    });
  });

  describe('Given a regular PascalCase component file', () => {
    it('then returns the basename without extension', () => {
      expect(deriveComponentName('components/UserCard.tsx')).toBe('UserCard');
    });
  });

  describe('Given a file with the .page.tsx skill suffix outside Next routes', () => {
    it('then strips the .page suffix', () => {
      expect(deriveComponentName('app/_pages/PRDiagram/PRDiagram.page.tsx')).toBe('PRDiagram');
    });
  });

  describe('Given a page nested under a route group and dynamic segment', () => {
    it('then skips parens-folders and bracket-folders to find a meaningful name', () => {
      expect(deriveComponentName('app/(marketing)/pricing/page.tsx')).toBe('Pricing page');
    });
  });
});

describe('buildUIChanges', () => {
  describe('Given no UI files', () => {
    it('then returns empty description and empty arrays', () => {
      const result = buildUIChanges([]);
      expect(result.description).toBe('');
      expect(result.changedComponents).toEqual([]);
      expect(result.screenshots).toEqual([]);
    });
  });

  describe('Given one modified UI file', () => {
    const files: UIFileInput[] = [
      {
        filename: 'app/workspaces/[slug]/settings/page.tsx',
        status: 'modified',
        additions: 147,
        deletions: 39,
      },
    ];
    const result = buildUIChanges(files);

    it('then description uses the singular "1 component"', () => {
      expect(result.description).toBe('Modifies 1 component.');
    });

    it('then changedComponents has the file, derived name, and modified type', () => {
      expect(result.changedComponents).toEqual([
        {
          file: 'app/workspaces/[slug]/settings/page.tsx',
          name: 'Settings page',
          changeType: 'modified',
          summary: '+147 / −39 lines',
        },
      ]);
    });

    it('then screenshots is always empty (MVP)', () => {
      expect(result.screenshots).toEqual([]);
    });
  });

  describe('Given one added UI file', () => {
    const files: UIFileInput[] = [
      { filename: 'app/pricing/page.tsx', status: 'added', additions: 100, deletions: 0 },
    ];
    const result = buildUIChanges(files);

    it('then changeType is "added" with an added-only summary', () => {
      expect(result.changedComponents[0]).toMatchObject({
        changeType: 'added',
        summary: 'Added (+100 lines)',
      });
    });

    it('then description says "Adds 1 new component."', () => {
      expect(result.description).toBe('Adds 1 new component.');
    });
  });

  describe('Given one removed UI file', () => {
    const files: UIFileInput[] = [
      { filename: 'components/Legacy.tsx', status: 'removed', additions: 0, deletions: 80 },
    ];
    const result = buildUIChanges(files);

    it('then changeType is "removed" with a removed-only summary', () => {
      expect(result.changedComponents[0]).toMatchObject({
        changeType: 'removed',
        summary: 'Removed (−80 lines)',
      });
    });

    it('then description says "Removes 1 component."', () => {
      expect(result.description).toBe('Removes 1 component.');
    });
  });

  describe('Given a mix of added, modified and removed', () => {
    const files: UIFileInput[] = [
      { filename: 'app/a/page.tsx', status: 'added', additions: 10, deletions: 0 },
      { filename: 'components/B.tsx', status: 'modified', additions: 5, deletions: 2 },
      { filename: 'components/C.tsx', status: 'modified', additions: 3, deletions: 1 },
      { filename: 'components/D.tsx', status: 'removed', additions: 0, deletions: 50 },
    ];

    it('then description joins all three actions', () => {
      expect(buildUIChanges(files).description).toBe(
        'Adds 1 new component. Modifies 2 components. Removes 1 component.',
      );
    });
  });
});
