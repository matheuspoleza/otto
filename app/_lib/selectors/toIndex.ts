/**
 * Selector: turns the canonical `Change[]` into the grouped row model the
 * sidebar (`ChangeIndexList`) renders.
 */

import type { Change, ChangeStatus, PRDiagramData } from '../types';

export interface IndexRow {
  id: string;
  kind: Change['kind'];
  label: string;
  status: ChangeStatus;
}

export interface IndexGroup {
  kind: Change['kind'];
  rows: IndexRow[];
}

const GROUP_ORDER: Change['kind'][] = ['page', 'api', 'table', 'rule'];

export const toIndex = (data: PRDiagramData): IndexGroup[] => {
  const rows = data.changes.map(toRow);
  return GROUP_ORDER.map((kind) => ({
    kind,
    rows: rows.filter((r) => r.kind === kind),
  })).filter((g) => g.rows.length > 0);
};

const toRow = (change: Change): IndexRow => ({
  id: change.id,
  kind: change.kind,
  label: labelFor(change),
  status: change.status,
});

const labelFor = (change: Change): string => {
  if (change.kind === 'api') return `${change.method} ${change.path}`;
  return change.name;
};
