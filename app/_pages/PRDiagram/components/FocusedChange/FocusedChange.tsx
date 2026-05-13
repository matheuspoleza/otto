'use client';

import type React from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Change } from '@/app/_lib/types';
import { ApiEndpointDetail } from './ApiEndpointDetail';
import { BusinessRuleDetail } from './BusinessRuleDetail';
import {
  DroppedTableDetail,
  ModifiedTableDetail,
  NewTableDetail,
} from './DataTableDetail';
import { UIScreenshotDetail } from './UIScreenshotDetail';

interface FocusedChangeProps {
  change: Change;
  onClose: () => void;
}

/**
 * Modal overlay opened when the reader clicks a change (in the diagram or
 * sidebar). Sits above the diagram with a dimmed backdrop. The right sidebar
 * stays interactive while open so clicking another sidebar item swaps the
 * overlay content without close+reopen.
 */
export const FocusedChange: React.FC<FocusedChangeProps> = ({ change, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm cursor-default"
      />
      <section className="relative flex flex-col w-full max-w-5xl max-h-full bg-white border border-neutral-200 rounded-lg shadow-xl overflow-hidden">
        <header className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              {kindLabel(change.kind)}
            </div>
            <h2
              className="text-[14px] font-medium text-neutral-900 truncate"
              title={changeTitle(change)}
            >
              {changeTitle(change)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FocusedContent change={change} />
        </div>
      </section>
    </div>
  );
};

const kindLabel = (kind: Change['kind']): string => {
  if (kind === 'page') return 'Frontend change';
  if (kind === 'api') return 'API change';
  if (kind === 'table') return 'Database change';
  return 'Business rule';
};

const changeTitle = (change: Change): string => {
  if (change.kind === 'api') return `${change.method} ${change.path}`;
  return change.name;
};

const FocusedContent: React.FC<{ change: Change }> = ({ change }) => {
  if (change.kind === 'page') return <UIScreenshotDetail shot={change.detail.screenshot} />;
  if (change.kind === 'api') return <ApiEndpointDetail endpoint={change.detail.endpoint} />;
  if (change.kind === 'table') return <TableDetail change={change} />;
  return <BusinessRuleDetail rule={change.detail.rule} />;
};

const TableDetail: React.FC<{ change: Extract<Change, { kind: 'table' }> }> = ({ change }) => {
  if (change.detail.variant === 'new') return <NewTableDetail table={change.detail.table} />;
  if (change.detail.variant === 'modified')
    return <ModifiedTableDetail table={change.detail.table} />;
  return <DroppedTableDetail name={change.detail.name} />;
};
