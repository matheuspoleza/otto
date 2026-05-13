import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stateLabel, timeAgo } from './pr-diagram.utils';

describe('timeAgo', () => {
  const NOW = new Date('2026-05-13T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Given a null timestamp', () => {
    it('then returns an empty string', () => {
      expect(timeAgo(null)).toBe('');
    });
  });

  describe('Given a timestamp less than 1 minute ago', () => {
    it('then returns "just now"', () => {
      const thirtySecondsAgo = new Date(NOW.getTime() - 30_000).toISOString();
      expect(timeAgo(thirtySecondsAgo)).toBe('just now');
    });
  });

  describe('Given a timestamp 5 minutes ago', () => {
    it('then returns "5m ago"', () => {
      const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60_000).toISOString();
      expect(timeAgo(fiveMinutesAgo)).toBe('5m ago');
    });
  });

  describe('Given a timestamp just under 1 hour ago', () => {
    it('then still returns minutes', () => {
      const fiftyNineMinutesAgo = new Date(NOW.getTime() - 59 * 60_000).toISOString();
      expect(timeAgo(fiftyNineMinutesAgo)).toBe('59m ago');
    });
  });

  describe('Given a timestamp 3 hours ago', () => {
    it('then returns "3h ago"', () => {
      const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString();
      expect(timeAgo(threeHoursAgo)).toBe('3h ago');
    });
  });

  describe('Given a timestamp 2 days ago', () => {
    it('then returns "2d ago"', () => {
      const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60_000).toISOString();
      expect(timeAgo(twoDaysAgo)).toBe('2d ago');
    });
  });
});

describe('stateLabel', () => {
  describe('Given state is "merged" with a mergedAt timestamp', () => {
    it('then returns "merged <timeAgo>"', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
      const mergedAt = new Date('2026-05-13T10:00:00Z').toISOString();
      expect(stateLabel('merged', mergedAt)).toBe('merged 2h ago');
      vi.useRealTimers();
    });
  });

  describe('Given state is "merged" but mergedAt is null', () => {
    it('then returns the bare state', () => {
      expect(stateLabel('merged', null)).toBe('merged');
    });
  });

  describe('Given state is "open"', () => {
    it('then returns "open" regardless of mergedAt', () => {
      expect(stateLabel('open', null)).toBe('open');
      expect(stateLabel('open', '2026-05-13T10:00:00Z')).toBe('open');
    });
  });

  describe('Given state is "closed"', () => {
    it('then returns "closed"', () => {
      expect(stateLabel('closed', null)).toBe('closed');
    });
  });

  describe('Given state is "draft"', () => {
    it('then returns "draft"', () => {
      expect(stateLabel('draft', null)).toBe('draft');
    });
  });
});
