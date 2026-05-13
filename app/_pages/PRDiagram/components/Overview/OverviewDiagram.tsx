'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { findChangeById } from '@/app/_lib/combine';
import { toDiagram } from '@/app/_lib/selectors/toDiagram';
import type { Change, PRDiagramData } from '@/app/_lib/types';
import { BandNode } from './BandNode';
import { layoutDiagram, toFlowEdges } from './layout';
import { OverviewNode, type OverviewNodeData } from './OverviewNode';

interface OverviewDiagramProps {
  data: PRDiagramData;
  hoveredChangeId: string | null;
  selectedChangeId: string | null;
  onHoverNode: (changeId: string | null) => void;
  onSelectNode: (change: Change) => void;
}

const NODE_TYPES = { overview: OverviewNode, band: BandNode };

const FIT_VIEW_OPTIONS = { padding: 0.08, maxZoom: 1 } as const;

export const OverviewDiagram: React.FC<OverviewDiagramProps> = (props) => (
  <ReactFlowProvider>
    <OverviewDiagramInner {...props} />
  </ReactFlowProvider>
);

const OverviewDiagramInner: React.FC<OverviewDiagramProps> = ({
  data,
  hoveredChangeId,
  selectedChangeId,
  onHoverNode,
  onSelectNode,
}) => {
  const model = useMemo(() => toDiagram(data), [data]);

  const handleRuleSelect = useCallback(
    (ruleChangeId: string) => {
      const change = findChangeById(data, ruleChangeId);
      if (change) onSelectNode(change);
    },
    [data, onSelectNode],
  );
  const nodes = useMemo(
    () =>
      layoutDiagram(model, {
        hoveredChangeId,
        selectedChangeId,
        onRuleSelect: handleRuleSelect,
      }),
    [model, hoveredChangeId, selectedChangeId, handleRuleSelect],
  );
  const edges = useMemo(() => toFlowEdges(model.edges), [model.edges]);

  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      fitView({ ...FIT_VIEW_OPTIONS, duration: 200 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  const handleNodeEnter: NodeMouseHandler = (_e, node) => {
    if (node.type === 'band') return;
    const d = node.data as OverviewNodeData;
    onHoverNode(d.changeId);
  };
  const handleNodeLeave: NodeMouseHandler = () => onHoverNode(null);
  const handleNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type === 'band') return;
    const d = node.data as OverviewNodeData;
    if (d.changeId === null) return;
    const change = findChangeById(data, d.changeId);
    if (change) onSelectNode(change);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden"
    >
      {data.domains.length > 0 && (
        <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-1.5 pointer-events-none justify-end">
          <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-medium self-center">
            Affects
          </span>
          {data.domains.map((domain) => (
            <span
              key={domain}
              className="rounded-full bg-white/90 backdrop-blur-sm border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
            >
              {domain}
            </span>
          ))}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeMouseEnter={handleNodeEnter}
        onNodeMouseLeave={handleNodeLeave}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
        panOnDrag={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e5e5" />
      </ReactFlow>
    </div>
  );
};
