import type React from 'react';
import type { TablePreviewData } from '@/app/_lib/types';

const PREFIX_TONE: Record<'+' | '~' | '-', string> = {
  '+': 'text-emerald-700',
  '~': 'text-amber-700',
  '-': 'text-rose-700',
};

interface TablePreviewProps {
  preview: TablePreviewData;
}

export const TablePreview: React.FC<TablePreviewProps> = ({ preview }) => {
  if (preview.isDropped) {
    return (
      <div className="px-3 pb-2">
        <div className="text-[10px] text-rose-700 italic">Table dropped</div>
      </div>
    );
  }
  if (preview.columnHints.length === 0) {
    return <div className="pb-2" />;
  }
  return (
    <div className="px-3 pb-2 space-y-0.5">
      {preview.columnHints.map((h) => (
        <div
          key={`${h.prefix}:${h.name}`}
          className="flex items-center gap-1 font-mono text-[10px] leading-tight"
        >
          <span className={`font-semibold ${PREFIX_TONE[h.prefix]}`}>{h.prefix}</span>
          <span className="text-neutral-700 truncate">{h.name}</span>
        </div>
      ))}
      {preview.moreCount > 0 && (
        <div className="text-[10px] text-neutral-400 italic">+{preview.moreCount} more</div>
      )}
    </div>
  );
};
