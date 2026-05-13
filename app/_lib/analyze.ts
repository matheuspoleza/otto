/**
 * PR analysis orchestrator. Runs the available pillars, traces edges, asks the
 * LLM for the customer-facing subtitle + business rules, and folds everything
 * into a canonical ChangeSet via `combine`.
 */

import { cacheLife, cacheTag } from 'next/cache';
import { stateLabel as computeStateLabel } from '@/app/_pages/PRDiagram/pr-diagram.utils';
import { combine } from './combine';
import { deriveDomains } from './domains';
import { extractEdges } from './extractors/edges';
import type { RepoProfile } from './eligibility';
import { getPRFiles, type GitHubPR } from './adapters/github';
import { enrichWithLLM, type LLMEnrichment } from './llm';
import { analyzeAPIPillar } from './extractors/api';
import { fetchBusinessSamples } from './extractors/business';
import { analyzeDataPillar } from './extractors/data';
import { analyzeUIPillar } from './extractors/ui';
import type { BusinessChanges, PRDiagramData, PRMeta } from './types';

interface AnalyzePRParams {
  owner: string;
  repo: string;
  pr: GitHubPR;
  profile: RepoProfile;
}

export const analyzePR = async ({
  owner,
  repo,
  pr,
  profile,
}: AnalyzePRParams): Promise<PRDiagramData> => {
  'use cache';
  cacheLife('max');
  cacheTag(`pr:${owner}/${repo}/${pr.number}:${pr.head.sha}`);

  const [files, data, api, ui, businessSamples] = await Promise.all([
    getPRFiles({ owner, repo, number: pr.number }),
    analyzeDataPillar({ owner, repo, prNumber: pr.number, headSha: pr.head.sha }),
    analyzeAPIPillar({
      owner,
      repo,
      prNumber: pr.number,
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
      openapiPath: profile.openapiPath,
    }),
    analyzeUIPillar({
      owner,
      repo,
      prNumber: pr.number,
      headSha: pr.head.sha,
      routes: profile.routes,
      viewports: profile.viewports,
    }),
    fetchBusinessSamples({ owner, repo, prNumber: pr.number, headSha: pr.head.sha }),
  ]);

  const paths = files.map((f) => f.filename);
  const tableNames = [
    ...data.newTables.map((t) => t.name),
    ...data.modifiedTables.map((t) => t.name),
  ];

  const [enrichment, edges] = await Promise.all([
    enrichWithLLM({
      pr: {
        title: pr.title,
        body: pr.body,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
      },
      paths,
      data,
      api,
      ui,
      businessSamples,
    }),
    extractEdges({ owner, repo, headSha: pr.head.sha, ui, api, data }),
  ]);

  const meta = prToMeta({ pr, owner, repo });
  if (enrichment?.subtitle) meta.subtitle = enrichment.subtitle;

  const business = buildBusinessChanges(enrichment, businessSamples.length > 0);

  return combine({
    meta,
    domains: deriveDomains({ paths, tableNames }),
    ui,
    api,
    data,
    business,
    edges,
  });
};

export const prToMeta = ({
  pr,
  owner,
  repo,
}: {
  pr: GitHubPR;
  owner: string;
  repo: string;
}): PRMeta => {
  let state: PRMeta['state'];
  if (pr.merged) state = 'merged';
  else if (pr.draft) state = 'draft';
  else if (pr.state === 'closed') state = 'closed';
  else state = 'open';

  return {
    owner,
    repo,
    number: pr.number,
    title: pr.title,
    subtitle: extractSubtitle(pr.body),
    author: pr.user.login,
    state,
    mergedAt: pr.merged_at,
    stateLabel: computeStateLabel(state, pr.merged_at),
    htmlUrl: pr.html_url,
    headSha: pr.head.sha,
  };
};

/**
 * Pulls the first prose paragraph from a PR body (skipping headings, tables,
 * and list items). Capped at 240 chars. Returns '' if nothing usable is found.
 * The LLM will replace this with a polished customer-facing subtitle later.
 */
export const extractSubtitle = (body: string | null): string => {
  if (!body) return '';
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('-')) continue;
    if (trimmed.startsWith('>')) continue;
    const cleaned = trimmed.replace(/^[*_`]+|[*_`]+$/g, '');
    if (!cleaned) continue;
    return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
  }
  return '';
};

const buildBusinessChanges = (
  enrichment: LLMEnrichment | null,
  hasBusinessFiles: boolean,
): BusinessChanges => {
  const rules = enrichment?.businessRules ?? [];
  if (!hasBusinessFiles && rules.length === 0) {
    return { description: '', rules: [] };
  }
  return { description: '', rules };
};
