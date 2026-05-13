import { describe, expect, it } from 'vitest';
import { extractSubtitle, prToMeta } from './analyze';
import type { GitHubPR } from './adapters/github';

const makePR = (overrides: Partial<GitHubPR> = {}): GitHubPR => ({
  number: 1,
  title: 'Test PR',
  body: null,
  user: { login: 'tester' },
  state: 'open',
  merged: false,
  merged_at: null,
  html_url: 'https://github.com/owner/repo/pull/1',
  draft: false,
  base: { sha: 'basesha', ref: 'main' },
  head: { sha: 'headsha', ref: 'feat/x' },
  additions: 0,
  deletions: 0,
  changed_files: 0,
  ...overrides,
});

describe('extractSubtitle', () => {
  describe('Given a null body', () => {
    it('then returns an empty string', () => {
      expect(extractSubtitle(null)).toBe('');
    });
  });

  describe('Given an empty body', () => {
    it('then returns an empty string', () => {
      expect(extractSubtitle('')).toBe('');
    });
  });

  describe('Given a body that is only headings', () => {
    it('then returns an empty string', () => {
      expect(extractSubtitle('# Title\n## Subtitle\n### Section')).toBe('');
    });
  });

  describe('Given a body starting with a heading followed by prose', () => {
    it('then returns the first prose paragraph', () => {
      const body = '## Summary\n\nThis PR introduces a new feature that does things.';
      expect(extractSubtitle(body)).toBe(
        'This PR introduces a new feature that does things.',
      );
    });
  });

  describe('Given a body with tables and lists before prose', () => {
    it('then skips the tables and lists and returns the prose', () => {
      const body = `## Summary

| col | header |
|---|---|
| a | b |

- bullet 1
- bullet 2

> some quote

Finally a real sentence here.`;
      expect(extractSubtitle(body)).toBe('Finally a real sentence here.');
    });
  });

  describe('Given a body whose first paragraph wraps emphasis', () => {
    it('then strips leading/trailing emphasis characters', () => {
      expect(extractSubtitle('**Bold opening sentence**')).toBe('Bold opening sentence');
    });
  });

  describe('Given a prose paragraph longer than 240 characters', () => {
    it('then truncates with an ellipsis', () => {
      const long = 'a'.repeat(300);
      const result = extractSubtitle(long);
      expect(result.length).toBe(240);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('Given a body where the prose is exactly 240 characters', () => {
    it('then does NOT truncate', () => {
      const exact = 'a'.repeat(240);
      const result = extractSubtitle(exact);
      expect(result).toBe(exact);
      expect(result.endsWith('...')).toBe(false);
    });
  });
});

describe('prToMeta', () => {
  describe('Given a merged PR', () => {
    it('then state is "merged"', () => {
      const pr = makePR({ merged: true, merged_at: '2026-05-01T00:00:00Z' });
      const meta = prToMeta({ pr, owner: 'o', repo: 'r' });
      expect(meta.state).toBe('merged');
      expect(meta.mergedAt).toBe('2026-05-01T00:00:00Z');
    });
  });

  describe('Given an open draft PR', () => {
    it('then state is "draft" (draft wins over open)', () => {
      const pr = makePR({ draft: true, state: 'open' });
      expect(prToMeta({ pr, owner: 'o', repo: 'r' }).state).toBe('draft');
    });
  });

  describe('Given a closed unmerged PR', () => {
    it('then state is "closed"', () => {
      const pr = makePR({ state: 'closed', merged: false });
      expect(prToMeta({ pr, owner: 'o', repo: 'r' }).state).toBe('closed');
    });
  });

  describe('Given a plain open PR', () => {
    it('then state is "open"', () => {
      const meta = prToMeta({ pr: makePR(), owner: 'o', repo: 'r' });
      expect(meta.state).toBe('open');
    });
  });

  describe('Given a PR with a body', () => {
    it('then subtitle is extracted from the body', () => {
      const pr = makePR({ body: '## Summary\n\nReal subtitle here.' });
      expect(prToMeta({ pr, owner: 'o', repo: 'r' }).subtitle).toBe('Real subtitle here.');
    });
  });

  describe('Given typical PR fields', () => {
    it('then passes through owner, repo, number, title, author, headSha, htmlUrl', () => {
      const pr = makePR({
        number: 42,
        title: 'Add thing',
        user: { login: 'alice' },
        head: { sha: 'abc123', ref: 'feat/thing' },
        html_url: 'https://github.com/acme/api/pull/42',
      });
      const meta = prToMeta({ pr, owner: 'acme', repo: 'api' });
      expect(meta).toMatchObject({
        owner: 'acme',
        repo: 'api',
        number: 42,
        title: 'Add thing',
        author: 'alice',
        headSha: 'abc123',
        htmlUrl: 'https://github.com/acme/api/pull/42',
      });
    });
  });
});
