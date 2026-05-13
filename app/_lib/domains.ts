/**
 * Derives the high-level product domains the PR touches, by simple keyword
 * match against file paths and table names. Drives the `Domains affected`
 * list in the AI export.
 */

const BILLING_KEYWORDS = [
  'billing',
  'pricing',
  'subscription',
  'payment',
  'invoice',
  'checkout',
  'usage',
];
const AUTH_KEYWORDS = ['auth', 'session', 'password', 'oauth', 'token'];

interface DeriveDomainsInput {
  paths: string[];
  tableNames: string[];
}

export const deriveDomains = ({ paths, tableNames }: DeriveDomainsInput): string[] => {
  const out: string[] = [];
  const billingHaystack = [...paths, ...tableNames];
  if (matchesAnyKeyword(billingHaystack, BILLING_KEYWORDS)) out.push('Billing');
  if (matchesAnyKeyword(paths, AUTH_KEYWORDS)) out.push('Auth');
  return out;
};

const matchesAnyKeyword = (haystack: string[], keywords: string[]): boolean =>
  haystack.some((p) => {
    const lower = p.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  });
