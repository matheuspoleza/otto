/**
 * Selector: formats the canonical ChangeSet as markdown for an LLM chat. Two
 * entry points:
 *
 * - `toMarkdown` — bare markdown summary (no framing).
 * - `toChatPrompt` — wraps the summary with explicit chat framing so the LLM
 *   treats it as the context for a discussion, not a one-shot dump. Used by
 *   the "Chat with AI" CTA.
 */

import type {
  ApiChange,
  EndpointChange,
  GraphEdge,
  PageChange,
  PRDiagramData,
  RouteScreenshot,
  RuleChange,
  TableChange,
} from '../types';

/**
 * Wraps the structured summary in a chat-oriented prompt: tells the LLM what
 * the user is trying to do (review/discuss a PR), surfaces the original PR
 * link prominently, and ends with a kickoff question to seed the conversation.
 */
export const toChatPrompt = (data: PRDiagramData): string => {
  const summary = toMarkdown(data);
  return [
    `I'm reviewing pull request **#${data.meta.number}** in **${data.meta.owner}/${data.meta.repo}** and want to discuss it with you. Below is a structured summary of the changes; the original PR is at the link above the summary. Please help me understand the change, flag anything risky, and answer follow-up questions as I explore.`,
    '',
    `**Original PR:** ${data.meta.htmlUrl}`,
    '',
    '---',
    '',
    summary,
    '',
    '---',
    '',
    'To start, give me a brief plain-English summary of what this PR does and the single most important thing a reviewer should know. Then wait for my follow-up questions.',
  ].join('\n');
};

export const toMarkdown = (data: PRDiagramData): string => {
  const sections: string[] = [];

  sections.push(meta(data));

  if (data.domains.length > 0) sections.push(domains(data.domains));

  const pages = data.changes.filter((c): c is PageChange => c.kind === 'page');
  if (pages.length > 0) sections.push(uiSection(pages));

  const apis = data.changes.filter((c): c is ApiChange => c.kind === 'api');
  if (apis.length > 0) sections.push(apiSection(apis));

  const tables = data.changes.filter((c): c is TableChange => c.kind === 'table');
  if (tables.length > 0) sections.push(dataSection(tables));

  const rules = data.changes.filter((c): c is RuleChange => c.kind === 'rule');
  if (rules.length > 0) sections.push(businessSection(rules));

  if (data.edges.length > 0) sections.push(connectionsSection(data.edges));

  return sections.join('\n\n');
};

const meta = (data: PRDiagramData): string => {
  const m = data.meta;
  return [
    `# PR #${m.number}: ${m.title}`,
    '',
    `**Repository:** ${m.owner}/${m.repo}`,
    `**Author:** @${m.author}`,
    `**State:** ${m.stateLabel}`,
    `**GitHub:** ${m.htmlUrl}`,
    '',
    '## Description',
    '',
    m.subtitle,
  ].join('\n');
};

const domains = (list: string[]): string =>
  `## Domains affected\n\n${list.map((d) => `- ${d}`).join('\n')}`;

const uiSection = (pages: PageChange[]): string => {
  const parts: string[] = ['## Frontend changes', '', '### Pages'];
  for (const page of pages) {
    parts.push('', pageEntry(page.detail.screenshot));
  }
  return parts.join('\n');
};

const pageEntry = (shot: RouteScreenshot): string => {
  const status = !shot.beforeUrl && shot.afterUrl
    ? 'new'
    : shot.beforeUrl && !shot.afterUrl
      ? 'removed'
      : 'modified';
  return `- **${shot.name}** (${status}) — route \`${shot.path}\``;
};

const apiSection = (apis: ApiChange[]): string => {
  const parts: string[] = ['## API changes', ''];
  for (const change of apis) {
    parts.push(endpointEntry(change.detail.endpoint), '');
  }
  return parts.join('\n').trimEnd();
};

const endpointEntry = (e: EndpointChange): string => {
  const lines: string[] = [`### ${e.method} ${e.path} — ${e.changeType}`];
  if (e.breakingReason) lines.push('', `> Breaking: ${e.breakingReason}`);
  if (e.requestBefore !== null || e.requestAfter !== null) {
    lines.push('', jsonDiff('Request', e.requestBefore, e.requestAfter));
  }
  if (e.responseBefore !== null || e.responseAfter !== null) {
    lines.push('', jsonDiff('Response', e.responseBefore, e.responseAfter));
  }
  return lines.join('\n');
};

const jsonDiff = (label: string, before: unknown, after: unknown): string => {
  const beforeEmpty = before === null || before === undefined;
  const afterEmpty = after === null || after === undefined;
  if (beforeEmpty && !afterEmpty) {
    return `**${label} (new):**\n\`\`\`json\n${JSON.stringify(after, null, 2)}\n\`\`\``;
  }
  if (!beforeEmpty && afterEmpty) {
    return `**${label} (removed):**\n\`\`\`json\n${JSON.stringify(before, null, 2)}\n\`\`\``;
  }
  return [
    `**${label} before:**`,
    '```json',
    JSON.stringify(before, null, 2),
    '```',
    `**${label} after:**`,
    '```json',
    JSON.stringify(after, null, 2),
    '```',
  ].join('\n');
};

const dataSection = (tables: TableChange[]): string => {
  const parts: string[] = ['## Database changes', ''];
  for (const change of tables) {
    const detail = change.detail;
    if (detail.variant === 'new') parts.push(newTableEntry(detail.table), '');
    else if (detail.variant === 'modified') parts.push(modifiedTableEntry(detail.table), '');
    else parts.push(`### ${detail.name} (dropped)`, '');
  }
  return parts.join('\n').trimEnd();
};

const newTableEntry = (
  t: Extract<TableChange['detail'], { variant: 'new' }>['table'],
): string => {
  const cols = t.columns.map((c) => `- \`${c.name}\` (${c.type})${pkFkSuffix(c)}`).join('\n');
  return `### ${t.name} (new table)\n${cols}`;
};

const modifiedTableEntry = (
  t: Extract<TableChange['detail'], { variant: 'modified' }>['table'],
): string => {
  const lines: string[] = [`### ${t.name} (modified)`];
  if (t.addedColumns.length > 0) {
    lines.push('', '**Added columns:**');
    for (const c of t.addedColumns) lines.push(`- \`${c.name}\` (${c.type})${pkFkSuffix(c)}`);
  }
  if (t.typeChanges.length > 0) {
    lines.push('', '**Type changes:**');
    for (const c of t.typeChanges) lines.push(`- \`${c.column}\`: ${c.before} → ${c.after}`);
  }
  if (t.droppedColumns.length > 0) {
    lines.push('', '**Dropped columns:**');
    for (const name of t.droppedColumns) lines.push(`- \`${name}\``);
  }
  return lines.join('\n');
};

const pkFkSuffix = (col: { isPrimaryKey?: boolean; foreignKey?: string }): string => {
  const parts: string[] = [];
  if (col.isPrimaryKey) parts.push('PK');
  if (col.foreignKey) parts.push(`FK → ${col.foreignKey}`);
  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
};

const businessSection = (rules: RuleChange[]): string => {
  const parts: string[] = ['## Business rules', ''];
  for (const change of rules) {
    const rule = change.detail.rule;
    parts.push(
      `### ${rule.name}`,
      '',
      `**Before:** ${rule.beforeText}`,
      '',
      `**After:** ${rule.afterText}`,
    );
    if (rule.beforeExamples.length > 0 || rule.afterExamples.length > 0) {
      parts.push('', '**Examples:**');
      for (const ex of rule.afterExamples) parts.push(`- ${ex}`);
    }
    parts.push('');
  }
  return parts.join('\n').trimEnd();
};

const connectionsSection = (edges: GraphEdge[]): string => {
  const lines = edges.map((e) => {
    const from = stripPrefix(e.source);
    const to = stripPrefix(e.target);
    const label = e.label ? ` [${e.label}]` : '';
    return `- ${from} →${label} ${to}`;
  });
  return `## Structural connections\n\n${lines.join('\n')}`;
};

const stripPrefix = (id: string): string => id.replace(/^(page|api|table):/, '');
