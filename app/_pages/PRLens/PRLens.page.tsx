'use client';

import type React from 'react';
import { useState } from 'react';
import type { PRLensData } from '@/app/_lib/types';
import { APIChangeView } from './components/APIChangeView';
import { BusinessChangeView } from './components/BusinessChangeView';
import { ChangeTabs, type TabId } from './components/ChangeTabs';
import { DataChangeView } from './components/DataChangeView';
import { PRLensHeader } from './components/PRLensHeader';
import { PRLensSidebar } from './components/PRLensSidebar';
import { PRMetaHeader } from './components/PRMetaHeader';
import { UIChangeView } from './components/UIChangeView';

interface PRLensProps {
  data: PRLensData;
}

const useActiveTabState = ({ data }: { data: PRLensData }) => {
  const counts: Record<TabId, number> = {
    ui: data.changes.ui.count,
    api: data.changes.api.count,
    data: data.changes.data.count,
    business: data.changes.business.count,
  };
  const initialTab = (Object.keys(counts) as TabId[]).find((id) => counts[id] > 0) ?? 'ui';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  return { activeTab, setActiveTab, counts };
};

export const PRLens: React.FC<PRLensProps> = ({ data }) => {
  const { activeTab, setActiveTab, counts } = useActiveTabState({ data });

  return (
    <div className="h-screen w-full bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900 overflow-hidden">
      <PRLensHeader owner={data.meta.owner} repo={data.meta.repo} htmlUrl={data.meta.htmlUrl} />

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 flex flex-col min-w-0 border-r border-neutral-200">
          <PRMetaHeader meta={data.meta} />
          <ChangeTabs activeTab={activeTab} counts={counts} onChange={setActiveTab} />

          <div className="flex-1 overflow-y-auto px-6 py-4 bg-neutral-50">
            {activeTab === 'ui' && <UIChangeView data={data.changes.ui} />}
            {activeTab === 'api' && <APIChangeView data={data.changes.api} />}
            {activeTab === 'data' && <DataChangeView data={data.changes.data} />}
            {activeTab === 'business' && <BusinessChangeView data={data.changes.business} />}
          </div>
        </main>

        <PRLensSidebar risk={data.risk} domains={data.domains} actions={data.actions} />
      </div>
    </div>
  );
};
