import { notFound } from 'next/navigation';
import { PRAnalysisPage } from '@/app/_pages/PRAnalysis/PRAnalysis.page';

interface RoutePageProps {
  params: Promise<{ owner: string; repo: string; number: string }>;
}

// Allowlist of `owner/repo` slugs analyzable in production.
// Empty list (e.g. local dev without env var) = allow all.
const ALLOWLIST = (process.env.ALLOWED_REPOS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const isAllowed = (owner: string, repo: string): boolean => {
  if (ALLOWLIST.length === 0) return true;
  return ALLOWLIST.includes(`${owner}/${repo}`.toLowerCase());
};

export default async function Page({ params }: RoutePageProps) {
  const { owner, repo, number } = await params;
  const prNumber = Number(number);
  if (!Number.isInteger(prNumber) || prNumber <= 0) notFound();
  if (!isAllowed(owner, repo)) notFound();
  return <PRAnalysisPage owner={owner} repo={repo} number={prNumber} />;
}
