import type React from 'react';
import { Clock } from 'lucide-react';
import { PRLensHeader } from '../PRLens/components/PRLensHeader';

interface RateLimitReachedProps {
  owner: string;
  repo: string;
  resetAt: Date;
}

const formatResetIn = (resetAt: Date): string => {
  const ms = resetAt.getTime() - Date.now();
  if (ms <= 0) return 'now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
};

export const RateLimitReached: React.FC<RateLimitReachedProps> = ({ owner, repo, resetAt }) => (
  <div className="min-h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900">
    <PRLensHeader owner={owner} repo={repo} htmlUrl={`https://github.com/${owner}/${repo}`} />

    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-5">
          <Clock className="w-5 h-5 text-amber-700" />
        </div>

        <h1 className="text-[22px] font-semibold text-neutral-900 leading-tight tracking-tight mb-2">
          GitHub rate limit reached
        </h1>
        <p className="text-[14px] text-neutral-600 leading-relaxed mb-1" suppressHydrationWarning>
          Resets in {formatResetIn(resetAt)}.
        </p>
        <p className="text-[14px] text-neutral-600 leading-relaxed mb-6">
          Anonymous GitHub requests are capped at 60 per hour. Try again after the reset window.
        </p>

        <p className="text-[12px] text-neutral-500 leading-relaxed font-mono bg-neutral-100 rounded-md px-3 py-2">
          Self-hosting? Export <span className="text-neutral-900">GITHUB_TOKEN</span> before
          starting the server to lift the limit to 5,000/hour.
        </p>
      </div>
    </main>
  </div>
);

