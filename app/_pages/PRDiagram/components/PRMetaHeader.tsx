import type React from 'react';
import type { PRMeta } from '@/app/_lib/types';

interface PRMetaHeaderProps {
  meta: PRMeta;
  cta?: React.ReactNode;
}

export const PRMetaHeader: React.FC<PRMetaHeaderProps> = ({ meta, cta }) => (
  <div className="px-6 pt-4 pb-3 border-b border-neutral-200 bg-white flex items-start gap-6">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
        <span className="font-mono">#{meta.number}</span>
        <span>·</span>
        <span>@{meta.author}</span>
        <span>·</span>
        <span>{meta.stateLabel}</span>
      </div>
      <h1 className="text-[20px] font-semibold text-neutral-900 leading-tight tracking-tight mb-1">
        {meta.title}
      </h1>
      <p className="text-[13px] text-neutral-600 leading-snug max-w-3xl">{meta.subtitle}</p>
    </div>
    {cta && <div className="shrink-0 pt-1">{cta}</div>}
  </div>
);
