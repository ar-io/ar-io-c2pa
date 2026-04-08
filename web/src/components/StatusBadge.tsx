type BadgeStatus = 'verified' | 'similar' | 'unverified' | 'proof-locator' | 'manifest-store';

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

const statusConfig: Record<
  BadgeStatus,
  { bg: string; text: string; border: string; defaultLabel: string }
> = {
  verified: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    defaultLabel: 'Verified',
  },
  similar: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    defaultLabel: 'Similar',
  },
  unverified: {
    bg: 'bg-error/10',
    text: 'text-error',
    border: 'border-error/20',
    defaultLabel: 'Unverified',
  },
  'proof-locator': {
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/20',
    defaultLabel: 'Proof Locator',
  },
  'manifest-store': {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    defaultLabel: 'Manifest Store',
  },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text} ${config.border}`}
    >
      {label || config.defaultLabel}
    </span>
  );
}
