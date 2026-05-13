'use client';

import type React from 'react';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Side = 'before' | 'after';

interface FullscreenImageModalProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  currentSide: Side;
  routeName: string;
  onSwitchSide: (side: Side) => void;
  onClose: () => void;
}

const OPPOSITE: Record<Side, Side> = { before: 'after', after: 'before' };

export const FullscreenImageModal: React.FC<FullscreenImageModalProps> = ({
  beforeUrl,
  afterUrl,
  currentSide,
  routeName,
  onSwitchSide,
  onClose,
}) => {
  const url = currentSide === 'before' ? beforeUrl : afterUrl;
  const otherSide = OPPOSITE[currentSide];
  const otherUrl = otherSide === 'before' ? beforeUrl : afterUrl;
  const canSwitch = otherUrl !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!canSwitch) return;
      if (e.key === 'ArrowRight' && currentSide === 'before') onSwitchSide('after');
      if (e.key === 'ArrowLeft' && currentSide === 'after') onSwitchSide('before');
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onSwitchSide, currentSide, canSwitch]);

  if (!url) return null;

  const caption = `${routeName} — ${currentSide.toUpperCase()}`;
  const alt = `${routeName} — ${currentSide}`;
  const showPrev = currentSide === 'after' && beforeUrl !== null;
  const showNext = currentSide === 'before' && afterUrl !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {showPrev && (
        <button
          type="button"
          onClick={() => onSwitchSide('before')}
          aria-label="Previous (before)"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {showNext && (
        <button
          type="button"
          onClick={() => onSwitchSide('after')}
          aria-label="Next (after)"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        className="flex flex-col items-center gap-3 max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
          {caption}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl cursor-default"
        />
        {canSwitch && (
          <div className="text-[10px] text-white/40 tracking-wider mt-1">
            Use ← → to switch
          </div>
        )}
      </div>
    </div>
  );
};
