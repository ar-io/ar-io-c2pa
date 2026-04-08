import type { ReactNode } from 'react';
import CopyButton from './CopyButton';

interface ProvenanceRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  copyValue?: string;
}

export default function ProvenanceRow({ label, value, mono, copyValue }: ProvenanceRowProps) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-foreground/5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <dt className="shrink-0 text-sm text-foreground/60">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span
          className={`truncate text-sm text-foreground ${mono ? 'font-mono' : ''}`}
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </span>
        {copyValue && <CopyButton value={copyValue} />}
      </dd>
    </div>
  );
}
