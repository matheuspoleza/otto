/**
 * LLM enrichment pipeline — narrative + actionable items for the PR.
 *
 * The LLM never produces the risk score. It can emit signal *keys* (mapped
 * to the same deterministic weights) plus per-PR contextual text. Citations
 * are mandatory and validated against the PR's actual file paths post-call.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ActionIconKind,
  ActionItem,
  ActionUrgency,
  APIChanges,
  BusinessRule,
  DataChanges,
  UIChanges,
} from './types';
import type { SignalKey } from './score';
import type { BusinessFileSample } from './pillars/business';

const SIGNAL_KEYS: SignalKey[] = [
  'touches_billing',
  'touches_auth',
  'breaking_api',
  'irreversible_migration',
  'large_diff_500_plus',
  'no_tests_added',
  'tests_added',
  'small_isolated_change',
];

const PILLAR_KEYS = ['ui', 'api', 'data', 'business'] as const;
type PillarKey = (typeof PILLAR_KEYS)[number];

const ACTION_ICON_KINDS: ActionIconKind[] = ['doc', 'bell', 'flask', 'chat'];
const ACTION_URGENCIES: ActionUrgency[] = ['Before merge', 'After merge'];

export interface LLMRawSignal {
  key: SignalKey;
  text: string;
  evidenceFiles: string[];
}

export interface LLMEnrichment {
  subtitle: string;
  signals: LLMRawSignal[];
  pillarDescriptions: Partial<Record<PillarKey, string>>;
  pillarWarnings: Partial<Record<PillarKey, string | null>>;
  actions: ActionItem[];
  businessRules: BusinessRule[];
}

const EMPTY: LLMEnrichment = {
  subtitle: '',
  signals: [],
  pillarDescriptions: {},
  pillarWarnings: {},
  actions: [],
  businessRules: [],
};

export const validateLLMResponse = (
  raw: unknown,
  ctx: { prPaths: string[] },
): LLMEnrichment => {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const obj = raw as Record<string, unknown>;

  const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle : '';
  const signals = validateSignals(obj.signals, ctx.prPaths);
  const actions = validateActions(obj.actions);
  const pillarDescriptions = validatePillarMap(obj.pillarDescriptions, false);
  const pillarWarnings = validatePillarMap(obj.pillarWarnings, true);
  const businessRules = validateBusinessRules(obj.businessRules);

  return { subtitle, signals, actions, pillarDescriptions, pillarWarnings, businessRules };
};

const stringArray = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];

const validateBusinessRules = (raw: unknown): BusinessRule[] => {
  if (!Array.isArray(raw)) return [];
  const out: BusinessRule[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || !e.name) continue;
    out.push({
      name: e.name,
      beforeText: typeof e.beforeText === 'string' ? e.beforeText : '',
      afterText: typeof e.afterText === 'string' ? e.afterText : '',
      beforeExamples: stringArray(e.beforeExamples),
      afterExamples: stringArray(e.afterExamples),
      highlights: stringArray(e.highlights),
    });
  }
  return out.slice(0, MAX_BUSINESS_RULES);
};

function validatePillarMap(raw: unknown, allowNull: false): Partial<Record<PillarKey, string>>;
function validatePillarMap(
  raw: unknown,
  allowNull: true,
): Partial<Record<PillarKey, string | null>>;
function validatePillarMap(
  raw: unknown,
  allowNull: boolean,
): Partial<Record<PillarKey, string | null>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<PillarKey, string | null>> = {};
  for (const key of PILLAR_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string') out[key] = value;
    else if (allowNull && value === null) out[key] = null;
  }
  return out;
}

// ─── Prompt + tool schema ───────────────────────────────────────────────────

export interface LLMContext {
  pr: {
    title: string;
    body: string | null;
    additions: number;
    deletions: number;
    changedFiles: number;
  };
  paths: string[];
  data: DataChanges;
  api: APIChanges;
  ui: UIChanges;
  businessSamples: BusinessFileSample[];
  deterministicSignals: SignalKey[];
}

const SYSTEM_PROMPT = `You are the narrative layer of PR Lens, a tool that summarizes a GitHub pull request for a MIXED audience — engineers, product managers, support leads, and designers reviewing a release.

The structural data (file diffs, schema changes, OpenAPI diff, route screenshots) is produced by deterministic tools BEFORE you. Your job is to translate those changes into PRODUCT IMPACT a non-engineer can act on.

Voice rules — non-negotiable:
- Write for a PM doing a release review, not for a senior engineer doing a code review.
- Lead with customer or product consequence. Mention code internals only when naming them is shorter than describing them.
- Prefer concrete business language over technical jargon. "Free users hit a hard cap at 50 AI credits" beats "evaluateAIGate enforces tier-based access via PLAN_RULES".
- Direct, present tense, no hedging. No exclamation marks, no celebrating, no "this PR ...".

Output structure rules:
- Risk signals: max 3, only the highest-stakes ones. Each must cite at least one path from Changed files.
- Actionable items: max 3, divided between "Before merge" (must happen before this PR lands) and "After merge" (do once shipped).
- Business rules: max 3. Names and texts kept tight; treat them like product release-note bullets, not engineering specs.
- Pillar descriptions and warnings: 1-2 sentences each, plain English, customer-relevant.
- If nothing useful to say for a field, omit it. Empty is preferred to filler.

Hard rules:
- Every risk signal must cite a file path that appears verbatim in Changed files. No invented paths.
- The risk score itself is computed deterministically — you do not produce it. You only add missing signals.`;

const TOOL_SCHEMA: Anthropic.Tool = {
  name: 'emit_enrichment',
  description: 'Emit narrative enrichment for the PR Lens analysis.',
  input_schema: {
    type: 'object',
    required: ['subtitle', 'signals', 'pillarDescriptions', 'pillarWarnings', 'actions'],
    properties: {
      subtitle: {
        type: 'string',
        maxLength: 200,
        description:
          'One or two sentences for a non-engineer reviewer. What changes for the customer or the team using the product. No markdown, no "this PR".',
      },
      signals: {
        type: 'array',
        maxItems: 3,
        description:
          'Up to 3 additional risk signals the deterministic detectors missed. Each cites at least one real path.',
        items: {
          type: 'object',
          required: ['key', 'text', 'evidenceFiles'],
          properties: {
            key: { type: 'string', enum: SIGNAL_KEYS },
            text: {
              type: 'string',
              maxLength: 100,
              description: 'One sentence on the risk in product terms, not code terms.',
            },
            evidenceFiles: { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
        },
      },
      pillarDescriptions: {
        type: 'object',
        description: 'One short sentence per pillar, in product language.',
        properties: {
          ui: { type: 'string', maxLength: 180 },
          api: { type: 'string', maxLength: 180 },
          data: { type: 'string', maxLength: 180 },
          business: { type: 'string', maxLength: 180 },
        },
      },
      pillarWarnings: {
        type: 'object',
        description:
          'Per-pillar single-sentence warning a reviewer should not miss. Null clears, omit if none.',
        properties: {
          ui: { type: ['string', 'null'] },
          api: { type: ['string', 'null'] },
          data: { type: ['string', 'null'] },
          business: { type: ['string', 'null'] },
        },
      },
      actions: {
        type: 'array',
        maxItems: 3,
        description:
          'Up to 3 owned, concrete actions split by urgency. Phrased so a PM or support lead can act on them, not just an engineer. The action text MUST NOT repeat the urgency prefix (e.g. do NOT write "Before merge: confirm…", just write "Confirm…").',
        items: {
          type: 'object',
          required: ['iconKind', 'text', 'urgency'],
          properties: {
            iconKind: { type: 'string', enum: ACTION_ICON_KINDS },
            text: {
              type: 'string',
              maxLength: 80,
              description:
                'Plain imperative sentence. Does NOT start with "Before merge:" or "After merge:" — the urgency is already declared in the urgency field.',
            },
            urgency: {
              type: 'string',
              enum: ACTION_URGENCIES,
              description:
                '"Before merge" = blocking, must happen before this PR lands. "After merge" = comms, docs, follow-up tickets — do once shipped.',
            },
          },
        },
      },
      businessRules: {
        type: 'array',
        maxItems: 3,
        description:
          'Up to 3 business rules introduced or changed. Extract only from business file samples (lib/, services/, etc.). Treat as release-note bullets, not engineering specs.',
        items: {
          type: 'object',
          required: [
            'name',
            'beforeText',
            'afterText',
            'beforeExamples',
            'afterExamples',
            'highlights',
          ],
          properties: {
            name: { type: 'string', maxLength: 60, description: 'Short rule name in product terms.' },
            beforeText: {
              type: 'string',
              maxLength: 120,
              description: 'One short sentence on the prior behavior. Empty if rule is new.',
            },
            afterText: {
              type: 'string',
              maxLength: 120,
              description: 'One short sentence on the new behavior.',
            },
            beforeExamples: {
              type: 'array',
              maxItems: 2,
              items: { type: 'string', maxLength: 80 },
              description: 'At most 2 concrete examples of the old behavior.',
            },
            afterExamples: {
              type: 'array',
              maxItems: 2,
              items: { type: 'string', maxLength: 80 },
            },
            highlights: {
              type: 'array',
              maxItems: 4,
              items: { type: 'string', maxLength: 32 },
              description:
                'Short terms (1-3 words) from beforeText/afterText to visually emphasize.',
            },
          },
        },
      },
    },
  },
};

export const buildLLMPrompt = (ctx: LLMContext): string => {
  const lines: string[] = [];
  lines.push(`PR title: ${ctx.pr.title}`);
  if (ctx.pr.body) {
    const trimmed = ctx.pr.body.replace(/```[\s\S]*?```/g, '').slice(0, 800).trim();
    if (trimmed) lines.push(`PR body excerpt:\n${trimmed}`);
  }
  lines.push(
    `Diff scale: ${ctx.pr.changedFiles} files, +${ctx.pr.additions} / −${ctx.pr.deletions} lines`,
  );
  lines.push('');
  lines.push('Changed files:');
  for (const p of ctx.paths) lines.push(`  ${p}`);
  lines.push('');
  lines.push('--- Data pillar findings ---');
  if (ctx.data.count === 0) lines.push('(none)');
  else {
    lines.push(ctx.data.description);
    if (ctx.data.newTables.length)
      lines.push(`New tables: ${ctx.data.newTables.map((t) => t.name).join(', ')}`);
    if (ctx.data.modifiedTables.length)
      lines.push(`Modified tables: ${ctx.data.modifiedTables.map((t) => t.name).join(', ')}`);
    if (ctx.data.droppedTables.length)
      lines.push(`Dropped tables: ${ctx.data.droppedTables.join(', ')}`);
    lines.push(`Reversible: ${ctx.data.isReversible ? 'yes' : 'no'}`);
  }
  lines.push('');
  lines.push('--- API pillar findings ---');
  if (ctx.api.count === 0) lines.push('(none)');
  else {
    lines.push(ctx.api.description);
    for (const e of ctx.api.endpoints) {
      lines.push(`  ${e.method} ${e.path} — ${e.changeType}`);
    }
  }
  lines.push('');
  lines.push('--- UI pillar findings ---');
  if (ctx.ui.count === 0) lines.push('(none)');
  else {
    lines.push(ctx.ui.description);
    for (const c of ctx.ui.changedComponents) lines.push(`  [${c.changeType}] ${c.file}`);
  }
  lines.push('');
  lines.push('--- Business file samples (extract rules from these only) ---');
  if (ctx.businessSamples.length === 0) {
    lines.push('(no business files in this PR — emit empty businessRules)');
  } else {
    for (const s of ctx.businessSamples) {
      lines.push(`[${s.status}] ${s.path}`);
      if (s.content) {
        lines.push('```');
        lines.push(s.content);
        lines.push('```');
      }
    }
  }
  lines.push('');
  lines.push(
    `Already-detected risk signals (do not duplicate): ${ctx.deterministicSignals.join(', ') || '(none)'}`,
  );
  lines.push('');
  lines.push('Emit a single emit_enrichment tool call with the requested fields.');
  return lines.join('\n');
};

// ─── Anthropic call ─────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

export const enrichWithLLM = async (ctx: LLMContext): Promise<LLMEnrichment | null> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'emit_enrichment' },
      messages: [{ role: 'user', content: buildLLMPrompt(ctx) }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) return null;

    return validateLLMResponse(toolUse.input, { prPaths: ctx.paths });
  } catch (e) {
    console.error('LLM enrichment failed:', e);
    return null;
  }
};

const validateActions = (raw: unknown): ActionItem[] => {
  if (!Array.isArray(raw)) return [];
  const out: ActionItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;

    const iconKind = e.iconKind;
    if (typeof iconKind !== 'string' || !ACTION_ICON_KINDS.includes(iconKind as ActionIconKind)) {
      continue;
    }

    const urgency = e.urgency;
    if (typeof urgency !== 'string' || !ACTION_URGENCIES.includes(urgency as ActionUrgency)) {
      continue;
    }

    const text = e.text;
    if (typeof text !== 'string' || !text) continue;

    out.push({
      iconKind: iconKind as ActionIconKind,
      urgency: urgency as ActionUrgency,
      text,
    });
  }
  return out.slice(0, MAX_ACTIONS);
};

const MAX_SIGNALS = 3;
const MAX_ACTIONS = 3;
const MAX_BUSINESS_RULES = 3;

const validateSignals = (raw: unknown, prPaths: string[]): LLMRawSignal[] => {
  if (!Array.isArray(raw)) return [];
  const pathSet = new Set(prPaths);

  const out: LLMRawSignal[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;

    const key = e.key;
    if (typeof key !== 'string' || !SIGNAL_KEYS.includes(key as SignalKey)) continue;

    const text = typeof e.text === 'string' ? e.text : '';
    if (!text) continue;

    if (!Array.isArray(e.evidenceFiles)) continue;
    const validEvidence = e.evidenceFiles
      .filter((p): p is string => typeof p === 'string')
      .filter((p) => pathSet.has(p));
    if (validEvidence.length === 0) continue;

    out.push({ key: key as SignalKey, text, evidenceFiles: validEvidence });
  }
  return out.slice(0, MAX_SIGNALS);
};
