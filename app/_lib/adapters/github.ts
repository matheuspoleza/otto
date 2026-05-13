/**
 * GitHub REST API client for PR Diagram.
 *
 * Public repos only — no auth required (60 req/h anonymous).
 * If GITHUB_TOKEN is set in the server env, it's used to lift the rate limit
 * to 5000 req/h. The token is never exposed to the client.
 */

const GITHUB_API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(url: string) {
    super(`GitHub resource not found: ${url}`, 404, url);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(
    url: string,
    readonly resetAt: Date,
  ) {
    super(`GitHub rate limit exceeded; resets at ${resetAt.toISOString()}`, 403, url);
    this.name = 'GitHubRateLimitError';
  }
}

const githubFetch = async <T,>(path: string): Promise<T> => {
  const url = `${GITHUB_API}${path}`;
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });

  if (res.status === 404) {
    throw new GitHubNotFoundError(url);
  }

  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      const resetUnix = Number(res.headers.get('x-ratelimit-reset') ?? '0');
      throw new GitHubRateLimitError(url, new Date(resetUnix * 1000));
    }
  }

  if (!res.ok) {
    throw new GitHubError(`GitHub request failed: ${res.status} ${res.statusText}`, res.status, url);
  }

  return res.json() as Promise<T>;
};

export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  user: { login: string };
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  html_url: string;
  draft: boolean;
  base: { sha: string; ref: string };
  head: { sha: string; ref: string };
  additions: number;
  deletions: number;
  changed_files: number;
}

export const getPR = async ({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}): Promise<GitHubPR> => {
  return githubFetch<GitHubPR>(`/repos/${owner}/${repo}/pulls/${number}`);
};

export interface GitHubPullSummary {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  updated_at: string;
}

/**
 * Lists pull requests on a repo. Default is open + closed, newest first, capped
 * at `limit`. Lighter payload than `getPR` — meant for index pages, not analysis.
 */
export const listPullRequests = async ({
  owner,
  repo,
  state = 'all',
  limit = 6,
}: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  limit?: number;
}): Promise<GitHubPullSummary[]> => {
  const res = await githubFetch<GitHubPullSummary[]>(
    `/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=${limit}`,
  );
  return res.map((p) => ({
    number: p.number,
    title: p.title,
    state: p.state,
    draft: p.draft,
    updated_at: p.updated_at,
  }));
};

export type GitHubFileStatus =
  | 'added'
  | 'modified'
  | 'removed'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

export interface GitHubFile {
  filename: string;
  status: GitHubFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export const getPRFiles = async ({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}): Promise<GitHubFile[]> => {
  // MVP: first page (up to 100 files) covers nearly all PRs.
  // Pagination can be added when we hit a real PR with >100 files.
  return githubFetch<GitHubFile[]>(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`);
};

export interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

/**
 * Returns the full recursive file tree at a given ref.
 * `truncated` is true when the tree exceeds GitHub's limit (~100k entries / 7MB);
 * in that case the returned list is incomplete.
 */
export const getRepoTree = async ({
  owner,
  repo,
  ref,
}: {
  owner: string;
  repo: string;
  ref: string;
}): Promise<{ entries: GitHubTreeEntry[]; truncated: boolean }> => {
  const res = await githubFetch<GitHubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
  );
  return { entries: res.tree, truncated: res.truncated };
};

interface GitHubContentResponse {
  content: string;
  encoding: 'base64' | string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

/**
 * Returns the UTF-8 contents of a file at a given ref, or null if missing.
 * Other errors propagate.
 */
export const getFileContent = async ({
  owner,
  repo,
  path,
  ref,
}: {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}): Promise<string | null> => {
  try {
    const res = await githubFetch<GitHubContentResponse>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${ref}`,
    );
    if (res.type !== 'file' || res.encoding !== 'base64') return null;
    return Buffer.from(res.content, 'base64').toString('utf-8');
  } catch (e) {
    if (e instanceof GitHubNotFoundError) return null;
    throw e;
  }
};
