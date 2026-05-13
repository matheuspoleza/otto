/**
 * Demo PRs surfaced in the Landing autocomplete. Fetched live from GitHub so
 * the list stays in sync with what's actually open on the demo repo; falls
 * back to a hardcoded list if the call fails (rate limit, offline, etc.).
 */

import { cacheLife, cacheTag } from 'next/cache';
import { listPullRequests } from './adapters/github';
import { DEMO_OWNER, DEMO_REPO } from './pr-allowlist';

export interface DemoPR {
  owner: string;
  repo: string;
  number: number;
  title: string;
}

const FALLBACK_DEMOS: DemoPR[] = [
  { owner: DEMO_OWNER, repo: DEMO_REPO, number: 9, title: 'Add task watchers + in-app notifications' },
  { owner: DEMO_OWNER, repo: DEMO_REPO, number: 8, title: 'Remove legacy /api/v0/* public API' },
  { owner: DEMO_OWNER, repo: DEMO_REPO, number: 7, title: 'Tighten Task.priority to UPPERCASE enum (breaking)' },
  { owner: DEMO_OWNER, repo: DEMO_REPO, number: 6, title: 'Add usage-based billing for AI features' },
  { owner: DEMO_OWNER, repo: DEMO_REPO, number: 5, title: 'Add GET /api/v1/workspaces/{id}/activity endpoint' },
];

export const getDemoPRs = async (): Promise<DemoPR[]> => {
  'use cache';
  cacheLife('hours');
  cacheTag(`demos:${DEMO_OWNER}/${DEMO_REPO}`);

  const byNumberAsc = (a: DemoPR, b: DemoPR) => a.number - b.number;

  try {
    const prs = await listPullRequests({
      owner: DEMO_OWNER,
      repo: DEMO_REPO,
      state: 'open',
      limit: 6,
    });
    if (prs.length === 0) return [...FALLBACK_DEMOS].sort(byNumberAsc);
    return prs
      .filter((p) => !p.draft)
      .map((p) => ({ owner: DEMO_OWNER, repo: DEMO_REPO, number: p.number, title: p.title }))
      .sort(byNumberAsc);
  } catch {
    return [...FALLBACK_DEMOS].sort(byNumberAsc);
  }
};
