import type React from 'react';
import type { RiskAssessment } from '@/app/_lib/types';
import { getRiskDot } from '../utils';

interface RiskScoreCardProps {
  risk: RiskAssessment;
  domains: string[];
}

export const RiskScoreCard: React.FC<RiskScoreCardProps> = ({ risk, domains }) => (
  <div className="px-5 pt-5 pb-4 border-b border-neutral-200">
    <div className="flex items-baseline gap-2 mb-1.5">
      <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
        Risk score
      </span>
    </div>
    <div className="flex items-baseline gap-2.5 mb-2.5">
      <span className="text-[32px] font-semibold text-neutral-900 leading-none tracking-tight">
        {risk.score}
      </span>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${getRiskDot(risk.score)}`} />
        <span className="text-[13px] font-medium text-neutral-700">{risk.level}</span>
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {domains.map((domain) => (
        <span
          key={domain}
          className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200"
        >
          {domain}
        </span>
      ))}
    </div>
  </div>
);
