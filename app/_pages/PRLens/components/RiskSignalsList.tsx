import type React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { RiskSignal } from '@/app/_lib/types';

interface RiskSignalsListProps {
  signals: RiskSignal[];
}

export const RiskSignalsList: React.FC<RiskSignalsListProps> = ({ signals }) => (
  <div className="px-5 py-4 border-b border-neutral-200">
    <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
      Risk assessment
    </h3>
    <ul className="space-y-2">
      {signals.map((signal, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
          {signal.type === 'warn' ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
          )}
          <span className="text-neutral-700">{signal.text}</span>
        </li>
      ))}
    </ul>
  </div>
);
