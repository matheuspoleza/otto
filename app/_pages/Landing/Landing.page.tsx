'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, GitPullRequest } from 'lucide-react';
import { parsePRURL } from './parsePRURL';

interface DemoPR {
  owner: string;
  repo: string;
  number: number;
  title: string;
}

const DEMO_PRS: DemoPR[] = [
  {
    owner: 'matheuspoleza',
    repo: 'pr-lens-demo',
    number: 4,
    title: 'Add usage-based billing for AI features',
  },
  {
    owner: 'matheuspoleza',
    repo: 'pr-lens-demo',
    number: 3,
    title: 'Redesign workspace settings page',
  },
  {
    owner: 'matheuspoleza',
    repo: 'pr-lens-demo',
    number: 2,
    title: 'Add GET /api/v1/workspaces/[id]/activity endpoint',
  },
  {
    owner: 'matheuspoleza',
    repo: 'pr-lens-demo',
    number: 1,
    title: 'Add priority field to tasks',
  },
];

const useClickAway = (ref: React.RefObject<HTMLElement | null>, onAway: () => void) => {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [ref, onAway]);
};

export const Landing: React.FC = () => {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);
  useClickAway(containerRef, () => setOpen(false));

  const parsed = parsePRURL(value);
  const filtered = value.trim()
    ? DEMO_PRS.filter(
        (d) =>
          d.title.toLowerCase().includes(value.toLowerCase()) ||
          `#${d.number}`.includes(value),
      )
    : DEMO_PRS;

  const goTo = (owner: string, repo: string, number: number) => {
    router.push(`/${owner}/${repo}/pull/${number}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed) goTo(parsed.owner, parsed.repo, parsed.number);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900">
      <header className="h-12 border-b border-neutral-200 bg-white flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center">
            <GitPullRequest className="w-3 h-3 text-white" />
          </div>
          <span className="text-neutral-900">PR Lens</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <h1 className="text-[26px] font-semibold text-neutral-900 leading-tight tracking-tight mb-2">
            Read a pull request without reading the code.
          </h1>
          <p className="text-[14px] text-neutral-600 leading-relaxed mb-8 max-w-lg">
            PR Lens turns any GitHub pull request into a four-pillar summary — UI, API, Data,
            Business — with a deterministic risk score and the reviewer actions a non-engineer can
            act on.
          </p>

          <form ref={containerRef} onSubmit={handleSubmit} className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Paste a GitHub PR URL"
                spellCheck={false}
                autoComplete="off"
                aria-label="GitHub pull request URL"
                className="flex-1 h-10 px-3 text-[14px] bg-white border border-neutral-300 rounded-md focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={parsed === null}
                className="h-10 px-4 text-[13px] font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                Analyze
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {open && filtered.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden z-10">
                <div className="px-3 py-1.5 text-[10px] font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-100">
                  Try a demo PR
                </div>
                <ul>
                  {filtered.map((d) => (
                    <li key={d.number}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          goTo(d.owner, d.repo, d.number);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center gap-3 text-[13px]"
                      >
                        <span className="text-neutral-400 font-mono text-[11px] w-6 shrink-0">
                          #{d.number}
                        </span>
                        <span className="flex-1 truncate text-neutral-900">{d.title}</span>
                        <span className="text-neutral-400 font-mono text-[10px] shrink-0">
                          {d.owner}/{d.repo}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>

          {value && !parsed && (
            <p className="mt-2 text-[12px] text-neutral-500">
              That doesn&apos;t look like a pull request URL. Try{' '}
              <span className="font-mono">https://github.com/owner/repo/pull/123</span>.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
