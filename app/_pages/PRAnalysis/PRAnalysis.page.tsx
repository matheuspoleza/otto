import { notFound } from 'next/navigation';
import { analyzePR } from '@/app/_lib/analyze';
import { checkEligibility, type MissingRequirement } from '@/app/_lib/eligibility';
import {
  GitHubNotFoundError,
  GitHubRateLimitError,
  type GitHubPR,
  getPR,
} from '@/app/_lib/github';
import type { PRLensData } from '@/app/_lib/types';
import { NotSupported } from '../NotSupported/NotSupported.page';
import { PRLens } from '../PRLens/PRLens.page';
import { RateLimitReached } from '../RateLimitReached/RateLimitReached.page';

interface PRAnalysisPageProps {
  owner: string;
  repo: string;
  number: number;
}

type AnalysisResult =
  | { kind: 'ok'; data: PRLensData }
  | { kind: 'not-found' }
  | { kind: 'rate-limit'; resetAt: Date }
  | { kind: 'not-supported'; missing: MissingRequirement[]; htmlUrl: string };

const computeAnalysis = async ({
  owner,
  repo,
  number,
}: PRAnalysisPageProps): Promise<AnalysisResult> => {
  try {
    const pr: GitHubPR = await getPR({ owner, repo, number });
    const eligibility = await checkEligibility({ owner, repo, ref: pr.head.sha });

    if (!eligibility.eligible) {
      return { kind: 'not-supported', missing: eligibility.missing, htmlUrl: pr.html_url };
    }

    const data = await analyzePR({ owner, repo, pr, profile: eligibility.profile });
    return { kind: 'ok', data };
  } catch (e) {
    if (e instanceof GitHubNotFoundError) return { kind: 'not-found' };
    if (e instanceof GitHubRateLimitError) return { kind: 'rate-limit', resetAt: e.resetAt };
    throw e;
  }
};

export const PRAnalysisPage = async ({ owner, repo, number }: PRAnalysisPageProps) => {
  const result = await computeAnalysis({ owner, repo, number });

  if (result.kind === 'not-found') notFound();
  if (result.kind === 'rate-limit') {
    return <RateLimitReached owner={owner} repo={repo} resetAt={result.resetAt} />;
  }
  if (result.kind === 'not-supported') {
    return (
      <NotSupported
        owner={owner}
        repo={repo}
        htmlUrl={result.htmlUrl}
        missing={result.missing}
      />
    );
  }
  return <PRLens data={result.data} />;
};
