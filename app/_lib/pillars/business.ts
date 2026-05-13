/**
 * Business pillar — surfaces business-rule changes from non-UI/non-API/non-Data
 * TypeScript files in the PR (typically under lib/, services/, domain/, core/).
 *
 * Rule extraction itself is LLM-driven — there is no deterministic way to read
 * arbitrary TypeScript and emit "this is a new pricing rule". The pillar's job
 * here is to identify the files and supply trimmed content to the LLM.
 */

import { getFileContent, getPRFiles, type GitHubFileStatus } from '../github';

const BUSINESS_ROOT_RE = /^(lib|services|domain|core)\//;

export const isBusinessFile = (filePath: string): boolean => {
  if (!/\.ts$/.test(filePath)) return false;
  if (/\.(test|spec)\.ts$/.test(filePath)) return false;
  return BUSINESS_ROOT_RE.test(filePath);
};

export interface BusinessFileSample {
  path: string;
  status: 'added' | 'modified' | 'removed';
  content: string;
}

const MAX_FILES = 3;
const MAX_CHARS_PER_FILE = 3000;

const normalizeStatus = (s: GitHubFileStatus): BusinessFileSample['status'] | null => {
  if (s === 'added' || s === 'modified' || s === 'removed') return s;
  if (s === 'renamed' || s === 'copied' || s === 'changed') return 'modified';
  return null;
};

export const fetchBusinessSamples = async ({
  owner,
  repo,
  prNumber,
  headSha,
}: {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
}): Promise<BusinessFileSample[]> => {
  const files = await getPRFiles({ owner, repo, number: prNumber });
  const businessFiles = files
    .filter((f) => isBusinessFile(f.filename))
    .slice(0, MAX_FILES);
  const samples: BusinessFileSample[] = [];
  for (const f of businessFiles) {
    const status = normalizeStatus(f.status);
    if (!status) continue;
    if (status === 'removed') {
      samples.push({ path: f.filename, status, content: '' });
      continue;
    }
    const content = await getFileContent({ owner, repo, path: f.filename, ref: headSha });
    if (content === null) continue;
    samples.push({
      path: f.filename,
      status,
      content: content.length > MAX_CHARS_PER_FILE ? content.slice(0, MAX_CHARS_PER_FILE) : content,
    });
  }
  return samples;
};

