import type React from 'react';
import type { ActionItem, RiskAssessment } from '@/app/_lib/types';
import { ActionableItemsList } from './ActionableItemsList';
import { RiskScoreCard } from './RiskScoreCard';
import { RiskSignalsList } from './RiskSignalsList';

interface PRLensSidebarProps {
  risk: RiskAssessment;
  domains: string[];
  actions: ActionItem[];
}

export const PRLensSidebar: React.FC<PRLensSidebarProps> = ({ risk, domains, actions }) => (
  <aside className="w-[340px] shrink-0 bg-white flex flex-col overflow-hidden">
    <RiskScoreCard risk={risk} domains={domains} />
    <RiskSignalsList signals={risk.signals} />
    <ActionableItemsList actions={actions} />
  </aside>
);
