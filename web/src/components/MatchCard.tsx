import { Link } from 'react-router-dom';
import { FileCheck, ExternalLink } from 'lucide-react';
import type { SearchResultItem } from '@/types';
import SimilarityBar from './SimilarityBar';
import StatusBadge from './StatusBadge';
import CopyButton from './CopyButton';
import GatewayImage from './GatewayImage';

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
      to={`/manifest/${encodeURIComponent(manifestLinkId)}?distance=${result.distance}`}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {/* Image preview */}
      <GatewayImage
        txId={result.manifestTxId}
        contentType={result.contentType}
        alt={result.manifestId || result.manifestTxId}
        className="aspect-video sm:aspect-[4/3] w-full"
      />

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isExactMatch ? (
              <StatusBadge status="verified" label="EXACT MATCH" />
            ) : rank !== undefined ? (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                #{rank}
              </span>
            ) : null}
            {result.contentType && (
              <span className="text-xs text-foreground/60">{result.contentType}</span>
            )}
          </div>
          <ExternalLink className="h-4 w-4 text-foreground/30" />
        </div>

        <div className="mb-3 flex items-center gap-1">
          <FileCheck className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 truncate font-mono text-sm text-foreground">
            {result.manifestId || result.manifestTxId}
          </span>
          <CopyButton value={result.manifestId || result.manifestTxId} />
        </div>

        <SimilarityBar distance={result.distance} />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground/60">
          {result.ownerAddress && (
            <span title={result.ownerAddress}>
              <span className="text-foreground/40">Owner:</span> {truncateAddress(result.ownerAddress)}
            </span>
          )}
          {result.blockTimestamp && <span>{formatTimestamp(result.blockTimestamp)}</span>}
          {result.claimGenerator && (
            <span>
              <span className="text-foreground/40">Generator:</span> {result.claimGenerator}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
