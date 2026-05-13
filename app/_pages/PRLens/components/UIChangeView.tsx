import type React from 'react';
import { useState } from 'react';
import { ArrowRight, ImageOff, ZoomIn } from 'lucide-react';
import type { ChangedComponent, RouteScreenshot, UIChanges } from '@/app/_lib/types';
import { BeforeAfterPanel } from './BeforeAfterPanel';
import { FullscreenImageModal } from './FullscreenImageModal';
import { SectionHeader } from './SectionHeader';
import { WarningBanner } from './WarningBanner';

type Side = 'before' | 'after';

interface UIChangeViewProps {
  data: UIChanges;
}

export const UIChangeView: React.FC<UIChangeViewProps> = ({ data }) => (
  <div>
    <SectionHeader title="Visual changes" description={data.description} />

    {data.screenshots.length === 0 ? (
      <ScreenshotPlaceholder />
    ) : (
      <div className="space-y-4">
        {data.screenshots.map((shot) => (
          <ScreenshotComparison key={shot.path} shot={shot} />
        ))}
      </div>
    )}

    {data.changedComponents.length > 0 && (
      <ChangedComponentsList components={data.changedComponents} />
    )}

    {data.warning && <WarningBanner text={data.warning} />}
  </div>
);

const ScreenshotPlaceholder: React.FC = () => (
  <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-[12px] text-neutral-500">
    <ImageOff className="w-5 h-5 mx-auto mb-2 text-neutral-300" />
    <p className="font-medium text-neutral-600 mb-0.5">Screenshots not captured yet</p>
    <p>Routes will be diffed against the preview deploy once the screenshotter is wired.</p>
  </div>
);

interface ScreenshotComparisonProps {
  shot: RouteScreenshot;
}

const ScreenshotComparison: React.FC<ScreenshotComparisonProps> = ({ shot }) => {
  const [openSide, setOpenSide] = useState<Side | null>(null);

  return (
    <div>
      <div className="mb-2 text-[11px] font-mono text-neutral-500">{shot.path}</div>
      <div className="flex gap-3 items-stretch">
        <ScreenshotPanel
          url={shot.beforeUrl}
          label="Before"
          variant="before"
          routeName={shot.name}
          onOpen={() => setOpenSide('before')}
        />
        <div className="flex items-center text-neutral-300 px-1">
          <ArrowRight className="w-4 h-4" />
        </div>
        <ScreenshotPanel
          url={shot.afterUrl}
          label="After"
          variant="after"
          routeName={shot.name}
          onOpen={() => setOpenSide('after')}
        />
      </div>
      {openSide && (
        <FullscreenImageModal
          beforeUrl={shot.beforeUrl}
          afterUrl={shot.afterUrl}
          currentSide={openSide}
          routeName={shot.name}
          onSwitchSide={setOpenSide}
          onClose={() => setOpenSide(null)}
        />
      )}
    </div>
  );
};

interface ScreenshotPanelProps {
  url: string | null;
  label: string;
  variant: 'before' | 'after';
  routeName: string;
  onOpen: () => void;
}

const ScreenshotPanel: React.FC<ScreenshotPanelProps> = ({
  url,
  label,
  variant,
  routeName,
  onOpen,
}) => {
  const alt = `${routeName} — ${label.toLowerCase()}`;
  return (
    <BeforeAfterPanel label={label} variant={variant}>
      {url ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${alt} fullscreen`}
          className="group relative block w-full rounded-md overflow-hidden border border-neutral-200 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="w-full block" />
          <div className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/30 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-full p-2 shadow-md">
              <ZoomIn className="w-4 h-4 text-neutral-900" />
            </div>
          </div>
        </button>
      ) : (
        <div className="aspect-[4/3] flex flex-col items-center justify-center text-neutral-400 text-[11px] gap-1.5 bg-neutral-50 rounded-md">
          <ImageOff className="w-5 h-5" />
          <span>Preview unavailable</span>
        </div>
      )}
    </BeforeAfterPanel>
  );
};

interface ChangedComponentsListProps {
  components: ChangedComponent[];
}

const ChangedComponentsList: React.FC<ChangedComponentsListProps> = ({ components }) => (
  <div className="mt-5">
    <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
      Changed components
    </h3>
    <ul className="space-y-1.5">
      {components.map((c) => (
        <li
          key={c.file}
          className="flex items-start gap-3 text-[12px] bg-white border border-neutral-200 rounded-lg px-3 py-2"
        >
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
              c.changeType === 'added'
                ? 'bg-emerald-100 text-emerald-700'
                : c.changeType === 'removed'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {c.changeType}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-neutral-900">{c.name}</div>
            <div className="font-mono text-[11px] text-neutral-500 truncate">{c.file}</div>
            <p className="text-neutral-600 mt-0.5">{c.summary}</p>
          </div>
        </li>
      ))}
    </ul>
  </div>
);
