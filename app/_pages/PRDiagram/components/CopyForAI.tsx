'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileText, MessagesSquare } from 'lucide-react';
import { toChatPrompt, toMarkdown } from '@/app/_lib/selectors/toMarkdown';
import type { PRDiagramData } from '@/app/_lib/types';

interface ChatWithAIProps {
  data: PRDiagramData;
}

const CLAUDE_URL = (prompt: string) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
const CHATGPT_URL = (prompt: string) => `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;

export const CopyForAI: React.FC<ChatWithAIProps> = ({ data }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const flashCopied = () => {
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  const copyChatPrompt = async (): Promise<string> => {
    const text = toChatPrompt(data);
    await navigator.clipboard.writeText(text);
    flashCopied();
    return text;
  };

  const copyMarkdown = async () => {
    const text = toMarkdown(data);
    await navigator.clipboard.writeText(text);
    flashCopied();
  };

  const openIn = async (urlBuilder: (prompt: string) => string) => {
    const text = await copyChatPrompt();
    window.open(urlBuilder(text), '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied
          </>
        ) : (
          <>
            <MessagesSquare className="w-3.5 h-3.5" />
            Chat with AI
            <ChevronDown className="w-3.5 h-3.5 -mr-0.5" />
          </>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-[240px] rounded-md border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <MenuItem
            icon={<ClaudeLogo className="w-4 h-4" />}
            label="Open in Claude"
            hint="claude.ai with prompt prefilled"
            onClick={() => openIn(CLAUDE_URL)}
          />
          <MenuItem
            icon={<ChatGPTLogo className="w-4 h-4" />}
            label="Open in ChatGPT"
            hint="chatgpt.com with prompt prefilled"
            onClick={() => openIn(CHATGPT_URL)}
          />
          <MenuItem
            icon={<CursorLogo className="w-4 h-4" />}
            label="Copy for Cursor"
            hint="Paste into Cursor's chat"
            onClick={async () => {
              await copyChatPrompt();
              setOpen(false);
            }}
          />
          <div className="border-t border-neutral-100" />
          <MenuItem
            icon={<FileText className="w-4 h-4 text-neutral-500" />}
            label="Copy as markdown"
            hint="For any other LLM or note-taking app"
            onClick={async () => {
              await copyMarkdown();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-neutral-50"
  >
    <span className="shrink-0 mt-0.5">{icon}</span>
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[13px] text-neutral-900 font-medium">{label}</span>
      <span className="text-[11px] text-neutral-500">{hint}</span>
    </span>
  </button>
);

const ClaudeLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#D97757" aria-hidden="true">
    <path d="M6.5 4L2.5 20h2.4L6.5 13.5L8.1 20h2.4L6.5 4zM17.5 4L13.5 20h2.4L17.5 13.5L19.1 20h2.4L17.5 4z" />
  </svg>
);

const ChatGPTLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#10A37F" aria-hidden="true">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.911 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.998-2.9 6.056 6.056 0 0 0-.748-7.073Zm-9.022 12.608a4.476 4.476 0 0 1-2.876-1.04l.142-.08 4.778-2.759a.795.795 0 0 0 .393-.681v-6.737l2.02 1.169a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.494Zm-9.66-4.125a4.471 4.471 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.333a.08.08 0 0 1-.033.061l-4.832 2.788a4.499 4.499 0 0 1-6.148-1.643Zm-1.26-9.444A4.485 4.485 0 0 1 4.705 6.93V12.6a.766.766 0 0 0 .388.676l5.814 3.354-2.02 1.169a.076.076 0 0 1-.071 0L3.987 14.81a4.504 4.504 0 0 1-1.647-6.95Zm16.595 3.856-5.834-3.391 2.015-1.164a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.104v-5.677a.79.79 0 0 0-.406-.667Zm2.01-3.023-.142-.085-4.773-2.782a.776.776 0 0 0-.785 0L9.41 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.499 4.499 0 0 1 6.68 4.66ZM8.307 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074A4.499 4.499 0 0 1 13.626 2.62l-.142.081L8.704 5.459a.795.795 0 0 0-.393.681Zm1.097-2.366 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
  </svg>
);

const CursorLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#0A0A0A" aria-hidden="true">
    <path d="M11.925 24 21.85 18.275V6.825L11.925 12.55 2 6.825v11.45zM11.925 12.55l9.925-5.725L11.925 1.1 2 6.825z" opacity="0.95" />
  </svg>
);
