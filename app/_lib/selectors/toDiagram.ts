/**
 * Selector: turns the canonical `Change[]` into the data the diagram needs to
 * render its three layered bands (UI / API / Data). Pure — does not know how
 * the diagram lays out positions, only what items belong to each layer and
 * what badges hang off them.
 */

import { findRulesFor } from '../combine';
import type {
  ApiChange,
  ApiPreviewData,
  Change,
  ChangeStatus,
  GraphEdge,
  PageChange,
  PagePreviewData,
  PRDiagramData,
  TableChange,
  TablePreviewData,
} from '../types';

export type DiagramPillar = 'ui' | 'api' | 'data';

export type DiagramPreview = PagePreviewData | ApiPreviewData | TablePreviewData;

export interface DiagramItem {
  id: string;
  kind: 'page' | 'api' | 'table';
  label: string;
  status: ChangeStatus;
  preview: DiagramPreview;
  ruleBadges: Array<{ changeId: string; summary: string }>;
}

export interface DiagramModel {
  pillars: Record<DiagramPillar, DiagramItem[]>;
  edges: GraphEdge[];
}

const KIND_TO_PILLAR: Record<DiagramItem['kind'], DiagramPillar> = {
  page: 'ui',
  api: 'api',
  table: 'data',
};

type StructuralChange = PageChange | ApiChange | TableChange;
const isStructural = (c: Change): c is StructuralChange => c.kind !== 'rule';

export const toDiagram = (data: PRDiagramData): DiagramModel => {
  const pillars: Record<DiagramPillar, DiagramItem[]> = { ui: [], api: [], data: [] };
  for (const change of data.changes) {
    if (!isStructural(change)) continue;
    pillars[KIND_TO_PILLAR[change.kind]].push(toDiagramItem(data, change));
  }
  return { pillars, edges: data.edges };
};

const toDiagramItem = (data: PRDiagramData, change: StructuralChange): DiagramItem => ({
  id: change.id,
  kind: change.kind,
  label: labelFor(change),
  status: change.status,
  preview: change.preview,
  ruleBadges:
    change.kind === 'api'
      ? findRulesFor(data, change.ruleIds).map((r) => ({
          changeId: r.id,
          summary: r.name,
        }))
      : [],
});

const labelFor = (change: StructuralChange): string => {
  if (change.kind === 'page') return change.name;
  if (change.kind === 'api') return `${change.method} ${change.path}`;
  return change.name;
};
