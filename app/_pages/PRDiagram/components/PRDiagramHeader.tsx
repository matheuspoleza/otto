import type React from 'react';
import Link from 'next/link';
import { ExternalLink, GitPullRequest } from 'lucide-react';

interface PRDiagramHeaderProps {
  owner: string;
  repo: string;
  htmlUrl: string;
}

export const PRDiagramHeader: React.FC<PRDiagramHeaderProps> = ({ owner, repo, htmlUrl }) => (
  <header className="h-12 border-b border-neutral-200 bg-white flex items-center px-5 shrink-0">
    <Link
      href="/"
      className="flex items-center gap-2 text-sm font-medium rounded-md -mx-1.5 px-1.5 py-1 hover:bg-neutral-100 transition-colors"
      aria-label="Back to PR Diagram home — analyze another pull request"
      title="Analyze another pull request"
    >
      <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center">
        <GitPullRequest className="w-3 h-3 text-white" />
      </div>
      <span className="text-neutral-900">PR Diagram</span>
    </Link>
    <span className="text-neutral-300 mx-2">/</span>
    <span className="text-sm text-neutral-500 font-normal">
      {owner} / {repo}
    </span>
    <div className="ml-auto flex items-center gap-2">
      <a
        href={htmlUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-neutral-500 hover:text-neutral-900 px-2.5 py-1 rounded-md hover:bg-neutral-100 transition-colors flex items-center gap-1.5"
      >
        <ExternalLink className="w-3 h-3" />
        Open in GitHub
      </a>
    </div>
  </header>
);
