import type React from 'react';
import { ArrowRight } from 'lucide-react';
import type { APIChanges, EndpointChange } from '@/app/_lib/types';
import { BeforeAfterPanel } from './BeforeAfterPanel';
import { SectionHeader } from './SectionHeader';
import { WarningBanner } from './WarningBanner';

interface APIChangeViewProps {
  data: APIChanges;
}

export const APIChangeView: React.FC<APIChangeViewProps> = ({ data }) => (
  <div>
    <SectionHeader title="API changes" description={data.description} />
    <div className="space-y-5">
      {data.endpoints.map((endpoint, i) => (
        <EndpointDiff key={`${endpoint.method}-${endpoint.path}-${i}`} endpoint={endpoint} />
      ))}
    </div>
    {data.warning && <WarningBanner text={data.warning} />}
  </div>
);

const CHANGE_TYPE_COLOR: Record<EndpointChange['changeType'], string> = {
  added: 'text-emerald-700',
  removed: 'text-rose-600',
  breaking: 'text-rose-600',
  modified: 'text-amber-700',
};

interface EndpointDiffProps {
  endpoint: EndpointChange;
}

const EndpointDiff: React.FC<EndpointDiffProps> = ({ endpoint }) => {
  const showRequest = endpoint.requestBefore !== null || endpoint.requestAfter !== null;
  const showResponse = endpoint.responseBefore !== null || endpoint.responseAfter !== null;

  return (
    <div>
      <div className="mb-2 text-[11px] font-mono text-neutral-500 flex items-center gap-2">
        <span className="font-semibold text-neutral-700">{endpoint.method}</span>
        <span>{endpoint.path}</span>
        <span className="text-neutral-300">·</span>
        <span className={CHANGE_TYPE_COLOR[endpoint.changeType]}>{endpoint.changeType}</span>
      </div>
      {showRequest && (
        <JsonBeforeAfter
          label="request body"
          before={endpoint.requestBefore}
          after={endpoint.requestAfter}
        />
      )}
      {showResponse && (
        <div className="mt-3">
          <JsonBeforeAfter
            label="response"
            before={endpoint.responseBefore}
            after={endpoint.responseAfter}
          />
        </div>
      )}
      {endpoint.breakingReason && (
        <p className="mt-2 text-[12px] text-rose-700">{endpoint.breakingReason}</p>
      )}
    </div>
  );
};

interface JsonBeforeAfterProps {
  label: string;
  before: unknown;
  after: unknown;
}

const JsonBeforeAfter: React.FC<JsonBeforeAfterProps> = ({ label, before, after }) => (
  <>
    <div className="text-[11px] font-mono text-neutral-400 mb-1">— {label}</div>
    <div className="flex gap-3 items-stretch">
      <BeforeAfterPanel label="Before" variant="before">
        <JsonBlock value={before} />
      </BeforeAfterPanel>
      <div className="flex items-center text-neutral-300 px-1">
        <ArrowRight className="w-4 h-4" />
      </div>
      <BeforeAfterPanel label="After" variant="after">
        <JsonBlock value={after} highlightDiffAgainst={before} />
      </BeforeAfterPanel>
    </div>
  </>
);

interface JsonBlockProps {
  value: unknown;
  highlightDiffAgainst?: unknown;
}

const JsonBlock: React.FC<JsonBlockProps> = ({ value, highlightDiffAgainst }) => {
  if (value === null || value === undefined) {
    return <span className="text-[11px] font-mono text-neutral-400">—</span>;
  }

  const serialized = JSON.stringify(value, null, 2);
  const lines = serialized.split('\n');

  const beforeKeys =
    highlightDiffAgainst && typeof highlightDiffAgainst === 'object'
      ? new Set(Object.keys(highlightDiffAgainst as Record<string, unknown>))
      : null;

  return (
    <pre className="text-[11px] font-mono text-neutral-700 leading-relaxed whitespace-pre-wrap">
      {lines.map((line, i) => {
        const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
        const isNew = beforeKeys && keyMatch ? !beforeKeys.has(keyMatch[1]) : false;
        return (
          <div key={i} className={isNew ? 'bg-amber-50 -mx-1 px-1' : ''}>
            {line}
            {isNew && <span className="text-amber-700 text-[10px] ml-2">{'// new'}</span>}
          </div>
        );
      })}
    </pre>
  );
};
