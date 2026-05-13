import type React from 'react';
import type { NodeProps } from '@xyflow/react';

export interface BandNodeData extends Record<string, unknown> {
  label: string;
  width: number;
  height: number;
}

export const BandNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as BandNodeData;
  return (
    <div
      className="relative bg-neutral-100/50 border border-neutral-200 rounded-lg pointer-events-none"
      style={{ width: d.width, height: d.height }}
    >
      <span className="absolute top-2 left-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {d.label}
      </span>
    </div>
  );
};
