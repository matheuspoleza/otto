/**
 * Folds the pillar outputs (UI/API/Data/Business) plus the traced edges into
 * a single canonical `Change[]`. The UI fans out from here through selectors;
 * no other code path should construct the legacy pillar shapes for rendering.
 */

import type {
  APIChanges,
  ApiChange,
  ApiPreviewData,
  BusinessChanges,
  Change,
  ChangeStatus,
  DataChanges,
  EndpointChange,
  GraphEdge,
  ModifiedTable,
  NewTable,
  PageChange,
  PagePreviewData,
  PRMeta,
  PRDiagramData,
  RouteScreenshot,
  RuleChange,
  TableChange,
  TableColumnHint,
  TablePreviewData,
  UIChanges,
} from './types';

interface CombineInput {
  meta: PRMeta;
  domains: string[];
  ui: UIChanges;
  api: APIChanges;
  data: DataChanges;
  business: BusinessChanges;
  edges: GraphEdge[];
}

export const pageId = (path: string) => `page:${path}`;
export const apiId = (method: string, path: string) => `api:${method}:${path}`;
export const tableId = (name: string) => `table:${name}`;
export const ruleId = (name: string) => `rule:${name}`;

export const combine = (input: CombineInput): PRDiagramData => {
  const pageChanges = input.ui.screenshots.map(pageChangeFromScreenshot);
  const apiChanges = input.api.endpoints.map(apiChangeFromEndpoint);
  const tableChanges = tableChangesFromData(input.data);
  const ruleChanges = ruleChangesFromBusiness(input.business, apiChanges);

  attachRulesToApis(apiChanges, ruleChanges);

  return {
    meta: input.meta,
    domains: input.domains,
    changes: [...pageChanges, ...apiChanges, ...tableChanges, ...ruleChanges],
    edges: input.edges,
  };
};

// ─── Page ────────────────────────────────────────────────────────────────────

const pageChangeFromScreenshot = (shot: RouteScreenshot): PageChange => ({
  kind: 'page',
  id: pageId(shot.path),
  route: shot.path,
  name: shot.name,
  status: pageStatus(shot),
  preview: pagePreview(shot),
  detail: { screenshot: shot },
});

const pageStatus = (shot: RouteScreenshot): ChangeStatus => {
  if (!shot.beforeUrl && shot.afterUrl) return 'added';
  if (shot.beforeUrl && !shot.afterUrl) return 'removed';
  return 'modified';
};

const pagePreview = (shot: RouteScreenshot): PagePreviewData => ({
  kind: 'page',
  afterUrl: shot.afterUrl,
  routePath: shot.path,
});

// ─── API ─────────────────────────────────────────────────────────────────────

const apiChangeFromEndpoint = (e: EndpointChange): ApiChange => ({
  kind: 'api',
  id: apiId(e.method, e.path),
  method: e.method,
  path: e.path,
  status: endpointStatus(e),
  preview: apiPreview(e),
  detail: { endpoint: e },
  ruleIds: [],
});

const endpointStatus = (e: EndpointChange): ChangeStatus => {
  if (e.changeType === 'added') return 'added';
  if (e.changeType === 'removed') return 'removed';
  return 'modified';
};

const apiPreview = (e: EndpointChange): ApiPreviewData => ({
  kind: 'api',
  method: e.method,
  path: e.path,
  hint: apiHint(e),
});

const apiHint = (e: EndpointChange): string => {
  if (e.changeType === 'added') return 'New endpoint';
  if (e.changeType === 'removed') return 'Removed';
  if (e.changeType === 'breaking') return e.breakingReason ?? 'Breaking change';
  const reqDelta = fieldCount(e.requestAfter) - fieldCount(e.requestBefore);
  const resDelta = fieldCount(e.responseAfter) - fieldCount(e.responseBefore);
  const parts: string[] = [];
  if (reqDelta !== 0) parts.push(`${reqDelta > 0 ? '+' : ''}${reqDelta} request`);
  if (resDelta !== 0) parts.push(`${resDelta > 0 ? '+' : ''}${resDelta} response`);
  if (parts.length === 0) return 'Modified';
  return parts.join(' · ');
};

const fieldCount = (body: unknown): number => {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return Object.keys(body as Record<string, unknown>).length;
  }
  return 0;
};

// ─── Tables ──────────────────────────────────────────────────────────────────

const MAX_COLUMN_HINTS = 3;

const tableChangesFromData = (data: DataChanges): TableChange[] => {
  const changes: TableChange[] = [];
  for (const t of data.newTables) changes.push(tableChangeFromNew(t));
  for (const t of data.modifiedTables) changes.push(tableChangeFromModified(t));
  for (const name of data.droppedTables) changes.push(tableChangeFromDropped(name));
  return changes;
};

const tableChangeFromNew = (table: NewTable): TableChange => {
  const hints: TableColumnHint[] = table.columns
    .slice(0, MAX_COLUMN_HINTS)
    .map((c) => ({ prefix: '+', name: c.name }));
  const preview: TablePreviewData = {
    kind: 'table',
    tableName: table.name,
    columnHints: hints,
    moreCount: Math.max(0, table.columns.length - MAX_COLUMN_HINTS),
    isDropped: false,
  };
  return {
    kind: 'table',
    id: tableId(table.name),
    name: table.name,
    status: 'added',
    preview,
    detail: { variant: 'new', table },
  };
};

const tableChangeFromModified = (table: ModifiedTable): TableChange => {
  const all: TableColumnHint[] = [
    ...table.addedColumns.map((c) => ({ prefix: '+' as const, name: c.name })),
    ...table.typeChanges.map((c) => ({ prefix: '~' as const, name: c.column })),
    ...table.droppedColumns.map((name) => ({ prefix: '-' as const, name })),
  ];
  const preview: TablePreviewData = {
    kind: 'table',
    tableName: table.name,
    columnHints: all.slice(0, MAX_COLUMN_HINTS),
    moreCount: Math.max(0, all.length - MAX_COLUMN_HINTS),
    isDropped: false,
  };
  return {
    kind: 'table',
    id: tableId(table.name),
    name: table.name,
    status: 'modified',
    preview,
    detail: { variant: 'modified', table },
  };
};

const tableChangeFromDropped = (name: string): TableChange => ({
  kind: 'table',
  id: tableId(name),
  name,
  status: 'removed',
  preview: {
    kind: 'table',
    tableName: name,
    columnHints: [],
    moreCount: 0,
    isDropped: true,
  },
  detail: { variant: 'dropped', name },
});

// ─── Business rules ──────────────────────────────────────────────────────────

const ruleChangesFromBusiness = (
  business: BusinessChanges,
  apiChanges: ApiChange[],
): RuleChange[] =>
  business.rules.map((rule, i) => ({
    kind: 'rule',
    id: ruleId(rule.name),
    name: rule.name,
    status: 'modified' as ChangeStatus,
    detail: { rule },
    attachedToId: roundRobinTarget(apiChanges, i),
  }));

const roundRobinTarget = (apiChanges: ApiChange[], i: number): string | null => {
  if (apiChanges.length === 0) return null;
  return apiChanges[i % apiChanges.length].id;
};

const attachRulesToApis = (apis: ApiChange[], rules: RuleChange[]): void => {
  for (const rule of rules) {
    if (!rule.attachedToId) continue;
    const api = apis.find((a) => a.id === rule.attachedToId);
    if (api) api.ruleIds.push(rule.id);
  }
};

// ─── Lookup helpers (used by selectors / UI) ────────────────────────────────

const isRule = (c: Change): c is RuleChange => c.kind === 'rule';

export const findRulesFor = (data: PRDiagramData, ruleIds: string[]): RuleChange[] => {
  const byId = new Map<string, RuleChange>();
  for (const c of data.changes) {
    if (isRule(c)) byId.set(c.id, c);
  }
  return ruleIds.map((id) => byId.get(id)).filter((r): r is RuleChange => r !== undefined);
};

export const findChangeById = (data: PRDiagramData, id: string): Change | undefined =>
  data.changes.find((c) => c.id === id);
