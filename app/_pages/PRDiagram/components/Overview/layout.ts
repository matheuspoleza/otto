/**
 * Pure layout helpers for the Overview diagram: positions and edge styling.
 * No React, no DOM — only ReactFlow data shapes.
 */

import type { Edge, Node } from '@xyflow/react';
import type {
  DiagramItem,
  DiagramModel,
  DiagramPillar,
} from '@/app/_lib/selectors/toDiagram';
import type { GraphEdge } from '@/app/_lib/types';
import { NODE_WIDTH, type OverviewNodeData } from './OverviewNode';

const BAND_LABEL: Record<DiagramPillar, string> = {
  ui: 'Frontend',
  api: 'API',
  data: 'Database',
};

const NODE_HEIGHT: Record<DiagramItem['kind'], number> = {
  page: 170,
  api: 95,
  table: 130,
};

const NODE_GAP = 60;
const BAND_PAD_Y = 24;
const BAND_GAP = 28;
const BAND_PAD_X = 140;

const bandHeight = (rowItems: DiagramItem[]): number => {
  const tallest = rowItems.reduce(
    (acc, n) => Math.max(acc, NODE_HEIGHT[n.kind]),
    NODE_HEIGHT.api,
  );
  return tallest + BAND_PAD_Y * 2;
};

interface LayoutOptions {
  hoveredChangeId: string | null;
  selectedChangeId: string | null;
  onRuleSelect: (ruleChangeId: string) => void;
}

export const layoutDiagram = (
  model: DiagramModel,
  { hoveredChangeId, selectedChangeId, onRuleSelect }: LayoutOptions,
): Node[] => {
  const { pillars } = model;

  const maxRow = Math.max(pillars.ui.length, pillars.api.length, pillars.data.length, 1);
  const rowWidth = maxRow * NODE_WIDTH + (maxRow - 1) * NODE_GAP;
  const canvasWidth = rowWidth + BAND_PAD_X * 2;

  const bandH: Record<DiagramPillar, number> = {
    ui: bandHeight(pillars.ui),
    api: bandHeight(pillars.api),
    data: bandHeight(pillars.data),
  };
  const bandY: Record<DiagramPillar, number> = {
    ui: 0,
    api: bandH.ui + BAND_GAP,
    data: bandH.ui + BAND_GAP + bandH.api + BAND_GAP,
  };

  const nodes: Node[] = [];

  for (const pillar of ['ui', 'api', 'data'] as const) {
    nodes.push({
      id: `band:${pillar}`,
      type: 'band',
      position: { x: 0, y: bandY[pillar] },
      data: { label: BAND_LABEL[pillar], width: canvasWidth, height: bandH[pillar] },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  }

  for (const pillar of ['ui', 'api', 'data'] as const) {
    const layer = pillars[pillar];
    const layerWidth = layer.length * NODE_WIDTH + (layer.length - 1) * NODE_GAP;
    const startX = BAND_PAD_X + (rowWidth - layerWidth) / 2;
    layer.forEach((item, i) => {
      const isSelected = selectedChangeId !== null && item.id === selectedChangeId;
      const nodeData: OverviewNodeData = {
        label: item.label,
        kind: item.kind,
        status: item.status,
        changeId: item.id,
        isHovered: (hoveredChangeId !== null && item.id === hoveredChangeId) || isSelected,
        ruleBadges: item.ruleBadges,
        preview: item.preview,
        onRuleSelect,
      };
      const nodeY = bandY[pillar] + (bandH[pillar] - NODE_HEIGHT[item.kind]) / 2;
      nodes.push({
        id: item.id,
        type: 'overview',
        position: { x: startX + i * (NODE_WIDTH + NODE_GAP), y: nodeY },
        data: nodeData,
        draggable: false,
        selectable: false,
      });
    });
  }
  return nodes;
};

const STATUS_STROKE: Record<GraphEdge['status'], string> = {
  added: '#10b981',
  modified: '#f59e0b',
  removed: '#f43f5e',
};

export const toFlowEdges = (graphEdges: GraphEdge[]): Edge[] =>
  graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
    type: 'smoothstep',
    animated: false,
    style: { stroke: STATUS_STROKE[e.status], strokeWidth: 1.5, opacity: 1 },
    labelStyle: { fontSize: 10, fontWeight: 500, fill: '#525252' },
    labelBgStyle: { fill: '#ffffff' },
    labelBgPadding: [4, 2] as [number, number],
  }));
