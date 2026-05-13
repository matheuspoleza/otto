'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, GitPullRequest, Loader2 } from 'lucide-react';

const STEPS = [
  'Fetching the pull request',
  'Detecting eligibility',
  'Reading changed files',
  'Diffing the OpenAPI spec',
  'Parsing schema migrations',
  'Mapping changed components',
  'Reading business logic',
  'Drafting the release summary',
  'Scoring risk and surfacing follow-ups',
  'Almost there',
] as const;

const STEP_INTERVAL_MS = 600;

export default function Loading() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900">
      <header className="h-12 border-b border-neutral-200 bg-white flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center">
            <GitPullRequest className="w-3 h-3 text-white" />
          </div>
          <span className="text-neutral-900">PR Lens</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-400 px-2.5 py-1 flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" />
            Open in GitHub
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Analyzing
            </div>
          </div>

          <ul className="space-y-2">
            {STEPS.map((step, i) => {
              const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
              return (
                <li
                  key={step}
                  className={`flex items-start gap-2.5 text-[13px] leading-snug transition-opacity duration-300 ${
                    state === 'pending'
                      ? 'opacity-30'
                      : state === 'active'
                        ? 'opacity-100 text-neutral-900'
                        : 'opacity-50 text-neutral-500'
                  }`}
                >
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      state === 'done'
                        ? 'bg-emerald-500'
                        : state === 'active'
                          ? 'bg-neutral-900'
                          : 'bg-neutral-300'
                    }`}
                  />
                  <span>{step}</span>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 text-[12px] text-neutral-500 leading-relaxed">
            Cold analyses take 10-20 seconds. Once cached, the same pull request renders instantly.
          </p>
        </div>
      </main>
    </div>
  );
}
