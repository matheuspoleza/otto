import type React from 'react';
import type { ReactNode } from 'react';

interface BeforeAfterPanelProps {
  children: ReactNode;
  label: string;
  variant?: 'before' | 'after' | 'neutral';
}

export const BeforeAfterPanel: React.FC<BeforeAfterPanelProps> = ({
  children,
  label,
  variant = 'neutral',
}) => (
  <div className="flex-1 rounded-lg border border-neutral-200 bg-white overflow-hidden">
    <div
      className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-b ${
        variant === 'after'
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-neutral-50 text-neutral-500 border-neutral-200'
      }`}
    >
      {label}
    </div>
    <div className="p-3">{children}</div>
  </div>
);
