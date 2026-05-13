import type React from 'react';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import type { MissingRequirement } from '@/app/_lib/eligibility';
import { PRLensHeader } from '@/app/_pages/PRLens/components/PRLensHeader';

interface NotSupportedProps {
  owner: string;
  repo: string;
  htmlUrl: string;
  missing: MissingRequirement[];
}

export const NotSupported: React.FC<NotSupportedProps> = ({
  owner,
  repo,
  htmlUrl,
  missing,
}) => (
  <div className="min-h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900">
    <PRLensHeader owner={owner} repo={repo} htmlUrl={htmlUrl} />

    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-5">
          <AlertCircle className="w-5 h-5 text-amber-700" />
        </div>

        <h1 className="text-[22px] font-semibold text-neutral-900 leading-tight tracking-tight mb-2">
          {owner}/{repo} isn&apos;t ready for PR Lens
        </h1>
        <p className="text-[14px] text-neutral-600 leading-relaxed mb-8">
          PR Lens needs a few things in the repository to analyze a pull request. Once these are
          present at the PR&apos;s head commit, this page will work automatically.
        </p>

        <ul className="space-y-3 mb-8">
          {missing.map((req, i) => (
            <MissingRequirementItem key={`${req.kind}-${i}`} req={req} />
          ))}
        </ul>

        <a
          href={htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] text-neutral-700 hover:text-neutral-900"
        >
          View PR on GitHub
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </main>
  </div>
);

interface MissingRequirementItemProps {
  req: MissingRequirement;
}

const MissingRequirementItem: React.FC<MissingRequirementItemProps> = ({ req }) => (
  <li className="bg-white border border-neutral-200 rounded-lg px-4 py-3">
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-neutral-900 leading-snug">{req.description}</p>
        {req.searchedPaths && req.searchedPaths.length > 0 && (
          <p className="text-[11px] text-neutral-500 font-mono mt-1.5">
            Looked at: {req.searchedPaths.join(', ')}
          </p>
        )}
      </div>
    </div>
  </li>
);
