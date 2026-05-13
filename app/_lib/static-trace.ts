/**
 * Reads file contents from GitHub at the PR head and infers edges between
 * structural nodes by simple textual evidence.
 *
 *  - page → api: the page file mentions the endpoint path as a string
 *    literal (e.g. `fetch("/api/v1/workspaces/foo/usage")`).
 *  - api → table: the route handler calls `prisma.<modelName>.<op>(…)`.
 *
 * The demo repo (pr-lens-demo) uses Prisma directly in routes and explicit
 * fetch URLs in pages, so this catches what's there without ts-morph. For
 * repos that hide accesses behind helpers, the static trace returns no
 * edges — honest about what we can't see — rather than guessing.
 */

import { getFileContent, getRepoTree } from './adapters/github';

export interface PageInput {
  id: string;
  routePath: string;
}

export interface EndpointInput {
  id: string;
  method: string;
  path: string;
}

export interface TableInput {
  id: string;
  name: string;
}

export interface TracedEdges {
  pageToApi: Array<{ source: string; target: string; method: string }>;
  apiToTable: Array<{ source: string; target: string }>;
}

interface TraceParams {
  owner: string;
  repo: string;
  headSha: string;
  pages: PageInput[];
  endpoints: EndpointInput[];
  tables: TableInput[];
}

/**
 * Next.js convention mapping a route URL to its page file. `/` → `app/page.tsx`,
 * `/pricing` → `app/pricing/page.tsx`. Dynamic segments aren't expected for
 * pages tracked in prdiagram.config (which are concrete paths).
 */
export const pageFileForRoute = (routePath: string): string => {
  if (routePath === '/' || routePath === '') return 'app/page.tsx';
  const cleaned = routePath.replace(/^\/+|\/+$/g, '');
  return `app/${cleaned}/page.tsx`;
};

/**
 * Next.js convention for API routes. `/api/v1/workspaces/{id}/usage` →
 * `app/api/v1/workspaces/[id]/usage/route.ts`. Both `{id}` and `:id` styles
 * accepted, converted to the Next bracket form.
 */
export const apiFileForPath = (apiPath: string): string => {
  const cleaned = apiPath
    .replace(/^\/+/, '')
    .split('/')
    .map((seg) => {
      const m = seg.match(/^[{:](\w+)[}]?$/);
      return m ? `[${m[1]}]` : seg;
    })
    .join('/');
  return `app/${cleaned}/route.ts`;
};

/**
 * Builds a regex that matches the endpoint path as a string literal,
 * treating `{param}` as a wildcard segment so template-literal calls
 * (e.g. `/api/v1/workspaces/${id}/usage`) also match.
 */
export const endpointMatcher = (apiPath: string): RegExp => {
  // Replace `{param}` segments with a wildcard FIRST (before escaping),
  // then escape the rest so the literal slashes / dots stay literal.
  const withWildcards = apiPath.replace(/\{[^}]+\}/g, '\x00');
  const escaped = withWildcards
    .replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')
    .replace(/\x00/g, '[^"\'`)/\\s]+');
  return new RegExp(escaped);
};

/**
 * Builds a regex that matches `prisma.<modelName>` where the model name
 * is the camelCase form of the Prisma model (table name). Prisma exposes
 * `prisma.aIUsageEvent` for a model called `AIUsageEvent`.
 */
export const prismaModelMatcher = (tableName: string): RegExp => {
  const camel = tableName.charAt(0).toLowerCase() + tableName.slice(1);
  return new RegExp(`prisma\\.${camel}\\b`);
};

const fetchSafe = async (owner: string, repo: string, path: string, ref: string): Promise<string | null> => {
  try {
    return await getFileContent({ owner, repo, path, ref });
  } catch {
    return null;
  }
};

const SCANNED_EXTENSIONS = ['.tsx', '.ts'];

/**
 * Returns all `.tsx`/`.ts` files in the same directory as `pageFile` (and
 * descendants). Next.js co-locates client components next to the page, so
 * an explicit fetch may live in a sibling — scanning the whole directory
 * catches those.
 */
export const collectPageScope = async ({
  owner,
  repo,
  ref,
  pageFile,
  tree,
}: {
  owner: string;
  repo: string;
  ref: string;
  pageFile: string;
  tree: { path: string; type: string }[];
}): Promise<string[]> => {
  void owner;
  void repo;
  void ref;
  const dir = pageFile.split('/').slice(0, -1).join('/');
  const isDirectChild = (p: string): boolean => {
    if (p === pageFile) return true;
    if (!p.startsWith(`${dir}/`)) return false;
    // Only siblings — files in nested directories belong to other routes.
    const relative = p.slice(dir.length + 1);
    return !relative.includes('/');
  };
  return tree
    .filter((e) => e.type === 'blob')
    .map((e) => e.path)
    .filter((p) => isDirectChild(p) && SCANNED_EXTENSIONS.some((ext) => p.endsWith(ext)));
};

export const traceStaticEdges = async ({
  owner,
  repo,
  headSha,
  pages,
  endpoints,
  tables,
}: TraceParams): Promise<TracedEdges> => {
  const pageToApi: TracedEdges['pageToApi'] = [];
  const apiToTable: TracedEdges['apiToTable'] = [];

  const tree = pages.length > 0
    ? (await getRepoTree({ owner, repo, ref: headSha }).catch(() => ({ entries: [] }))).entries
    : [];

  const pageContents = await Promise.all(
    pages.map(async (p) => {
      const pageFile = pageFileForRoute(p.routePath);
      const scoped = await collectPageScope({ owner, repo, ref: headSha, pageFile, tree });
      const filesToScan = scoped.length > 0 ? scoped : [pageFile];
      const contents = await Promise.all(
        filesToScan.map((f) => fetchSafe(owner, repo, f, headSha)),
      );
      return {
        page: p,
        content: contents.filter((c): c is string => c !== null).join('\n'),
      };
    }),
  );

  for (const { page, content } of pageContents) {
    if (!content) continue;
    for (const endpoint of endpoints) {
      if (endpointMatcher(endpoint.path).test(content)) {
        pageToApi.push({ source: page.id, target: endpoint.id, method: endpoint.method });
      }
    }
  }

  const apiContents = await Promise.all(
    endpoints.map(async (e) => ({
      endpoint: e,
      content: await fetchSafe(owner, repo, apiFileForPath(e.path), headSha),
    })),
  );

  for (const { endpoint, content } of apiContents) {
    if (!content) continue;
    for (const table of tables) {
      if (prismaModelMatcher(table.name).test(content)) {
        apiToTable.push({ source: endpoint.id, target: table.id });
      }
    }
  }

  return { pageToApi, apiToTable };
};
