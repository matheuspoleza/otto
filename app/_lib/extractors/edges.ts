/**
 * Edge extractor: wires together pages, endpoints and tables by static
 * textual evidence in the PR head sources.
 *
 * Honest about indirection — if the page hides its API calls behind a helper
 * or the route hides Prisma behind a service, the corresponding edge will not
 * appear. See `static-trace.ts` for the matching rules.
 */

import { apiId, pageId, tableId } from '../combine';
import { traceStaticEdges } from '../static-trace';
import type { APIChanges, DataChanges, GraphEdge, GraphEdgeLabel, UIChanges } from '../types';

interface ExtractEdgesParams {
  owner: string;
  repo: string;
  headSha: string;
  ui: UIChanges;
  api: APIChanges;
  data: DataChanges;
}

export const extractEdges = async ({
  owner,
  repo,
  headSha,
  ui,
  api,
  data,
}: ExtractEdgesParams): Promise<GraphEdge[]> => {
  const pages = ui.screenshots.map((s) => ({
    id: pageId(s.path),
    routePath: s.path,
  }));
  const endpoints = api.endpoints.map((e) => ({
    id: apiId(e.method, e.path),
    method: e.method,
    path: e.path,
  }));
  const tables = [
    ...data.newTables.map((t) => ({ id: tableId(t.name), name: t.name })),
    ...data.modifiedTables.map((t) => ({ id: tableId(t.name), name: t.name })),
  ];

  if (pages.length === 0 && endpoints.length === 0) return [];

  const traced = await traceStaticEdges({
    owner,
    repo,
    headSha,
    pages,
    endpoints,
    tables,
  });

  const edges: GraphEdge[] = [];
  for (const e of traced.pageToApi) {
    edges.push({
      id: `edge:${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      label: methodLabel(e.method),
      status: 'modified',
    });
  }
  for (const e of traced.apiToTable) {
    edges.push({
      id: `edge:${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      label: 'writes',
      status: 'modified',
    });
  }
  return edges;
};

const methodLabel = (method: string): GraphEdgeLabel => {
  if (
    method === 'GET' ||
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE'
  ) {
    return method;
  }
  return null;
};
