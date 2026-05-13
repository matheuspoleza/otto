/**
 * Checks whether a target repo satisfies the controlled-scenario contract
 * needed for PR Diagram analysis: TypeScript, OpenAPI spec, Prisma schema,
 * and a prdiagram.config.json declaring routes and paths.
 *
 * Strategy: one tree listing call to map the repo's file paths, then targeted
 * content fetches only for files we actually need to read (the config).
 */

import type {
  PRDiagramConfig,
  PRDiagramConfigPreview,
  PRDiagramConfigRoute,
  Viewport,
} from './types';
import { getFileContent, getRepoTree } from './adapters/github';

export type MissingRequirementKind =
  | 'typescript'
  | 'openapi'
  | 'prisma'
  | 'prdiagram-config-missing'
  | 'prdiagram-config-invalid'
  | 'prdiagram-config-incomplete';

export interface MissingRequirement {
  kind: MissingRequirementKind;
  description: string;
  searchedPaths?: string[];
}

export interface RepoProfile {
  hasTypeScript: boolean;
  openapiPath: string;
  prismaPath: string;
  routes: PRDiagramConfigRoute[];
  viewports: Viewport[];
}

export type EligibilityResult =
  | { eligible: true; config: PRDiagramConfig; profile: RepoProfile }
  | { eligible: false; missing: MissingRequirement[] };

const TYPESCRIPT_INDICATOR = 'tsconfig.json';
const PRDIAGRAM_CONFIG_PATH = 'prdiagram.config.json';
// Back-compat: repos onboarded under the old name still work until they migrate.
const LEGACY_CONFIG_PATH = 'prlens.config.json';

const OPENAPI_CANDIDATE_PATHS = [
  'openapi.yaml',
  'openapi.yml',
  'openapi.json',
  'specs/openapi.yaml',
  'specs/openapi.yml',
  'specs/openapi.json',
];

const PRISMA_CANDIDATE_PATHS = ['prisma/schema.prisma'];

export const checkEligibility = async ({
  owner,
  repo,
  ref,
}: {
  owner: string;
  repo: string;
  ref: string;
}): Promise<EligibilityResult> => {
  const { entries } = await getRepoTree({ owner, repo, ref });
  const paths = new Set(entries.filter((e) => e.type === 'blob').map((e) => e.path));

  const missing: MissingRequirement[] = [];

  const hasTypeScript = paths.has(TYPESCRIPT_INDICATOR);
  if (!hasTypeScript) {
    missing.push({
      kind: 'typescript',
      description: 'PR Diagram needs a TypeScript project (tsconfig.json at the repo root).',
      searchedPaths: [TYPESCRIPT_INDICATOR],
    });
  }

  const configPath = paths.has(PRDIAGRAM_CONFIG_PATH)
    ? PRDIAGRAM_CONFIG_PATH
    : paths.has(LEGACY_CONFIG_PATH)
      ? LEGACY_CONFIG_PATH
      : null;

  let configRaw: string | null = null;
  if (configPath) {
    configRaw = await getFileContent({ owner, repo, path: configPath, ref });
  } else {
    missing.push({
      kind: 'prdiagram-config-missing',
      description: 'A prdiagram.config.json file is required at the repo root.',
      searchedPaths: [PRDIAGRAM_CONFIG_PATH, LEGACY_CONFIG_PATH],
    });
  }

  const parsedConfig = configRaw !== null ? parseConfig(configRaw) : null;
  if (configRaw !== null && parsedConfig === null) {
    missing.push({
      kind: 'prdiagram-config-invalid',
      description: 'prdiagram.config.json exists but is not valid JSON.',
    });
  }

  const openapiPath = resolvePath({
    declared: parsedConfig?.openapi,
    candidates: OPENAPI_CANDIDATE_PATHS,
    paths,
  });
  if (!openapiPath) {
    missing.push({
      kind: 'openapi',
      description: 'PR Diagram needs an OpenAPI spec at a known path.',
      searchedPaths: parsedConfig?.openapi
        ? [parsedConfig.openapi]
        : OPENAPI_CANDIDATE_PATHS,
    });
  }

  const prismaPath = resolvePath({
    declared: parsedConfig?.prisma,
    candidates: PRISMA_CANDIDATE_PATHS,
    paths,
  });
  if (!prismaPath) {
    missing.push({
      kind: 'prisma',
      description: 'PR Diagram needs a Prisma schema at a known path.',
      searchedPaths: parsedConfig?.prisma
        ? [parsedConfig.prisma]
        : PRISMA_CANDIDATE_PATHS,
    });
  }

  if (parsedConfig && (!parsedConfig.preview || parsedConfig.preview.routes.length === 0)) {
    missing.push({
      kind: 'prdiagram-config-incomplete',
      description:
        'prdiagram.config.json must declare a `preview` section with at least one route to screenshot.',
    });
  }

  if (missing.length > 0) {
    return { eligible: false, missing };
  }

  const config = parsedConfig as PRDiagramConfig;
  return {
    eligible: true,
    config,
    profile: {
      hasTypeScript: true,
      openapiPath: openapiPath as string,
      prismaPath: prismaPath as string,
      routes: config.preview?.routes ?? [],
      viewports: config.viewports ?? ['desktop'],
    },
  };
};

export const resolvePath = ({
  declared,
  candidates,
  paths,
}: {
  declared?: string;
  candidates: string[];
  paths: Set<string>;
}): string | null => {
  if (declared) {
    return paths.has(declared) ? declared : null;
  }
  return candidates.find((p) => paths.has(p)) ?? null;
};

export const parseConfig = (raw: string): PRDiagramConfig | null => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;

  const config: PRDiagramConfig = {};

  if (typeof obj.openapi === 'string') config.openapi = obj.openapi;
  if (typeof obj.prisma === 'string') config.prisma = obj.prisma;

  if (Array.isArray(obj.viewports)) {
    const validViewports = obj.viewports.filter(
      (v): v is 'desktop' | 'mobile' => v === 'desktop' || v === 'mobile',
    );
    if (validViewports.length > 0) config.viewports = validViewports;
  }

  if (obj.preview && typeof obj.preview === 'object') {
    const preview = parsePreview(obj.preview as Record<string, unknown>);
    if (preview) config.preview = preview;
  }

  return config;
};

const parsePreview = (raw: Record<string, unknown>): PRDiagramConfigPreview | null => {
  const provider = raw.provider;
  if (provider !== 'vercel' && provider !== 'netlify') return null;
  if (!Array.isArray(raw.routes)) return null;

  const routes: PRDiagramConfigRoute[] = [];
  for (const r of raw.routes) {
    if (r && typeof r === 'object') {
      const obj = r as Record<string, unknown>;
      if (typeof obj.path === 'string' && typeof obj.name === 'string') {
        routes.push({ path: obj.path, name: obj.name });
      }
    }
  }
  return { provider, routes };
};
