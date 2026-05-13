import type { PRMeta } from '@/app/_lib/types';

export const timeAgo = (iso: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const stateLabel = (state: PRMeta['state'], mergedAt: string | null): string => {
  if (state === 'merged' && mergedAt) return `merged ${timeAgo(mergedAt)}`;
  return state;
};

export const getRiskDot = (score: number): string => {
  if (score >= 70) return 'bg-amber-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-emerald-500';
};
