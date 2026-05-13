/**
 * LLM enrichment pipeline.
 *
 * After the UX revision, the LLM only produces what the diagram and overlay
 * actually show: a customer-facing PR subtitle, and the business rules that
 * appear as badges on API nodes. Everything else (risk scoring, actionable
 * items, pillar warnings) is now deterministic or dropped.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { APIChanges, BusinessRule, DataChanges, UIChanges } from './types';
import type { BusinessFileSample } from './extractors/business';

export interface LLMEnrichment {
  subtitle: string;
  businessRules: BusinessRule[];
}

const EMPTY: LLMEnrichment = {
  subtitle: '',
  businessRules: [],
};

export const validateLLMResponse = (raw: unknown): LLMEnrichment => {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const obj = raw as Record<string, unknown>;

  const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle : '';
  const businessRules = validateBusinessRules(obj.businessRules);

  return { subtitle, businessRules };
};

const stringArray = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];

const MAX_BUSINESS_RULES = 3;

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
}

const SYSTEM_PROMPT = `You are the narrative layer of PR Diagram, a tool that summarizes a GitHub pull request for a MIXED audience — engineers, product managers, support leads, and designers reviewing a release.

The structural data (file diffs, schema changes, OpenAPI diff, route screenshots) is produced by deterministic tools BEFORE you. Your job is to translate those changes into PRODUCT IMPACT a non-engineer can act on.

Voice rules — non-negotiable:
- Write for a PM doing a release review, not for a senior engineer doing a code review.
- Lead with customer or product consequence. Mention code internals only when naming them is shorter than describing them.
- Prefer concrete business language over technical jargon.
- Direct, present tense, no hedging. No exclamation marks, no celebrating, no "this PR ...".

Output structure rules:
- Subtitle: one or two sentences. What the customer or the team using the product sees change.
- Business rules: up to 3. Names and texts kept tight; treat them like product release-note bullets, not engineering specs.
- If nothing useful to say for a field, omit it. Empty is preferred to filler.`;

const TOOL_SCHEMA: Anthropic.Tool = {
  name: 'emit_enrichment',
  description: 'Emit narrative enrichment for the PR Diagram analysis.',
  input_schema: {
    type: 'object',
    required: ['subtitle'],
    properties: {
      subtitle: {
        type: 'string',
        maxLength: 200,
        description:
          'One or two sentences for a non-engineer reviewer. What changes for the customer or the team using the product. No markdown, no "this PR".',
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
  const dataIsEmpty =
    ctx.data.newTables.length === 0 &&
    ctx.data.modifiedTables.length === 0 &&
    ctx.data.droppedTables.length === 0;
  if (dataIsEmpty) lines.push('(none)');
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
  if (ctx.api.endpoints.length === 0) lines.push('(none)');
  else {
    lines.push(ctx.api.description);
    for (const e of ctx.api.endpoints) {
      lines.push(`  ${e.method} ${e.path} — ${e.changeType}`);
    }
  }
  lines.push('');
  lines.push('--- UI pillar findings ---');
  const uiIsEmpty =
    ctx.ui.changedComponents.length === 0 && ctx.ui.screenshots.length === 0;
  if (uiIsEmpty) lines.push('(none)');
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

    return validateLLMResponse(toolUse.input);
  } catch (e) {
    console.error('LLM enrichment failed:', e);
    return null;
  }
};
