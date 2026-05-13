import type React from 'react';
import { ArrowRight } from 'lucide-react';
import type { BusinessChanges, BusinessRule } from '@/app/_lib/types';
import { BeforeAfterPanel } from './BeforeAfterPanel';
import { HighlightedText } from './HighlightedText';
import { SectionHeader } from './SectionHeader';
import { WarningBanner } from './WarningBanner';

interface BusinessChangeViewProps {
  data: BusinessChanges;
}

export const BusinessChangeView: React.FC<BusinessChangeViewProps> = ({ data }) => (
  <div>
    <SectionHeader title="Business rules" description={data.description} />
    <div className="space-y-5">
      {data.rules.map((rule, i) => (
        <BusinessRuleDiff key={`${rule.name}-${i}`} rule={rule} />
      ))}
    </div>
    {data.warning && <WarningBanner text={data.warning} />}
  </div>
);

interface BusinessRuleDiffProps {
  rule: BusinessRule;
}

const BusinessRuleDiff: React.FC<BusinessRuleDiffProps> = ({ rule }) => (
  <div>
    <div className="mb-2 text-[11px] font-medium text-neutral-700">{rule.name}</div>
    <div className="flex gap-3 items-stretch">
      <BeforeAfterPanel label="Before" variant="before">
        <div className="space-y-2">
          <div className="text-[12px] text-neutral-900 leading-relaxed">
            <HighlightedText
              text={rule.beforeText}
              highlights={rule.highlights}
              variant="neutral"
            />
          </div>
          {rule.beforeExamples.length > 0 && (
            <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-500">
              {rule.beforeExamples.map((ex, i) => (
                <div key={i}>{ex}</div>
              ))}
            </div>
          )}
        </div>
      </BeforeAfterPanel>
      <div className="flex items-center text-neutral-300 px-1">
        <ArrowRight className="w-4 h-4" />
      </div>
      <BeforeAfterPanel label="After" variant="after">
        <div className="space-y-2">
          <div className="text-[12px] text-neutral-900 leading-relaxed">
            <HighlightedText text={rule.afterText} highlights={rule.highlights} variant="amber" />
          </div>
          {rule.afterExamples.length > 0 && (
            <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-500">
              {rule.afterExamples.map((ex, i) => (
                <div key={i} className="text-amber-700">
                  {ex}
                </div>
              ))}
            </div>
          )}
        </div>
      </BeforeAfterPanel>
    </div>
  </div>
);
