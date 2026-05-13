import type React from 'react';
import { Map as MapIcon } from 'lucide-react';
import type { Change, PRDiagramData } from '@/app/_lib/types';
import { OverviewDiagram } from './OverviewDiagram';

interface OverviewViewProps {
  data: PRDiagramData;
  hoveredChangeId: string | null;
  selectedChangeId: string | null;
  onHoverNode: (changeId: string | null) => void;
  onSelectNode: (change: Change) => void;
}

const isStructural = (c: Change): boolean => c.kind !== 'rule';

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  hoveredChangeId,
  selectedChangeId,
  onHoverNode,
  onSelectNode,
}) => {
  const hasStructural = data.changes.some(isStructural);
  if (!hasStructural) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500">
        <MapIcon className="w-6 h-6 mb-2 text-neutral-300" />
        <p className="text-[13px] font-medium text-neutral-700">No structural changes to map</p>
      </div>
    );
  }
  return (
    <div className="h-full">
      <OverviewDiagram
        data={data}
        hoveredChangeId={hoveredChangeId}
        selectedChangeId={selectedChangeId}
        onHoverNode={onHoverNode}
        onSelectNode={onSelectNode}
      />
    </div>
  );
};
