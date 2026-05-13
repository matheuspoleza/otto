import type React from 'react';
import type { ActionItem, ActionUrgency } from '@/app/_lib/types';
import { ACTION_ICON } from '../constants';

interface ActionableItemsListProps {
  actions: ActionItem[];
}

const URGENCY_ORDER: ActionUrgency[] = ['Before merge', 'After merge'];

export const ActionableItemsList: React.FC<ActionableItemsListProps> = ({ actions }) => {
  const grouped = URGENCY_ORDER.map((urgency) => ({
    urgency,
    items: actions.filter((a) => a.urgency === urgency),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="px-5 py-4 flex-1 overflow-y-auto">
      <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
        Actionable items
      </h3>
      {grouped.map(({ urgency, items }) => (
        <section key={urgency} className="mb-3 last:mb-0">
          <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
            {urgency}
          </div>
          <ul className="space-y-2">
            {items.map((action, i) => {
              const Icon = ACTION_ICON[action.iconKind];
              return (
                <li
                  key={i}
                  className="group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:border group-hover:border-neutral-200 transition-all">
                      <Icon className="w-3.5 h-3.5 text-neutral-600" />
                    </div>
                    <p className="flex-1 min-w-0 text-[13px] text-neutral-900 leading-snug pt-1">
                      {action.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
