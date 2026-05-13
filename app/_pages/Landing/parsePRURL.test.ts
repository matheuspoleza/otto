import { describe, expect, it } from 'vitest';
import { parsePRURL } from './parsePRURL';

describe('parsePRURL', () => {
  describe('Given a full https GitHub URL', () => {
    it('then extracts owner, repo, number', () => {
      expect(parsePRURL('https://github.com/matheuspoleza/pr-lens-demo/pull/4')).toEqual({
        owner: 'matheuspoleza',
        repo: 'pr-lens-demo',
        number: 4,
      });
    });
  });

  describe('Given a URL without protocol', () => {
    it('then still parses', () => {
      expect(parsePRURL('github.com/acme/api/pull/123')).toEqual({
        owner: 'acme',
        repo: 'api',
        number: 123,
      });
    });
  });

  describe('Given a URL with trailing slash', () => {
    it('then still parses', () => {
      expect(parsePRURL('https://github.com/acme/api/pull/9/')).toEqual({
        owner: 'acme',
        repo: 'api',
        number: 9,
      });
    });
  });

  describe('Given a URL with a #issuecomment fragment', () => {
    it('then still parses, ignoring the fragment', () => {
      expect(
        parsePRURL('https://github.com/acme/api/pull/42#issuecomment-12345'),
      ).toEqual({ owner: 'acme', repo: 'api', number: 42 });
    });
  });

  describe('Given a URL with a query string', () => {
    it('then still parses, ignoring the query', () => {
      expect(parsePRURL('https://github.com/acme/api/pull/7?diff=split')).toEqual({
        owner: 'acme',
        repo: 'api',
        number: 7,
      });
    });
  });

  describe('Given input wrapped in whitespace', () => {
    it('then trims and parses', () => {
      expect(
        parsePRURL('   https://github.com/acme/api/pull/3   '),
      ).toEqual({ owner: 'acme', repo: 'api', number: 3 });
    });
  });

  describe('Given the short owner/repo/pull/n form', () => {
    it('then parses without requiring github.com', () => {
      expect(parsePRURL('acme/api/pull/5')).toEqual({
        owner: 'acme',
        repo: 'api',
        number: 5,
      });
    });
  });

  describe('Given an empty string', () => {
    it('then returns null', () => {
      expect(parsePRURL('')).toBeNull();
      expect(parsePRURL('   ')).toBeNull();
    });
  });

  describe('Given a non-PR URL', () => {
    it('then returns null', () => {
      expect(parsePRURL('https://github.com/acme/api')).toBeNull();
      expect(parsePRURL('https://github.com/acme/api/issues/42')).toBeNull();
      expect(parsePRURL('https://example.com/foo/bar/pull/1')).toBeNull();
    });
  });

  describe('Given non-numeric PR number', () => {
    it('then returns null', () => {
      expect(parsePRURL('https://github.com/acme/api/pull/abc')).toBeNull();
    });
  });
});
