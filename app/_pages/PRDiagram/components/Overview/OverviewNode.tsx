import type React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, Plug, Database, Scale } from 'lucide-react';
import type {
  ApiPreviewData,
  ChangeStatus,
  PagePreviewData,
  TablePreviewData,
} from '@/app/_lib/types';
import { ApiPreview } from './nodePreviews/ApiPreview';
import { PagePreview } from './nodePreviews/PagePreview';
import { TablePreview } from './nodePreviews/TablePreview';

type StructuralKind = 'page' | 'api' | 'table';
type StructuralPreview = PagePreviewData | ApiPreviewData | TablePreviewData;

export interface OverviewNodeData extends Record<string, unknown> {
  label: string;
  kind: StructuralKind;
  status: ChangeStatus;
  changeId: string | null;
  isHovered: boolean;
  ruleBadges: Array<{ changeId: string; summary: string }>;
  preview: StructuralPreview;
  /** Called when a rule badge is clicked. Stops event bubbling so the node click doesn't also fire. */
  onRuleSelect?: (ruleChangeId: string) => void;
}

const KIND_ICON: Record<StructuralKind, React.ComponentType<{ className?: string }>> = {
  page: FileText,
  api: Plug,
  table: Database,
};

const KIND_LABEL: Record<StructuralKind, string> = {
  page: 'Page',
  api: 'Endpoint',
  table: 'Table',
};

const STATUS_BORDER: Record<ChangeStatus, string> = {
  added: 'border-emerald-500',
  modified: 'border-amber-500',
  removed: 'border-rose-500',
};

const STATUS_OPACITY: Record<ChangeStatus, string> = {
  added: 'opacity-100',
  modified: 'opacity-100',
  removed: 'opacity-50',
};

const STATUS_LABEL: Record<ChangeStatus, string> = {
  added: 'new',
  modified: 'modified',
  removed: 'removed',
};

const STATUS_LABEL_TONE: Record<ChangeStatus, string> = {
  added: 'bg-emerald-50 text-emerald-700',
  modified: 'bg-amber-50 text-amber-700',
  removed: 'bg-rose-50 text-rose-700',
};

export const NODE_WIDTH = 220;

export const OverviewNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as OverviewNodeData;
  const Icon = KIND_ICON[d.kind];
  return (
    <div
      className={`relative bg-white border-2 rounded-lg shadow-sm transition-all ${
        STATUS_BORDER[d.status]
      } ${STATUS_OPACITY[d.status]} ${d.isHovered ? 'ring-2 ring-neutral-900 ring-offset-2' : ''}`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-400 !w-1.5 !h-1.5" />
      <div className="px-3 pt-2 pb-1.5">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-neutral-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              {KIND_LABEL[d.kind]}
            </div>
            <div
              className={`text-[12px] font-medium leading-tight truncate ${
                d.status === 'removed' ? 'line-through text-neutral-500' : 'text-neutral-900'
              }`}
              title={d.label}
            >
              {d.label}
            </div>
          </div>
          <span
            className={`text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
              STATUS_LABEL_TONE[d.status]
            }`}
          >
            {STATUS_LABEL[d.status]}
          </span>
        </div>
      </div>
      <NodePreviewBody preview={d.preview} status={d.status} />
      {d.ruleBadges.length > 0 && (
        <div className="absolute -top-2 -right-2 flex flex-row-reverse items-center">
          {d.ruleBadges.map((badge, i) => (
            <button
              key={badge.changeId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                d.onRuleSelect?.(badge.changeId);
              }}
              aria-label={`Open business rule: ${badge.summary}`}
              title={`Business rule: ${badge.summary}`}
              className="w-6 h-6 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center shadow-sm hover:bg-indigo-50 hover:border-indigo-500 transition-colors cursor-pointer"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: d.ruleBadges.length - i }}
            >
              <Scale className="w-3 h-3 text-indigo-600" />
            </button>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-neutral-400 !w-1.5 !h-1.5" />
    </div>
  );
};

const NodePreviewBody: React.FC<{ preview: StructuralPreview; status: ChangeStatus }> = ({
  preview,
  status,
}) => {
  if (preview.kind === 'page') return <PagePreview preview={preview} status={status} />;
  if (preview.kind === 'api') return <ApiPreview preview={preview} />;
  return <TablePreview preview={preview} />;
};
