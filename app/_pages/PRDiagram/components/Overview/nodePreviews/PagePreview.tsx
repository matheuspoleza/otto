import type React from 'react';
import type { ChangeStatus, PagePreviewData } from '@/app/_lib/types';

interface PagePreviewProps {
  preview: PagePreviewData;
  status: ChangeStatus;
}

export const PagePreview: React.FC<PagePreviewProps> = ({ preview, status }) => {
  const isRemoved = status === 'removed';
  if (preview.afterUrl) {
    return (
      <div className="px-2 pb-2">
        <div
          className={`relative w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 ${
            isRemoved ? 'grayscale' : ''
          }`}
          style={{ aspectRatio: '16 / 10' }}
        >
          {/* biome-ignore lint/performance/noImgElement: external screenshot URLs from preview deployments */}
          <img
            src={preview.afterUrl}
            alt={`Preview of ${preview.routePath}`}
            className="w-full h-full object-cover object-top"
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="px-2 pb-2">
      <div
        className="w-full rounded-md border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center px-2"
        style={{ aspectRatio: '16 / 10' }}
      >
        <span className="font-mono text-[10px] text-neutral-500 truncate" title={preview.routePath}>
          {preview.routePath}
        </span>
      </div>
    </div>
  );
};
