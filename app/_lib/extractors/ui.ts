/**
 * UI pillar — surfaces React component changes from a PR.
 *
 * MVP scope: file-based heuristic only. `.tsx`/`.jsx` files under `app/` or
 * `components/`, excluding tests and API route handlers, count as UI. A
 * future iteration will add screenshots via the screenshotter service; for
 * now the `screenshots` field stays empty and the UI shows a placeholder.
 */

import { type GitHubFile, type GitHubFileStatus, getPRFiles, getRepoTree } from '../adapters/github';
import type {
  ChangedComponent,
  PRDiagramConfigRoute,
  RouteScreenshot,
  UIChanges,
  Viewport,
} from '../types';

export interface UIFileInput {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
}

// Back-compat: legacy `.prlens/screenshots` still resolves until demo repos migrate.
const SCREENSHOTS_DIR_CANDIDATES = ['.prdiagram/screenshots', '.prlens/screenshots'] as const;

export const slugifyRouteName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const buildRawGitHubURL = (
  owner: string,
  repo: string,
  sha: string,
  path: string,
): string => `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`;

export const discoverScreenshots = ({
  owner,
  repo,
  headSha,
  routes,
  viewports,
  treePaths,
}: {
  owner: string;
  repo: string;
  headSha: string;
  routes: PRDiagramConfigRoute[];
  viewports: Viewport[];
  treePaths: Set<string>;
}): RouteScreenshot[] => {
  const out: RouteScreenshot[] = [];
  for (const route of routes) {
    const slug = slugifyRouteName(route.name);
    for (const vp of viewports) {
      let beforeFile: string | null = null;
      let afterFile: string | null = null;
      for (const dir of SCREENSHOTS_DIR_CANDIDATES) {
        if (!beforeFile) {
          const candidate = `${dir}/${slug}-${vp}.before.png`;
          if (treePaths.has(candidate)) beforeFile = candidate;
        }
        if (!afterFile) {
          const candidate = `${dir}/${slug}-${vp}.after.png`;
          if (treePaths.has(candidate)) afterFile = candidate;
        }
        if (beforeFile && afterFile) break;
      }
      if (!beforeFile && !afterFile) continue;
      out.push({
        path: route.path,
        name: viewports.length > 1 ? `${route.name} (${vp})` : route.name,
        beforeUrl: beforeFile ? buildRawGitHubURL(owner, repo, headSha, beforeFile) : null,
        afterUrl: afterFile ? buildRawGitHubURL(owner, repo, headSha, afterFile) : null,
      });
    }
  }
  return out;
};

export const isUIFile = (filePath: string): boolean => {
  if (!/\.(tsx|jsx)$/.test(filePath)) return false;
  if (/\.(test|spec)\.(tsx|jsx)$/.test(filePath)) return false;
  if (filePath.startsWith('app/api/')) return false;
  if (!filePath.startsWith('app/') && !filePath.startsWith('components/')) return false;
  return true;
};

const NEXT_SPECIAL_FILES = [
  'page',
  'layout',
  'loading',
  'error',
  'not-found',
  'template',
  'default',
] as const;

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const deriveComponentName = (filePath: string): string => {
  const parts = filePath.split('/');
  const filename = parts.pop() ?? '';
  const base = filename.replace(/\.(tsx|jsx)$/, '');
  const clean = base.replace(/\.(page|route|css)$/, '');

  if (!NEXT_SPECIAL_FILES.includes(clean as (typeof NEXT_SPECIAL_FILES)[number])) {
    return clean;
  }

  const meaningful = [...parts].reverse().find(
    (p) =>
      p !== 'app' &&
      !(p.startsWith('(') && p.endsWith(')')) &&
      !(p.startsWith('[') && p.endsWith(']')) &&
      !p.startsWith('_'),
  );

  if (meaningful) return `${capitalize(meaningful)} ${clean}`;
  if (clean === 'page') return 'Home';
  return `Root ${clean}`;
};

const pluralize = (n: number, singular: string): string =>
  n === 1 ? `1 ${singular}` : `${n} ${singular}s`;

const summarizeChange = (file: UIFileInput): string => {
  if (file.status === 'added') return `Added (+${file.additions} lines)`;
  if (file.status === 'removed') return `Removed (−${file.deletions} lines)`;
  return `+${file.additions} / −${file.deletions} lines`;
};

interface AnalyzeUIParams {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  routes: PRDiagramConfigRoute[];
  viewports: Viewport[];
}

const normalizeStatus = (s: GitHubFileStatus): UIFileInput['status'] | null => {
  if (s === 'added' || s === 'modified' || s === 'removed') return s;
  if (s === 'renamed' || s === 'copied' || s === 'changed') return 'modified';
  return null;
};

export const analyzeUIPillar = async ({
  owner,
  repo,
  prNumber,
  headSha,
  routes,
  viewports,
}: AnalyzeUIParams): Promise<UIChanges> => {
  const [files, tree]: [GitHubFile[], { entries: { path: string }[] }] = await Promise.all([
    getPRFiles({ owner, repo, number: prNumber }),
    getRepoTree({ owner, repo, ref: headSha }),
  ]);

  const uiFiles: UIFileInput[] = files
    .filter((f) => isUIFile(f.filename))
    .map((f) => {
      const status = normalizeStatus(f.status);
      return status === null
        ? null
        : { filename: f.filename, status, additions: f.additions, deletions: f.deletions };
    })
    .filter((f): f is UIFileInput => f !== null);

  const treePaths = new Set(tree.entries.map((e) => e.path));
  const screenshots = discoverScreenshots({
    owner,
    repo,
    headSha,
    routes,
    viewports,
    treePaths,
  });

  const base = buildUIChanges(uiFiles);
  return {
    ...base,
    screenshots,
  };
};

export const buildUIChanges = (files: UIFileInput[]): UIChanges => {
  const changedComponents: ChangedComponent[] = files.map((f) => ({
    file: f.filename,
    name: deriveComponentName(f.filename),
    changeType: f.status,
    summary: summarizeChange(f),
  }));

  const added = files.filter((f) => f.status === 'added').length;
  const modified = files.filter((f) => f.status === 'modified').length;
  const removed = files.filter((f) => f.status === 'removed').length;

  const sentences: string[] = [];
  if (added > 0) sentences.push(`Adds ${pluralize(added, 'new component')}.`);
  if (modified > 0) sentences.push(`Modifies ${pluralize(modified, 'component')}.`);
  if (removed > 0) sentences.push(`Removes ${pluralize(removed, 'component')}.`);

  return {
    description: sentences.join(' '),
    changedComponents,
    screenshots: [],
  };
};
