type BadgeStatus = 'verified' | 'similar' | 'unverified' | 'proof-locator' | 'manifest-store';

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

const statusConfig: Record<BadgeStatus, { bg: string; text: string; border: string; defaultLabel: string }> = {
  verified: {
    bg: 'bg-[#16A34A]/10',
    text: 'text-[#16A34A]',
    border: 'border-[#16A34A]/20',
    defaultLabel: 'Verified',
  },
  similar: {
    bg: 'bg-[#D97706]/10',
    text: 'text-[#D97706]',
    border: 'border-[#D97706]/20',
    defaultLabel: 'Similar',
  },
  unverified: {
    bg: 'bg-[#DC2626]/10',
    text: 'text-[#DC2626]',
    border: 'border-[#DC2626]/20',
    defaultLabel: 'Unverified',
  },
  'proof-locator': {
    bg: 'bg-[#2563EB]/10',
    text: 'text-[#2563EB]',
    border: 'border-[#2563EB]/20',
    defaultLabel: 'Proof Locator',
  },
  'manifest-store': {
    bg: 'bg-[#5427C8]/10',
    text: 'text-[#5427C8]',
    border: 'border-[#5427C8]/20',
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
