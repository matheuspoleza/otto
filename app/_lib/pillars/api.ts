/**
 * API pillar — diffs two parsed OpenAPI documents and maps the result to the
 * APIChanges shape consumed by the UI.
 *
 * The diff is a pure function over already-parsed JS objects. Network and
 * YAML parsing live in analyzeAPIPillar (added in a later step).
 */

import { parse as parseYaml } from 'yaml';
import { getFileContent, getPRFiles } from '../github';
import type { APIChanges, EndpointChange, HttpMethod } from '../types';

interface AnalyzeAPIParams {
  owner: string;
  repo: string;
  prNumber: number;
  baseSha: string;
  headSha: string;
  openapiPath: string;
}

export const analyzeAPIPillar = async ({
  owner,
  repo,
  prNumber,
  baseSha,
  headSha,
  openapiPath,
}: AnalyzeAPIParams): Promise<APIChanges> => {
  const files = await getPRFiles({ owner, repo, number: prNumber });
  const changed = files.some((f) => f.filename === openapiPath);
  if (!changed) return emptyAPIChanges();

  const [baseRaw, headRaw] = await Promise.all([
    getFileContent({ owner, repo, path: openapiPath, ref: baseSha }),
    getFileContent({ owner, repo, path: openapiPath, ref: headSha }),
  ]);

  const beforeSpec = baseRaw ? safeParseYaml(baseRaw) : {};
  const afterSpec = headRaw ? safeParseYaml(headRaw) : {};

  return buildAPIChanges(diffOpenAPI(beforeSpec, afterSpec));
};

const emptyAPIChanges = (): APIChanges => ({
  count: 0,
  description: '',
  endpoints: [],
  warning: null,
});

const safeParseYaml = (raw: string): unknown => {
  try {
    return parseYaml(raw);
  } catch {
    return {};
  }
};

export interface EndpointEntry {
  method: string;
  path: string;
  operation: unknown;
}

export interface ModifiedEndpoint {
  method: string;
  path: string;
  before: unknown;
  after: unknown;
  breaking: boolean;
  breakingReasons: string[];
}

export interface RawAPIDiff {
  added: EndpointEntry[];
  removed: EndpointEntry[];
  modified: ModifiedEndpoint[];
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

const collectEndpoints = (spec: unknown): EndpointEntry[] => {
  const paths = (spec as { paths?: unknown } | null | undefined)?.paths;
  if (!paths || typeof paths !== 'object') return [];
  const out: EndpointEntry[] = [];
  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const item = pathItem as Record<string, unknown>;
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (operation && typeof operation === 'object') {
        out.push({ method: method.toUpperCase(), path, operation });
      }
    }
  }
  return out;
};

const keyOf = (e: { method: string; path: string }) => `${e.method} ${e.path}`;

export const diffOpenAPI = (before: unknown, after: unknown): RawAPIDiff => {
  const beforeEndpoints = collectEndpoints(before);
  const afterEndpoints = collectEndpoints(after);

  const beforeMap = new Map(beforeEndpoints.map((e) => [keyOf(e), e]));
  const afterMap = new Map(afterEndpoints.map((e) => [keyOf(e), e]));

  const added: EndpointEntry[] = [];
  const removed: EndpointEntry[] = [];
  const modified: ModifiedEndpoint[] = [];

  for (const [key, entry] of afterMap) {
    if (!beforeMap.has(key)) {
      added.push(entry);
      continue;
    }
    const beforeOp = beforeMap.get(key)!.operation;
    if (!isEqualOperation(beforeOp, entry.operation)) {
      const breakingReasons = detectBreakingChanges(beforeOp, entry.operation);
      modified.push({
        method: entry.method,
        path: entry.path,
        before: beforeOp,
        after: entry.operation,
        breaking: breakingReasons.length > 0,
        breakingReasons,
      });
    }
  }
  for (const [key, entry] of beforeMap) {
    if (!afterMap.has(key)) removed.push(entry);
  }

  return { added, removed, modified };
};

export const buildAPIChanges = (diff: RawAPIDiff): APIChanges => {
  const endpoints: EndpointChange[] = [];

  for (const e of diff.added) {
    endpoints.push({
      method: e.method as HttpMethod,
      path: e.path,
      changeType: 'added',
      requestBefore: null,
      requestAfter: extractRequestSchema(e.operation),
      responseBefore: null,
      responseAfter: extractResponseSchema(e.operation),
      breakingReason: null,
    });
  }

  for (const e of diff.removed) {
    endpoints.push({
      method: e.method as HttpMethod,
      path: e.path,
      changeType: 'removed',
      requestBefore: extractRequestSchema(e.operation),
      requestAfter: null,
      responseBefore: extractResponseSchema(e.operation),
      responseAfter: null,
      breakingReason: null,
    });
  }

  for (const m of diff.modified) {
    endpoints.push({
      method: m.method as HttpMethod,
      path: m.path,
      changeType: m.breaking ? 'breaking' : 'modified',
      requestBefore: extractRequestSchema(m.before),
      requestAfter: extractRequestSchema(m.after),
      responseBefore: extractResponseSchema(m.before),
      responseAfter: extractResponseSchema(m.after),
      breakingReason: m.breakingReasons.length > 0 ? m.breakingReasons.join('; ') : null,
    });
  }

  const count = endpoints.length;
  const description = count === 0 ? '' : buildDescription(diff);
  const warning = buildWarning(diff);

  return { count, description, endpoints, warning };
};

const buildDescription = (diff: RawAPIDiff): string => {
  const parts: string[] = [];
  if (diff.added.length > 0) {
    parts.push(`Adds ${pluralize(diff.added.length, 'new endpoint')}.`);
  }
  if (diff.modified.length > 0) {
    parts.push(`Modifies ${pluralize(diff.modified.length, 'endpoint')}.`);
  }
  if (diff.removed.length > 0) {
    parts.push(`Removes ${pluralize(diff.removed.length, 'endpoint')}.`);
  }
  return parts.join(' ');
};

const buildWarning = (diff: RawAPIDiff): string | null => {
  if (diff.removed.length > 0) {
    return 'Removed endpoints are a breaking change for any existing client.';
  }
  const breakingCount = diff.modified.filter((m) => m.breaking).length;
  if (breakingCount > 0) {
    return `${pluralize(breakingCount, 'endpoint')} has breaking changes that may affect existing clients.`;
  }
  return null;
};

const pluralize = (n: number, singular: string): string =>
  n === 1 ? `1 ${singular}` : `${n} ${singular}s`;

const SUCCESS_RESPONSE_CODES = ['200', '201', '202', '204'] as const;

const extractRequestSchema = (operation: unknown): unknown => {
  const content = (operation as { requestBody?: { content?: unknown } } | null)?.requestBody?.content;
  if (!content || typeof content !== 'object') return null;
  for (const mediaType of Object.values(content as Record<string, unknown>)) {
    const schema = (mediaType as { schema?: unknown } | null)?.schema;
    if (schema) return schema;
  }
  return null;
};

const extractResponseSchema = (operation: unknown): unknown => {
  const responses = (operation as { responses?: unknown } | null)?.responses;
  if (!responses || typeof responses !== 'object') return null;
  const resp = responses as Record<string, unknown>;
  for (const code of SUCCESS_RESPONSE_CODES) {
    const r = resp[code];
    if (!r || typeof r !== 'object') continue;
    const content = (r as { content?: unknown }).content;
    if (!content || typeof content !== 'object') continue;
    for (const mediaType of Object.values(content as Record<string, unknown>)) {
      const schema = (mediaType as { schema?: unknown } | null)?.schema;
      if (schema) return schema;
    }
  }
  return null;
};

const isEqualOperation = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const detectBreakingChanges = (before: unknown, after: unknown): string[] => {
  const reasons: string[] = [];

  const beforeRequired = getRequestBodyRequired(before);
  const afterRequired = getRequestBodyRequired(after);
  const beforeSet = new Set(beforeRequired);
  const newlyRequired = afterRequired.filter((r) => !beforeSet.has(r));
  if (newlyRequired.length > 0) {
    reasons.push(`New required request property: ${newlyRequired.join(', ')}`);
  }

  return reasons;
};

const getRequestBodyRequired = (operation: unknown): string[] => {
  const content = (operation as { requestBody?: { content?: unknown } } | null)?.requestBody?.content;
  if (!content || typeof content !== 'object') return [];
  for (const mediaType of Object.values(content as Record<string, unknown>)) {
    const required = (mediaType as { schema?: { required?: unknown } } | null)?.schema?.required;
    if (Array.isArray(required)) return required.filter((r): r is string => typeof r === 'string');
  }
  return [];
};
