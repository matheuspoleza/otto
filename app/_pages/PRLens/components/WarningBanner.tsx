import type React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningBannerProps {
  text: string;
}

export const WarningBanner: React.FC<WarningBannerProps> = ({ text }) => (
  <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-900 flex items-start gap-2">
    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
    <span>{text}</span>
  </div>
);
