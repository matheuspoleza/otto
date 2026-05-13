/**
 * Shape produced by the analysis pipeline and consumed by the PRDiagram UI.
 * All fields must be JSON-serializable so this can cross the RSC boundary.
 */

// ─── Target repo config (lives in the analyzed repo as prdiagram.config.json) ──

export type PreviewProvider = 'vercel' | 'netlify';
export type Viewport = 'desktop' | 'mobile';

export interface PRDiagramConfigRoute {
  path: string;
  name: string;
}

export interface PRDiagramConfigPreview {
  provider: PreviewProvider;
  routes: PRDiagramConfigRoute[];
}

export interface PRDiagramConfig {
  preview?: PRDiagramConfigPreview;
  openapi?: string;
  prisma?: string;
  viewports?: Viewport[];
}

export interface PRMeta {
  owner: string;
  repo: string;
  number: number;
  title: string;
  subtitle: string;
  author: string;
  state: 'open' | 'merged' | 'closed' | 'draft';
  mergedAt: string | null;
  stateLabel: string;
  htmlUrl: string;
  headSha: string;
}

// ─── UI bucket ──────────────────────────────────────────────────────────────

export interface ChangedComponent {
  file: string;
  name: string;
  changeType: 'added' | 'modified' | 'removed';
  summary: string;
}

export interface RouteScreenshot {
  path: string;
  name: string;
  beforeUrl: string | null;
  afterUrl: string | null;
}

export interface UIChanges {
  description: string;
  changedComponents: ChangedComponent[];
  screenshots: RouteScreenshot[];
}

// ─── API bucket ─────────────────────────────────────────────────────────────

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface EndpointChange {
  method: HttpMethod;
  path: string;
  changeType: 'added' | 'modified' | 'removed' | 'breaking';
  requestBefore: unknown;
  requestAfter: unknown;
  responseBefore: unknown;
  responseAfter: unknown;
  breakingReason: string | null;
}

export interface APIChanges {
  description: string;
  endpoints: EndpointChange[];
}

// ─── Data bucket ────────────────────────────────────────────────────────────

export interface SchemaColumn {
  name: string;
  type: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
  foreignKey?: string;
}

export interface NewTable {
  name: string;
  columns: SchemaColumn[];
}

export interface ModifiedTable {
  name: string;
  addedColumns: SchemaColumn[];
  droppedColumns: string[];
  typeChanges: Array<{ column: string; before: string; after: string }>;
}

export interface DataChanges {
  description: string;
  newTables: NewTable[];
  modifiedTables: ModifiedTable[];
  droppedTables: string[];
  isReversible: boolean;
}

// ─── Business bucket ────────────────────────────────────────────────────────

export interface BusinessRule {
  name: string;
  beforeText: string;
  afterText: string;
  beforeExamples: string[];
  afterExamples: string[];
  highlights: string[];
}

export interface BusinessChanges {
  description: string;
  rules: BusinessRule[];
}

// ─── Previews (kind-specific node body in the diagram) ─────────────────────

export interface PagePreviewData {
  kind: 'page';
  afterUrl: string | null;
  routePath: string;
}

export interface ApiPreviewData {
  kind: 'api';
  method: HttpMethod;
  path: string;
  /** One-line deterministic hint of the change: "New endpoint" / "+ 2 fields" / "Breaking change" / etc. */
  hint: string;
}

export type TableColumnHint = { prefix: '+' | '~' | '-'; name: string };

export interface TablePreviewData {
  kind: 'table';
  tableName: string;
  /** Up to 3 column-level changes; if more exist, `moreCount` reports the remainder. */
  columnHints: TableColumnHint[];
  moreCount: number;
  isDropped: boolean;
}

// ─── Structural edges (page→api, api→table) ────────────────────────────────

export type GraphEdgeLabel = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'writes' | null;

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** Sparse — HTTP method on page→api edges, "writes" on data-mutating edges, null elsewhere. */
  label: GraphEdgeLabel;
  /** "added" / "modified" / "removed" of either endpoint propagates here. */
  status: ChangeStatus;
}

// ─── Canonical change union ─────────────────────────────────────────────────

export type ChangeStatus = 'added' | 'modified' | 'removed';

/**
 * Discriminated union of everything the UI can navigate to. Each Change is
 * self-contained: it carries its own id, status, preview content, and the
 * detail payload the overlay needs to render. New node kinds (cron jobs,
 * env vars, etc.) extend by adding one variant; selectors and the UI fan
 * out from there.
 */
export type Change = PageChange | ApiChange | TableChange | RuleChange;

export interface PageChange {
  kind: 'page';
  id: string;
  route: string;
  name: string;
  status: ChangeStatus;
  preview: PagePreviewData;
  detail: { screenshot: RouteScreenshot };
}

export interface ApiChange {
  kind: 'api';
  id: string;
  method: HttpMethod;
  path: string;
  status: ChangeStatus;
  preview: ApiPreviewData;
  detail: { endpoint: EndpointChange };
  /** Ids of `RuleChange`s attached to this endpoint as badges. */
  ruleIds: string[];
}

export type TableDetail =
  | { variant: 'new'; table: NewTable }
  | { variant: 'modified'; table: ModifiedTable }
  | { variant: 'dropped'; name: string };

export interface TableChange {
  kind: 'table';
  id: string;
  name: string;
  status: ChangeStatus;
  preview: TablePreviewData;
  detail: TableDetail;
}

export interface RuleChange {
  kind: 'rule';
  id: string;
  name: string;
  status: ChangeStatus;
  detail: { rule: BusinessRule };
  /** Id of the api/table Change this rule attaches to, or null if standalone. */
  attachedToId: string | null;
}

// ─── Top level ──────────────────────────────────────────────────────────────

/**
 * Canonical state produced by the analysis pipeline. Selectors derive every
 * UI surface (diagram, index, overlay, markdown export) from this shape — no
 * parallel arrays to keep in sync.
 */
export interface PRDiagramData {
  meta: PRMeta;
  domains: string[];
  changes: Change[];
  edges: GraphEdge[];
}
