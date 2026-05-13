'use client';

import type React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { findChangeById } from '@/app/_lib/combine';
import type { Change, PRDiagramData } from '@/app/_lib/types';
import { ChangeIndexList } from './components/ChangeIndex/ChangeIndexList';
import { CopyForAI } from './components/CopyForAI';
import { FocusedChange } from './components/FocusedChange/FocusedChange';
import { OverviewView } from './components/Overview/OverviewView';
import { PRDiagramHeader } from './components/PRDiagramHeader';
import { PRMetaHeader } from './components/PRMetaHeader';

interface PRDiagramProps {
  data: PRDiagramData;
}

export const PRDiagram: React.FC<PRDiagramProps> = ({ data }) => {
  const [hoveredChangeId, setHoveredChangeId] = useState<string | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  const selectedChange =
    selectedChangeId !== null ? findChangeById(data, selectedChangeId) ?? null : null;

  const handleSelect = (change: Change) => {
    setSelectedChangeId(change.id);
  };

  return (
    <div className="h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900 overflow-hidden">
      <PRDiagramHeader owner={data.meta.owner} repo={data.meta.repo} htmlUrl={data.meta.htmlUrl} />
      <PRMetaHeader
        meta={data.meta}
        cta={
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-[13px] text-neutral-700 hover:text-neutral-900 px-3 py-1.5 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors font-medium"
            >
              Analyze another PR
            </Link>
            <CopyForAI data={data} />
          </div>
        }
      />

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 relative min-w-0 border-r border-neutral-200 p-4">
          <OverviewView
            data={data}
            hoveredChangeId={hoveredChangeId}
            selectedChangeId={selectedChangeId}
            onHoverNode={setHoveredChangeId}
            onSelectNode={handleSelect}
          />
          {selectedChange && (
            <FocusedChange
              change={selectedChange}
              onClose={() => setSelectedChangeId(null)}
            />
          )}
        </main>

        <aside className="w-[300px] shrink-0 bg-white flex flex-col overflow-hidden">
          <ChangeIndexList
            data={data}
            hoveredChangeId={hoveredChangeId}
            onHover={setHoveredChangeId}
            onSelect={handleSelect}
          />
        </aside>
      </div>
    </div>
  );
};
