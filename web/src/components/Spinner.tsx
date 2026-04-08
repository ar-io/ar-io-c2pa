interface SpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export default function Spinner({ message, size = 'md' }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-[#F0F0F0] border-t-[#5427C8]`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="text-sm text-[#23232D]/60">{message}</p>}
    </div>
  );
}
