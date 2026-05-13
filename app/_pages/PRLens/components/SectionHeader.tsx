import type React from 'react';

interface SectionHeaderProps {
  title: string;
  description: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description }) => (
  <div className="mb-3">
    <h2 className="text-[14px] font-semibold text-neutral-900 mb-0.5">{title}</h2>
    <p className="text-[13px] text-neutral-600 leading-snug max-w-2xl">{description}</p>
  </div>
);
