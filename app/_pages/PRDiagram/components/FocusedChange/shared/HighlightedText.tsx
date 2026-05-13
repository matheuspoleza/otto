import type React from 'react';

interface HighlightedTextProps {
  text: string;
  highlights: string[];
  variant?: 'amber' | 'neutral';
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlights,
  variant = 'amber',
}) => {
  if (highlights.length === 0) return <>{text}</>;

  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(pattern);

  const highlightClass =
    variant === 'amber'
      ? 'font-mono bg-amber-100 px-1.5 py-0.5 rounded'
      : 'font-mono bg-neutral-100 px-1.5 py-0.5 rounded';

  return (
    <>
      {parts.map((part, i) =>
        highlights.includes(part) ? (
          <span key={i} className={highlightClass}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};
