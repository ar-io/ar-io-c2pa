import { useEffect, useState } from 'react';

interface SimilarityBarProps {
  distance: number;
}

function getBarColor(percentage: number): string {
  if (percentage >= 80) return 'bg-[#16A34A]';
  if (percentage >= 60) return 'bg-[#D97706]';
  return 'bg-[#DC2626]';
}

export default function SimilarityBar({ distance }: SimilarityBarProps) {
  const [animated, setAnimated] = useState(false);
  const percentage = Math.round(((64 - distance) / 64) * 100);
  const color = getBarColor(percentage);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#23232D]/60">Similarity</span>
        <span className={`text-xs font-semibold ${percentage >= 80 ? 'text-[#16A34A]' : percentage >= 60 ? 'text-[#D97706]' : 'text-[#DC2626]'}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: animated ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  );
}
