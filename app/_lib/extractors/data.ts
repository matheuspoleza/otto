/**
 * Data pillar — extracts schema changes from new Prisma migration files
 * added by the PR. Maps the parsed SQL to the DataChanges shape consumed
 * by the UI.
 *
 * Parser is regex-based against Prisma's emitted SQL format (consistent,
 * always-quoted identifiers). Not a general SQL parser.
 */

import { getFileContent, getPRFiles } from '../adapters/github';
import type { DataChanges, ModifiedTable, NewTable, SchemaColumn } from '../types';

export interface ParsedSQL {
  newEnums: { name: string; values: string[] }[];
  newTables: NewTable[];
  modifiedTables: Map<string, ModifiedTable>;
  droppedTables: string[];
  foreignKeys: { table: string; column: string; references: string }[];
}

export const createEmptyParsed = (): ParsedSQL => ({
  newEnums: [],
  newTables: [],
  modifiedTables: new Map(),
  droppedTables: [],
  foreignKeys: [],
});

/**
 * Convenience wrapper: parses a single migration SQL string and applies
 * foreign-key constraints. Used by tests; production accumulates into a
 * shared target via parseMigration + applyForeignKeys directly.
 */
export const parseMigrationSQL = (sql: string): ParsedSQL => {
  const target = createEmptyParsed();
  parseMigration(sql, target);
  applyForeignKeys(target);
  return target;
};

export const applyForeignKeys = (target: ParsedSQL): void => {
  for (const fk of target.foreignKeys) {
    const table = target.newTables.find((t) => t.name === fk.table);
    if (!table) continue;
    const col = table.columns.find((c) => c.name === fk.column);
    if (col) col.foreignKey = fk.references;
  }
};

interface AnalyzeDataParams {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
}

const MIGRATION_PATH_RE = /^prisma\/migrations\/[^/]+\/migration\.sql$/;

export const analyzeDataPillar = async ({
  owner,
  repo,
  prNumber,
  headSha,
}: AnalyzeDataParams): Promise<DataChanges> => {
  const files = await getPRFiles({ owner, repo, number: prNumber });
  const migrationFiles = files.filter(
    (f) => f.status === 'added' && MIGRATION_PATH_RE.test(f.filename),
  );

  const merged = createEmptyParsed();

  for (const f of migrationFiles) {
    const sql = await getFileContent({ owner, repo, path: f.filename, ref: headSha });
    if (!sql) continue;
    parseMigration(sql, merged);
  }

  applyForeignKeys(merged);
  return buildDataChanges(merged);
};

// ─── Parsing ────────────────────────────────────────────────────────────────

export const parseMigration = (sql: string, target: ParsedSQL): void => {
  const stripped = sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  for (const stmt of splitStatements(stripped)) {
    parseStatement(stmt, target);
  }
};

const splitStatements = (sql: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && sql[i - 1] !== '\\') inString = !inString;
    if (!inString) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ';' && depth === 0) {
        if (current.trim()) out.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
};

const parseStatement = (stmt: string, target: ParsedSQL): void => {
  const enumMatch = stmt.match(/^CREATE TYPE\s+"(\w+)"\s+AS\s+ENUM\s*\(([^)]+)\)/i);
  if (enumMatch) {
    const values = [...enumMatch[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    target.newEnums.push({ name: enumMatch[1], values });
    return;
  }

  const tableMatch = stmt.match(/^CREATE TABLE\s+"(\w+)"\s*\(([\s\S]+)\)\s*$/i);
  if (tableMatch) {
    const name = tableMatch[1];
    const columns = parseTableBody(tableMatch[2]);
    target.newTables.push({ name, columns });
    return;
  }

  const fkMatch = stmt.match(
    /^ALTER TABLE\s+"(\w+)"\s+ADD\s+CONSTRAINT\s+"\w+"\s+FOREIGN KEY\s*\(\s*"(\w+)"\s*\)\s+REFERENCES\s+"(\w+)"\s*\(\s*"(\w+)"\s*\)/i,
  );
  if (fkMatch) {
    target.foreignKeys.push({
      table: fkMatch[1],
      column: fkMatch[2],
      references: `${fkMatch[3]}.${fkMatch[4]}`,
    });
    return;
  }

  const addColMatch = stmt.match(/^ALTER TABLE\s+"(\w+)"\s+ADD\s+COLUMN\s+(.+)$/i);
  if (addColMatch) {
    const col = parseColumnDefinition(addColMatch[2]);
    if (col) ensureModified(target, addColMatch[1]).addedColumns.push(col);
    return;
  }

  const dropColMatch = stmt.match(/^ALTER TABLE\s+"(\w+)"\s+DROP\s+COLUMN\s+"(\w+)"/i);
  if (dropColMatch) {
    ensureModified(target, dropColMatch[1]).droppedColumns.push(dropColMatch[2]);
    return;
  }

  const dropTableMatch = stmt.match(/^DROP TABLE\s+"(\w+)"/i);
  if (dropTableMatch) {
    target.droppedTables.push(dropTableMatch[1]);
    return;
  }

  // CREATE INDEX and other statements are intentionally ignored for MVP.
};

const parseTableBody = (body: string): SchemaColumn[] => {
  const parts = splitTopLevelByComma(body);
  const columns: SchemaColumn[] = [];
  const primaryKeys = new Set<string>();

  for (const part of parts) {
    const trimmed = part.trim();
    if (/^CONSTRAINT\b/i.test(trimmed)) {
      const pkMatch = trimmed.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        for (const m of pkMatch[1].matchAll(/"(\w+)"/g)) primaryKeys.add(m[1]);
      }
      continue;
    }
    const col = parseColumnDefinition(trimmed);
    if (col) columns.push(col);
  }

  for (const col of columns) {
    if (primaryKeys.has(col.name)) col.isPrimaryKey = true;
  }

  return columns;
};

const splitTopLevelByComma = (s: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && s[i - 1] !== '\\') inString = !inString;
    if (!inString) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        if (current.trim()) out.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
};

export const parseColumnDefinition = (text: string): SchemaColumn | null => {
  const nameMatch = text.match(/^\s*"(\w+)"\s+(.+)$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  let rest = nameMatch[2].trim();

  let rawType: string;
  let isCustomType = false;
  if (rest.startsWith('"')) {
    const m = rest.match(/^"(\w+)"/);
    if (!m) return null;
    rawType = m[1];
    isCustomType = true;
    rest = rest.slice(m[0].length).trim();
  } else {
    const m = rest.match(/^([A-Z][A-Z0-9_]*(?:\([^)]+\))?)/i);
    if (!m) return null;
    rawType = m[1];
    rest = rest.slice(m[0].length).trim();
  }

  const isNotNull = /\bNOT\s+NULL\b/i.test(rest);
  const defaultMatch = rest.match(
    /\bDEFAULT\s+('(?:[^']|'')*'|CURRENT_TIMESTAMP|now\(\)|[+-]?\d+(?:\.\d+)?|true|false|NULL)/i,
  );
  const defaultValue = defaultMatch ? defaultMatch[1] : null;

  let displayType = isCustomType ? rawType : rawType.toLowerCase();
  if (defaultValue && !/^CURRENT_TIMESTAMP|^now\(\)$/i.test(defaultValue)) {
    displayType += ` default ${defaultValue}`;
  }

  return {
    name,
    type: displayType,
    nullable: !isNotNull,
  };
};

const ensureModified = (target: ParsedSQL, name: string): ModifiedTable => {
  const existing = target.modifiedTables.get(name);
  if (existing) return existing;
  const created: ModifiedTable = {
    name,
    addedColumns: [],
    droppedColumns: [],
    typeChanges: [],
  };
  target.modifiedTables.set(name, created);
  return created;
};

// ─── Output shaping ─────────────────────────────────────────────────────────

export const buildDataChanges = (parsed: ParsedSQL): DataChanges => {
  const newTables = parsed.newTables;
  const modifiedTables = [...parsed.modifiedTables.values()];
  const droppedTables = parsed.droppedTables;
  const enums = parsed.newEnums;

  const totalForCount =
    newTables.length + modifiedTables.length + droppedTables.length + enums.length;

  if (totalForCount === 0) {
    return {
      description: '',
      newTables: [],
      modifiedTables: [],
      droppedTables: [],
      isReversible: true,
    };
  }

  const sentences: string[] = [];
  const additions: string[] = [];
  if (newTables.length > 0) {
    additions.push(summarize(newTables.length, 'new table', newTables.map((t) => t.name)));
  }
  if (enums.length > 0) {
    additions.push(summarize(enums.length, 'new enum', enums.map((e) => e.name)));
  }
  if (additions.length > 0) {
    sentences.push(`Adds ${joinList(additions)}.`);
  }
  if (modifiedTables.length > 0) {
    sentences.push(`Modifies ${pluralize(modifiedTables.length, 'table')}.`);
  }
  if (droppedTables.length > 0) {
    sentences.push(`Drops ${pluralize(droppedTables.length, 'table')}.`);
  }
  const description = sentences.join(' ');

  const droppedColCount = modifiedTables.reduce((s, t) => s + t.droppedColumns.length, 0);
  const typeChangeCount = modifiedTables.reduce((s, t) => s + t.typeChanges.length, 0);
  const isDestructive = droppedTables.length > 0 || droppedColCount > 0 || typeChangeCount > 0;

  return {
    description,
    newTables,
    modifiedTables,
    droppedTables,
    isReversible: !isDestructive,
  };
};

const pluralize = (n: number, singular: string): string =>
  n === 1 ? `1 ${singular}` : `${n} ${singular}s`;

const summarize = (count: number, label: string, names: string[]): string => {
  if (count === 1) return `1 ${label} (${names[0]})`;
  if (count <= 3) return `${count} ${label}s (${joinList(names)})`;
  return `${count} ${label}s`;
};

const joinList = (items: string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};
