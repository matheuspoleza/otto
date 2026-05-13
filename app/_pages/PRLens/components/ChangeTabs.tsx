import type React from 'react';

export type TabId = 'ui' | 'api' | 'data' | 'business';

const TAB_LABELS: Record<TabId, string> = {
  ui: 'UI',
  api: 'API',
  data: 'Data',
  business: 'Business',
};

const TAB_ORDER: readonly TabId[] = ['ui', 'api', 'data', 'business'] as const;

interface ChangeTabsProps {
  activeTab: TabId;
  counts: Record<TabId, number>;
  onChange: (tab: TabId) => void;
}

export const ChangeTabs: React.FC<ChangeTabsProps> = ({ activeTab, counts, onChange }) => (
  <div className="px-6 border-b border-neutral-200 bg-white">
    <div className="flex gap-1">
      {TAB_ORDER.map((id) => {
        const isActive = activeTab === id;
        const count = counts[id];
        const hasChanges = count > 0;
        return (
          <button
            key={id}
            onClick={() => hasChanges && onChange(id)}
            disabled={!hasChanges}
            className={`px-3 py-2 text-[13px] font-medium relative transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'text-neutral-900'
                : hasChanges
                  ? 'text-neutral-500 hover:text-neutral-900'
                  : 'text-neutral-300 cursor-default'
            }`}
          >
            {TAB_LABELS[id]}
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                hasChanges
                  ? isActive
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                  : 'bg-neutral-50 text-neutral-300'
              }`}
            >
              {count}
            </span>
            {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />}
          </button>
        );
      })}
    </div>
  </div>
);
