import { useEffect, useState } from 'react';

interface SimilarityBarProps {
  distance: number;
}

function getBarColor(percentage: number): string {
  if (percentage >= 80) return 'bg-success';
  if (percentage >= 60) return 'bg-warning';
  return 'bg-error';
}

export default function SimilarityBar({ distance }: SimilarityBarProps) {
  const [animated, setAnimated] = useState(false);
  const percentage = Math.max(0, Math.min(100, Math.round(((64 - distance) / 64) * 100)));
  const color = getBarColor(percentage);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/60">Similarity</span>
        <span
          className={`text-xs font-semibold ${percentage >= 80 ? 'text-success' : percentage >= 60 ? 'text-warning' : 'text-error'}`}
        >
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-card">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: animated ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  );
}
