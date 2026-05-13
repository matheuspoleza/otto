/**
 * Shape produced by the analysis pipeline and consumed by the PRLens UI.
 * All fields must be JSON-serializable so this can cross the RSC boundary.
 */

// ─── Target repo config (lives in the analyzed repo as prlens.config.json) ──

export type PreviewProvider = 'vercel' | 'netlify';
export type Viewport = 'desktop' | 'mobile';

export interface PRLensConfigRoute {
  path: string;
  name: string;
}

export interface PRLensConfigPreview {
  provider: PreviewProvider;
  routes: PRLensConfigRoute[];
}

export interface PRLensConfig {
  preview?: PRLensConfigPreview;
  openapi?: string;
  prisma?: string;
  viewports?: Viewport[];
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type RiskSignalType = 'warn' | 'good';

export interface RiskSignal {
  type: RiskSignalType;
  text: string;
  key?: string;
  evidenceFiles?: string[];
}

export type ActionIconKind = 'doc' | 'bell' | 'flask' | 'chat';

export type ActionUrgency = 'Before merge' | 'After merge';

export interface ActionItem {
  iconKind: ActionIconKind;
  text: string;
  urgency: ActionUrgency;
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

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
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
  count: number;
  description: string;
  changedComponents: ChangedComponent[];
  screenshots: RouteScreenshot[];
  warning: string | null;
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
  count: number;
  description: string;
  endpoints: EndpointChange[];
  warning: string | null;
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
  count: number;
  description: string;
  newTables: NewTable[];
  modifiedTables: ModifiedTable[];
  droppedTables: string[];
  isReversible: boolean;
  warning: string | null;
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
  count: number;
  description: string;
  rules: BusinessRule[];
  warning: string | null;
}

// ─── Top level ──────────────────────────────────────────────────────────────

export interface PRLensData {
  meta: PRMeta;
  risk: RiskAssessment;
  domains: string[];
  actions: ActionItem[];
  changes: {
    ui: UIChanges;
    api: APIChanges;
    data: DataChanges;
    business: BusinessChanges;
  };
}
