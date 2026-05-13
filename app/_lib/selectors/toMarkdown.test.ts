import { describe, expect, it } from 'vitest';
import { combine } from '../combine';
import { toChatPrompt, toMarkdown } from './toMarkdown';
import type {
  APIChanges,
  BusinessChanges,
  DataChanges,
  PRMeta,
  UIChanges,
} from '../types';

const emptyMeta = (): PRMeta => ({
  owner: 'acme',
  repo: 'web',
  number: 42,
  title: 'Add usage cap',
  subtitle: 'Adds a per-workspace token usage cap',
  author: 'alice',
  state: 'open',
  mergedAt: null,
  stateLabel: 'Open',
  htmlUrl: 'https://github.com/acme/web/pull/42',
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

describe('toMarkdown', () => {
  describe('Given a minimal PR (only meta)', () => {
    it('then renders the PR header with title, number, repo, author, state and url', () => {
      const out = toMarkdown(combine(baseInput()));
      expect(out).toContain('# PR #42: Add usage cap');
      expect(out).toContain('**Repository:** acme/web');
      expect(out).toContain('**Author:** @alice');
      expect(out).toContain('**State:** Open');
      expect(out).toContain('**GitHub:** https://github.com/acme/web/pull/42');
      expect(out).toContain('## Description');
      expect(out).toContain('Adds a per-workspace token usage cap');
    });

    it('then omits empty sections', () => {
      const out = toMarkdown(combine(baseInput()));
      expect(out).not.toContain('## Domains affected');
      expect(out).not.toContain('## Frontend changes');
      expect(out).not.toContain('## API changes');
      expect(out).not.toContain('## Database changes');
      expect(out).not.toContain('## Business rules');
      expect(out).not.toContain('## Structural connections');
    });
  });

  describe('Given a non-empty domains list', () => {
    it('then renders a "Domains affected" section as a bulleted list', () => {
      const out = toMarkdown(combine({ ...baseInput(), domains: ['billing', 'auth'] }));
      expect(out).toContain('## Domains affected');
      expect(out).toContain('- billing');
      expect(out).toContain('- auth');
    });
  });

  describe('Given a new UI page', () => {
    it('then marks it as "(new)"', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          ui: {
            ...emptyUI(),
            screenshots: [
              { path: '/pricing', name: 'Pricing', beforeUrl: null, afterUrl: 'a.png' },
            ],
          },
        }),
      );
      expect(out).toContain('- **Pricing** (new) — route `/pricing`');
    });
  });

  describe('Given a removed UI page', () => {
    it('then marks it as "(removed)"', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          ui: {
            ...emptyUI(),
            screenshots: [
              { path: '/pricing', name: 'Pricing', beforeUrl: 'b.png', afterUrl: null },
            ],
          },
        }),
      );
      expect(out).toContain('- **Pricing** (removed) — route `/pricing`');
    });
  });

  describe('Given a modified UI page (both before and after)', () => {
    it('then marks it as "(modified)"', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          ui: {
            ...emptyUI(),
            screenshots: [
              { path: '/pricing', name: 'Pricing', beforeUrl: 'b.png', afterUrl: 'a.png' },
            ],
          },
        }),
      );
      expect(out).toContain('- **Pricing** (modified) — route `/pricing`');
    });
  });

  describe('Given an added endpoint with a request body', () => {
    it('then renders a JSON code block labelled "(new)"', () => {
      const out = toMarkdown(
        combine({
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
        }),
      );
      expect(out).toContain('### POST /api/v1/users — added');
      expect(out).toContain('**Request (new):**');
      expect(out).toContain('"name": "x"');
    });
  });

  describe('Given a breaking endpoint with a breakingReason', () => {
    it('then surfaces the reason', () => {
      const out = toMarkdown(
        combine({
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
        }),
      );
      expect(out).toContain('> Breaking: required field added');
    });
  });

  describe('Given a new table with a PK and FK', () => {
    it('then renders the PK/FK suffix', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          data: {
            ...emptyData(),
            newTables: [
              {
                name: 'Account',
                columns: [
                  { name: 'id', type: 'TEXT', isPrimaryKey: true },
                  { name: 'workspaceId', type: 'TEXT', foreignKey: 'Workspace.id' },
                ],
              },
            ],
          },
        }),
      );
      expect(out).toContain('### Account (new table)');
      expect(out).toContain('- `id` (TEXT) — PK');
      expect(out).toContain('- `workspaceId` (TEXT) — FK → Workspace.id');
    });
  });

  describe('Given a modified table with added/type-changed/dropped columns', () => {
    it('then renders each subgroup', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          data: {
            ...emptyData(),
            modifiedTables: [
              {
                name: 'Account',
                addedColumns: [{ name: 'tier', type: 'TEXT' }],
                typeChanges: [
                  { column: 'createdAt', before: 'DATE', after: 'TIMESTAMP' },
                ],
                droppedColumns: ['legacyFlag'],
              },
            ],
          },
        }),
      );
      expect(out).toContain('### Account (modified)');
      expect(out).toContain('**Added columns:**');
      expect(out).toContain('- `tier` (TEXT)');
      expect(out).toContain('**Type changes:**');
      expect(out).toContain('- `createdAt`: DATE → TIMESTAMP');
      expect(out).toContain('**Dropped columns:**');
      expect(out).toContain('- `legacyFlag`');
    });
  });

  describe('Given a dropped table', () => {
    it('then renders a "(dropped)" heading', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          data: { ...emptyData(), droppedTables: ['LegacyAccount'] },
        }),
      );
      expect(out).toContain('### LegacyAccount (dropped)');
    });
  });

  describe('Given a business rule with after-examples', () => {
    it('then renders the rule heading, before/after texts and examples', () => {
      const out = toMarkdown(
        combine({
          ...baseInput(),
          business: {
            ...emptyBusiness(),
            rules: [
              {
                name: 'Free plan token cap',
                beforeText: '5,000 tokens / day',
                afterText: '10,000 tokens / day',
                beforeExamples: [],
                afterExamples: ['Pro accounts unaffected'],
                highlights: [],
              },
            ],
          },
        }),
      );
      expect(out).toContain('### Free plan token cap');
      expect(out).toContain('**Before:** 5,000 tokens / day');
      expect(out).toContain('**After:** 10,000 tokens / day');
      expect(out).toContain('**Examples:**');
      expect(out).toContain('- Pro accounts unaffected');
    });
  });

  describe('Given overview edges', () => {
    it('then renders "Structural connections" with prefixes stripped and optional label', () => {
      const data = combine({
        ...baseInput(),
        edges: [
          {
            id: 'e1',
            source: 'page:/',
            target: 'api:GET:/api/users',
            label: 'GET',
            status: 'modified',
          },
          {
            id: 'e2',
            source: 'api:GET:/api/users',
            target: 'table:User',
            label: null,
            status: 'modified',
          },
        ],
      });
      const out = toMarkdown(data);
      expect(out).toContain('## Structural connections');
      expect(out).toContain('- / → [GET] GET:/api/users');
      expect(out).toContain('- GET:/api/users → User');
    });
  });
});

describe('toChatPrompt', () => {
  describe('Given any PR data', () => {
    it('then wraps the bare summary with a chat-oriented preamble and a kickoff question', () => {
      const data = combine(baseInput());
      const out = toChatPrompt(data);
      expect(out).toContain("I'm reviewing pull request **#42**");
      expect(out).toContain('**acme/web**');
      expect(out).toContain('**Original PR:** https://github.com/acme/web/pull/42');
      expect(out).toContain(toMarkdown(data));
      expect(out.trim().endsWith('Then wait for my follow-up questions.')).toBe(true);
    });
  });
});
