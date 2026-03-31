'use client';

interface ScoreDotProps {
  score: number; // 0-1 scale
  label?: string;
  mustHave?: boolean;
}

/**
 * Color-coded dot representing a skill match score.
 * Green: >= 0.8, Yellow: >= 0.5, Red: < 0.5, Gray: 0 (missing)
 */
export function ScoreDot({ score, label, mustHave }: ScoreDotProps) {
  const color =
    score === 0
      ? 'bg-zinc-600'
      : score >= 0.8
        ? 'bg-emerald-500'
        : score >= 0.5
          ? 'bg-yellow-500'
          : 'bg-red-500';

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`h-2.5 w-2.5 rounded-full ${color}`}
        title={`${Math.round(score * 100)}%`}
      />
      {label && (
        <span className="text-xs text-muted-foreground">
          {label}
          {mustHave && <span className="ml-0.5 text-amber-400">✱</span>}
        </span>
      )}
    </div>
  );
}
