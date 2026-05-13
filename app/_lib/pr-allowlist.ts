/**
 * Curated allowlist for PR analysis while the public version is rolling out.
 * For now we only analyze PRs in the demo repo so visitors get a known-good
 * result; any other URL is captured as an analytics signal (see Landing) but
 * not run through the analyzer.
 *
 * Kept in its own module so the Landing client component can import it
 * without pulling in `'use cache'` code from demos.ts.
 */

export const DEMO_OWNER = 'matheuspoleza';
export const DEMO_REPO = 'pr-lens-demo';

export const isAllowedPR = (owner: string, repo: string): boolean =>
  owner.toLowerCase() === DEMO_OWNER && repo.toLowerCase() === DEMO_REPO;
