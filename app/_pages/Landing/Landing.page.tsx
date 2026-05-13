'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, GitPullRequest, X } from 'lucide-react';
import { track } from '@vercel/analytics';
import type { DemoPR } from '@/app/_lib/demos';
import { isAllowedPR } from '@/app/_lib/pr-allowlist';
import { parsePRURL } from './parsePRURL';

interface LandingProps {
  demos: DemoPR[];
}

const TOAST_DURATION_MS = 6000;

const useClickAway = (ref: React.RefObject<HTMLElement | null>, onAway: () => void) => {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [ref, onAway]);
};

export const Landing: React.FC<LandingProps> = ({ demos }) => {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  useClickAway(containerRef, () => setOpen(false));

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const parsed = parsePRURL(value);
  const showInvalidHint = value.trim().length > 0 && parsed === null;
  const filtered = value.trim() && !parsed
    ? demos.filter(
        (d) =>
          d.title.toLowerCase().includes(value.toLowerCase()) ||
          `#${d.number}`.includes(value.trim()),
      )
    : demos;

  const goToDemo = (d: DemoPR) => {
    track('demo_selected', { number: d.number, repo: `${d.owner}/${d.repo}` });
    router.push(`/${d.owner}/${d.repo}/pull/${d.number}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    const allowed = isAllowedPR(parsed.owner, parsed.repo);
    track('pr_requested', {
      owner: parsed.owner,
      repo: parsed.repo,
      number: parsed.number,
      allowed,
    });
    if (allowed) {
      router.push(`/${parsed.owner}/${parsed.repo}/pull/${parsed.number}`);
    } else {
      setToast(
        `We're not analyzing ${parsed.owner}/${parsed.repo} yet — we'll prioritize PRs like this. Try a curated PR while you wait.`,
      );
      setOpen(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900">
      <header className="h-12 border-b border-neutral-200 bg-white flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center">
            <GitPullRequest className="w-3 h-3 text-white" />
          </div>
          <span className="text-neutral-900">PR Diagram</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <h1 className="text-[26px] font-semibold text-neutral-900 leading-tight tracking-tight mb-2">
            Turn any pull request into a visual diagram.
          </h1>
          <p className="text-[14px] text-neutral-600 leading-relaxed mb-8 max-w-lg">
            Layered by pages, endpoints, tables, and the rules between them — so you understand any
            change in seconds, instead of reading thousands of lines of code.
          </p>

          <form ref={containerRef} onSubmit={handleSubmit} className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={value}
                onChange={handleChange}
                onFocus={() => setOpen(true)}
                placeholder="Paste a GitHub PR URL or pick a curated PR"
                spellCheck={false}
                autoComplete="off"
                role="combobox"
                aria-label="GitHub pull request URL"
                aria-expanded={open}
                aria-controls="pr-suggestions"
                aria-autocomplete="list"
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
                <ul id="pr-suggestions" role="listbox">
                  {filtered.map((d) => (
                    <li key={d.number}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          goToDemo(d);
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

          <div className="mt-2 min-h-[20px]" aria-live="polite">
            {showInvalidHint && (
              <p className="text-[12px] text-neutral-500">
                That doesn&apos;t look like a pull request URL. Try{' '}
                <span className="font-mono">https://github.com/owner/repo/pull/123</span>.
              </p>
            )}
          </div>
        </div>
      </main>

      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 pointer-events-none flex justify-end"
      >
        {toast && (
          <div
            role="status"
            className="pointer-events-auto max-w-sm bg-neutral-900 text-white text-[13px] rounded-md shadow-lg px-3 py-2.5 flex items-start gap-2 animate-[fadeIn_150ms_ease-out]"
          >
            <span className="flex-1 leading-relaxed">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="shrink-0 text-neutral-400 hover:text-white transition-colors mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
