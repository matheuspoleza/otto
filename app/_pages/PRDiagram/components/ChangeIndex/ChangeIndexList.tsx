import type React from 'react';
import { FileText, Plug, Database, Scale } from 'lucide-react';
import { findChangeById } from '@/app/_lib/combine';
import { toIndex } from '@/app/_lib/selectors/toIndex';
import type { Change, PRDiagramData } from '@/app/_lib/types';

interface ChangeIndexListProps {
  data: PRDiagramData;
  /** When set, the matching bullet visually highlights (mirror of diagram→sidebar hover). */
  hoveredChangeId: string | null;
  onHover: (changeId: string | null) => void;
  onSelect: (change: Change) => void;
}

const GROUP_LABELS: Record<Change['kind'], string> = {
  page: 'Frontend',
  api: 'API',
  table: 'Database',
  rule: 'Business rules',
};

const GROUP_ICONS: Record<Change['kind'], React.ComponentType<{ className?: string }>> = {
  page: FileText,
  api: Plug,
  table: Database,
  rule: Scale,
};

const STATUS_DOT: Record<Change['status'], string> = {
  added: 'bg-emerald-500',
  modified: 'bg-amber-500',
  removed: 'bg-rose-500',
};

export const ChangeIndexList: React.FC<ChangeIndexListProps> = ({
  data,
  hoveredChangeId,
  onHover,
  onSelect,
}) => {
  const groups = toIndex(data);

  const handleSelect = (rowId: string) => {
    const change = findChangeById(data, rowId);
    if (change) onSelect(change);
  };

  return (
    <div className="px-5 py-4 flex-1 overflow-y-auto">
      <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-3">
        Changes in this PR
      </h3>
      {groups.map(({ kind, rows }) => {
        const Icon = GROUP_ICONS[kind];
        return (
          <section key={kind} className="mb-4 last:mb-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className="w-3 h-3 text-neutral-400" />
              <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
                {GROUP_LABELS[kind]}
              </span>
            </div>
            <ul className="space-y-0.5">
              {rows.map((row) => {
                const isHovered = hoveredChangeId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onMouseEnter={() => onHover(row.id)}
                      onMouseLeave={() => onHover(null)}
                      onClick={() => handleSelect(row.id)}
                      className={`group w-full text-left px-2 py-1.5 -mx-2 rounded-md text-[13px] flex items-start gap-2 transition-colors ${
                        isHovered ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${STATUS_DOT[row.status]}`}
                      />
                      <span
                        className={`flex-1 min-w-0 leading-snug ${
                          row.status === 'removed'
                            ? 'text-neutral-500 line-through'
                            : 'text-neutral-800'
                        }`}
                      >
                        {row.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
