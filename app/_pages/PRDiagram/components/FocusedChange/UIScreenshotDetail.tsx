import type React from 'react';
import { useState } from 'react';
import { ArrowRight, ImageOff, ZoomIn } from 'lucide-react';
import type { RouteScreenshot } from '@/app/_lib/types';
import { BeforeAfterPanel } from './shared/BeforeAfterPanel';
import { FullscreenImageModal } from './shared/FullscreenImageModal';

type Side = 'before' | 'after';

interface UIScreenshotDetailProps {
  shot: RouteScreenshot;
}

export const UIScreenshotDetail: React.FC<UIScreenshotDetailProps> = ({ shot }) => {
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const beforeMissing = shot.beforeUrl === null;

  return (
    <div>
      <div className="mb-2 text-[11px] font-mono text-neutral-500">{shot.path}</div>
      <div className="flex gap-3 items-stretch">
        {!beforeMissing && (
          <>
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
          </>
        )}
        <ScreenshotPanel
          url={shot.afterUrl}
          label={beforeMissing ? 'New' : 'After'}
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
