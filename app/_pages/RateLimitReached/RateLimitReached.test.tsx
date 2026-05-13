import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitReached } from './RateLimitReached.page';

describe('Feature: RateLimitReached', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Given any reset time', () => {
    describe('When rendered', () => {
      it('then shows a level-1 heading mentioning rate limit', () => {
        render(
          <RateLimitReached
            owner="acme"
            repo="api"
            resetAt={new Date('2026-05-13T15:00:00Z')}
          />,
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/rate limit/i);
      });
    });
  });

  describe('Given a reset time 3 hours in the future', () => {
    it('then shows a "Resets in 3h" hint', () => {
      render(
        <RateLimitReached
          owner="acme"
          repo="api"
          resetAt={new Date('2026-05-13T15:00:00Z')}
        />,
      );
      expect(screen.getByText(/resets in 3h/i)).toBeInTheDocument();
    });
  });

  describe('Given owner and repo', () => {
    it('then surfaces them in the breadcrumb', () => {
      render(
        <RateLimitReached owner="acme" repo="api" resetAt={new Date('2026-05-13T15:00:00Z')} />,
      );
      expect(screen.getByText(/acme/)).toBeInTheDocument();
      expect(screen.getByText(/api/)).toBeInTheDocument();
    });
  });

  describe('Given the page is rendered', () => {
    it('then surfaces the GITHUB_TOKEN hint for self-hosted devs', () => {
      render(
        <RateLimitReached owner="x" repo="y" resetAt={new Date('2026-05-13T15:00:00Z')} />,
      );
      expect(screen.getByText(/GITHUB_TOKEN/)).toBeInTheDocument();
    });
  });
});
