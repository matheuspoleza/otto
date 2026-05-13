/**
 * Deterministic risk scoring.
 *
 * `detectSignals` collects boolean signals from a SignalContext (PR stats,
 * file paths, pillar outputs). `scoreRisk` sums signal weights with a fixed
 * baseline and clamps to 0-100. `materializeSignals` and `deriveDomains`
 * project the signal keys to display strings.
 *
 * Re-running with the same input is guaranteed to produce the same output.
 * No LLM.
 */

import type { APIChanges, DataChanges, RiskAssessment, RiskSignal } from './types';

export type SignalKey =
  | 'touches_billing'
  | 'touches_auth'
  | 'breaking_api'
  | 'irreversible_migration'
  | 'large_diff_500_plus'
  | 'no_tests_added'
  | 'tests_added'
  | 'small_isolated_change';

export interface SignalContext {
  prChanges: number;
  changedFileCount: number;
  files: { filename: string; status: 'added' | 'modified' | 'removed' | string }[];
  api: APIChanges;
  data: DataChanges;
}

const BILLING_KEYWORDS = ['billing', 'pricing', 'subscription', 'payment', 'invoice', 'checkout', 'usage'];
const AUTH_KEYWORDS = ['auth', 'session', 'password', 'oauth', 'token'];

const matchesAnyKeyword = (paths: string[], keywords: string[]): boolean =>
  paths.some((p) => {
    const lower = p.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  });

const isTestFile = (filename: string): boolean =>
  /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename);

export const detectSignals = (ctx: SignalContext): SignalKey[] => {
  const signals: SignalKey[] = [];
  const paths = ctx.files.map((f) => f.filename);
  const tableNames = [
    ...ctx.data.newTables.map((t) => t.name),
    ...ctx.data.modifiedTables.map((t) => t.name),
  ];
  const billingHaystack = [...paths, ...tableNames];

  if (matchesAnyKeyword(billingHaystack, BILLING_KEYWORDS)) {
    signals.push('touches_billing');
  }
  if (matchesAnyKeyword(paths, AUTH_KEYWORDS)) {
    signals.push('touches_auth');
  }
  if (ctx.api.endpoints.some((e) => e.changeType === 'breaking' || e.changeType === 'removed')) {
    signals.push('breaking_api');
  }
  if (!ctx.data.isReversible && ctx.data.count > 0) {
    signals.push('irreversible_migration');
  }
  if (ctx.prChanges >= 500) {
    signals.push('large_diff_500_plus');
  }

  const testsAdded = ctx.files.some((f) => f.status === 'added' && isTestFile(f.filename));
  if (testsAdded) {
    signals.push('tests_added');
  } else {
    signals.push('no_tests_added');
  }

  if (ctx.changedFileCount === 1 && ctx.prChanges < 100) {
    signals.push('small_isolated_change');
  }

  return signals;
};

const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  touches_billing: 25,
  touches_auth: 25,
  breaking_api: 20,
  irreversible_migration: 20,
  large_diff_500_plus: 10,
  no_tests_added: 5,
  tests_added: -10,
  small_isolated_change: -10,
};

export const topSignalKeys = (keys: SignalKey[], limit: number): SignalKey[] =>
  [...keys]
    .sort((a, b) => Math.abs(SIGNAL_WEIGHTS[b]) - Math.abs(SIGNAL_WEIGHTS[a]))
    .slice(0, limit);

const RISK_BASE = 30;

export const scoreRisk = (signals: SignalKey[]): Pick<RiskAssessment, 'score' | 'level'> => {
  const raw = signals.reduce((sum, key) => sum + SIGNAL_WEIGHTS[key], RISK_BASE);
  const score = Math.max(0, Math.min(100, raw));
  const level = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  return { score, level };
};

interface SignalDisplay {
  type: RiskSignal['type'];
  text: string;
}

const SIGNAL_DISPLAY: Record<SignalKey, SignalDisplay> = {
  touches_billing: { type: 'warn', text: 'Touches production billing flow' },
  touches_auth: { type: 'warn', text: 'Touches authentication code' },
  breaking_api: { type: 'warn', text: 'Breaking change for existing API consumers' },
  irreversible_migration: { type: 'warn', text: 'Migration includes destructive changes' },
  large_diff_500_plus: { type: 'warn', text: 'Large diff (500+ lines changed)' },
  no_tests_added: { type: 'warn', text: 'No tests added in this PR' },
  tests_added: { type: 'good', text: 'Tests added for the new code' },
  small_isolated_change: { type: 'good', text: 'Small, isolated change' },
};

export interface SignalOverride {
  text: string;
  evidenceFiles: string[];
}

export const materializeSignals = (
  signals: SignalKey[],
  overrides?: Map<SignalKey, SignalOverride>,
): RiskSignal[] =>
  signals.map((key) => {
    const override = overrides?.get(key);
    const canonical = SIGNAL_DISPLAY[key];
    if (!override) return { key, type: canonical.type, text: canonical.text };
    return {
      key,
      type: canonical.type,
      text: override.text,
      evidenceFiles: override.evidenceFiles,
    };
  });

const SIGNAL_DOMAINS: Partial<Record<SignalKey, string>> = {
  touches_billing: 'Billing',
  touches_auth: 'Auth',
};

export const deriveDomains = (signals: SignalKey[]): string[] => {
  const out: string[] = [];
  for (const key of signals) {
    const domain = SIGNAL_DOMAINS[key];
    if (domain && !out.includes(domain)) out.push(domain);
  }
  return out;
};
