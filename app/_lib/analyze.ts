/**
 * PR analysis orchestrator. Runs the available pillars, computes deterministic
 * risk signals, asks the LLM for narrative enrichment, and merges everything
 * into a PRLensData payload for the UI.
 */

import { cacheLife, cacheTag } from 'next/cache';
import { stateLabel as computeStateLabel } from '@/app/_pages/PRLens/utils';
import type { RepoProfile } from './eligibility';
import { getPRFiles, type GitHubPR } from './github';
import { enrichWithLLM, type LLMEnrichment } from './llm';
import { analyzeAPIPillar } from './pillars/api';
import { fetchBusinessSamples } from './pillars/business';
import { analyzeDataPillar } from './pillars/data';
import { analyzeUIPillar } from './pillars/ui';
import {
  detectSignals,
  deriveDomains,
  materializeSignals,
  scoreRisk,
  topSignalKeys,
  type SignalKey,
  type SignalOverride,
} from './score';
import type {
  APIChanges,
  BusinessChanges,
  DataChanges,
  PRLensData,
  PRMeta,
  RiskAssessment,
  UIChanges,
} from './types';

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
}: AnalyzePRParams): Promise<PRLensData> => {
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
  const deterministicSignals = detectSignals({
    prChanges: pr.additions + pr.deletions,
    changedFileCount: pr.changed_files,
    files: files.map((f) => ({ filename: f.filename, status: f.status })),
    api,
    data,
  });

  const enrichment = await enrichWithLLM({
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
    deterministicSignals,
  });

  const signalKeys = mergeSignalKeys(deterministicSignals, enrichment);
  const overrides = signalOverridesFromEnrichment(enrichment);
  const displayedSignals = topSignalKeys(signalKeys, 3);

  const risk: RiskAssessment = {
    ...scoreRisk(signalKeys),
    signals: materializeSignals(displayedSignals, overrides),
  };

  const meta = prToMeta({ pr, owner, repo });
  if (enrichment?.subtitle) meta.subtitle = enrichment.subtitle;

  return {
    meta,
    risk,
    domains: deriveDomains(signalKeys),
    actions: enrichment?.actions ?? [],
    changes: {
      ui: applyPillarOverride(ui, enrichment?.pillarDescriptions.ui, enrichment?.pillarWarnings.ui),
      api: applyPillarOverride(api, enrichment?.pillarDescriptions.api, enrichment?.pillarWarnings.api),
      data: applyPillarOverride(data, enrichment?.pillarDescriptions.data, enrichment?.pillarWarnings.data),
      business: buildBusinessChanges(enrichment, businessSamples.length > 0),
    },
  };
};

const mergeSignalKeys = (
  deterministic: SignalKey[],
  enrichment: LLMEnrichment | null,
): SignalKey[] => {
  if (!enrichment) return deterministic;
  const seen = new Set<SignalKey>(deterministic);
  for (const s of enrichment.signals) seen.add(s.key);
  return [...seen];
};

const signalOverridesFromEnrichment = (
  enrichment: LLMEnrichment | null,
): Map<SignalKey, SignalOverride> | undefined => {
  if (!enrichment || enrichment.signals.length === 0) return undefined;
  const map = new Map<SignalKey, SignalOverride>();
  for (const s of enrichment.signals) {
    map.set(s.key, { text: s.text, evidenceFiles: s.evidenceFiles });
  }
  return map;
};

type PillarWithText = DataChanges | APIChanges | UIChanges | BusinessChanges;

const applyPillarOverride = <T extends PillarWithText>(
  pillar: T,
  description: string | undefined,
  warning: string | null | undefined,
): T => {
  if (description === undefined && warning === undefined) return pillar;
  return {
    ...pillar,
    description: description ?? pillar.description,
    warning: warning === undefined ? pillar.warning : warning,
  };
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
    return { count: 0, description: '', rules: [], warning: null };
  }
  return {
    count: rules.length,
    description: enrichment?.pillarDescriptions.business ?? '',
    rules,
    warning:
      enrichment?.pillarWarnings.business !== undefined ? enrichment.pillarWarnings.business : null,
  };
};
