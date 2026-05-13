import type React from 'react';
import type { ApiPreviewData } from '@/app/_lib/types';

const METHOD_TONE: Record<string, string> = {
  GET: 'bg-sky-50 text-sky-700',
  POST: 'bg-emerald-50 text-emerald-700',
  PUT: 'bg-amber-50 text-amber-700',
  PATCH: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-rose-50 text-rose-700',
};

interface ApiPreviewProps {
  preview: ApiPreviewData;
}

export const ApiPreview: React.FC<ApiPreviewProps> = ({ preview }) => {
  const tone = METHOD_TONE[preview.method] ?? 'bg-neutral-100 text-neutral-700';
  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${tone}`}
        >
          {preview.method}
        </span>
        <span className="font-mono text-[10px] text-neutral-700 truncate" title={preview.path}>
          {preview.path}
        </span>
      </div>
      <div className="text-[10px] text-neutral-500 truncate" title={preview.hint}>
        {preview.hint}
      </div>
    </div>
  );
};
