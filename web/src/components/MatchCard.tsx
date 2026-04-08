import { Link } from 'react-router-dom';
import { FileCheck, ExternalLink } from 'lucide-react';
import type { SearchResultItem } from '@/types';
import SimilarityBar from './SimilarityBar';
import StatusBadge from './StatusBadge';
import CopyButton from './CopyButton';

interface MatchCardProps {
  result: SearchResultItem;
  rank?: number;
}

function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return 'Unknown';
  try {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return ts;
  }
}

export default function MatchCard({ result, rank }: MatchCardProps) {
  const isExactMatch = result.distance === 0;
  const manifestLinkId = result.manifestId || result.manifestTxId;

  return (
    <Link
      to={`/manifest/${encodeURIComponent(manifestLinkId)}`}
      className="block rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-5 transition-all hover:-translate-y-1 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isExactMatch ? (
            <StatusBadge status="verified" label="EXACT MATCH" />
          ) : rank !== undefined ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#5427C8]/10 text-xs font-bold text-[#5427C8]">
              #{rank}
            </span>
          ) : null}
          {result.contentType && (
            <span className="text-xs text-[#23232D]/50">{result.contentType}</span>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-[#23232D]/30" />
      </div>

      <div className="mb-3 flex items-center gap-1">
        <FileCheck className="h-4 w-4 shrink-0 text-[#5427C8]" />
        <span className="min-w-0 truncate font-mono text-sm text-[#23232D]">
          {result.manifestId || result.manifestTxId}
        </span>
        <CopyButton value={result.manifestId || result.manifestTxId} />
      </div>

      <SimilarityBar distance={result.distance} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#23232D]/50">
        {result.ownerAddress && (
          <span title={result.ownerAddress}>{truncateAddress(result.ownerAddress)}</span>
        )}
        {result.blockTimestamp && <span>{formatTimestamp(result.blockTimestamp)}</span>}
        {result.claimGenerator && <span>{result.claimGenerator}</span>}
      </div>
    </Link>
  );
}
