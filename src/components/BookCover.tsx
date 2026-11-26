import { useState } from 'react';
import type { CoverTone } from '../types';

interface BookCoverProps {
  title: string;
  author: string;
  callNumber: string;
  coverUrl?: string;
  coverTone: CoverTone;
  size?: 'sm' | 'md' | 'lg';
}

const TONE_CLASSES: Record<CoverTone, { bg: string; text: string; muted: string; border: string }> = {
  ivory: {
    bg: 'bg-stone-100',
    text: 'text-slate-900',
    muted: 'text-slate-500',
    border: 'border-stone-200',
  },
  slate: {
    bg: 'bg-slate-900',
    text: 'text-slate-50',
    muted: 'text-slate-400',
    border: 'border-slate-800',
  },
  indigo: {
    bg: 'bg-slate-800',
    text: 'text-slate-100',
    muted: 'text-slate-300',
    border: 'border-slate-700',
  },
  ochre: {
    bg: 'bg-amber-50',
    text: 'text-slate-900',
    muted: 'text-amber-800',
    border: 'border-amber-200',
  },
  emerald: {
    bg: 'bg-emerald-950',
    text: 'text-emerald-50',
    muted: 'text-emerald-300',
    border: 'border-emerald-900',
  },
  stone: {
    bg: 'bg-zinc-100',
    text: 'text-zinc-900',
    muted: 'text-zinc-500',
    border: 'border-zinc-200',
  },
};

export function BookCover({
  title,
  author,
  callNumber,
  coverUrl,
  coverTone,
  size = 'md',
}: BookCoverProps) {
  const [imgError, setImgError] = useState(false);
  const tone = TONE_CLASSES[coverTone] || TONE_CLASSES.stone;

  const sizeClass =
    size === 'sm'
      ? 'w-12 h-16 rounded'
      : size === 'lg'
        ? 'w-40 aspect-[3/4] rounded-md'
        : 'w-full aspect-[3/4] rounded-md';

  if (coverUrl && !imgError) {
    return (
      <div className={`${sizeClass} relative overflow-hidden border border-slate-200 bg-slate-100 shrink-0`}>
        <img
          src={coverUrl}
          alt={`Sampul buku ${title}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${tone.bg} ${tone.border} border p-3 flex flex-col justify-between shrink-0 select-none`}
    >
      <div className={`font-mono text-[10px] tracking-tight truncate ${tone.muted}`}>
        {callNumber}
      </div>
      <div>
        <div
          className={`font-display font-semibold leading-snug line-clamp-3 ${
            size === 'sm' ? 'text-[9px]' : 'text-sm'
          } ${tone.text}`}
        >
          {title}
        </div>
        {size !== 'sm' && (
          <div className={`mt-1.5 text-[11px] truncate ${tone.muted}`}>{author}</div>
        )}
      </div>
    </div>
  );
}
