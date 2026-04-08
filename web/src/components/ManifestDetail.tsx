import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Search } from 'lucide-react';
import { lookupManifestMetadata } from '@/api/client';
import type { SearchResultItem } from '@/types';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ProvenanceRow from './ProvenanceRow';
import StatusBadge from './StatusBadge';

interface ManifestDetailProps {
  manifestId: string;
}

function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return 'Unknown';
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

/** Gateway base URL — same origin the app is served from. */
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || window.location.origin;

function gatewayTxUrl(txId: string): string {
  return `${GATEWAY_URL}/${txId}`;
}

function artifactKindToStatus(kind?: string): 'proof-locator' | 'manifest-store' {
  if (kind === 'proof-locator') return 'proof-locator';
  return 'manifest-store';
}


export default function ManifestDetail({ manifestId }: ManifestDetailProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<SearchResultItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await lookupManifestMetadata(manifestId);
      if (result) {
        setData(result);
      } else {
        setError('Manifest not found in the index');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manifest');
    } finally {
      setLoading(false);
    }
  }, [manifestId]);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  if (loading) {
    return <Spinner message="Loading manifest data..." size="lg" />;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Manifest Not Found"
        description={error || `Could not find manifest: ${manifestId}`}
        action={{ label: 'Back to Search', onClick: () => navigate('/') }}
      />
    );
  }

  // Compute pHash hex from distance=0 search result (the manifestId matched)
  // The search endpoint doesn't return the raw pHash hex, but we can derive it
  // from the soft binding value if we had it. For now, show what we have.

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">Content Credentials</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Provenance information for this C2PA manifest
        </p>
      </div>

      {/* Verification status */}
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 ${
          data.distance === 0
            ? 'border-success/30 bg-success-bg'
            : 'border-warning/30 bg-warning-bg'
        }`}
      >
        <StatusBadge status={data.distance === 0 ? 'verified' : 'similar'} />
        <span className="text-sm font-medium text-foreground">
          {data.distance === 0
            ? 'Exact match — this manifest is registered on the Arweave permaweb.'
            : `Similar match — Hamming distance: ${data.distance}`}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <dl>
          {data.manifestId && (
            <ProvenanceRow
              label="Manifest ID"
              value={data.manifestId}
              mono
              copyValue={data.manifestId}
            />
          )}
          <ProvenanceRow
            label="Transaction ID"
            value={
              <a
                href={gatewayTxUrl(data.manifestTxId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:text-primary-hover"
              >
                <span className="font-mono">{truncateAddress(data.manifestTxId, 10)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            }
            copyValue={data.manifestTxId}
          />
          <ProvenanceRow label="Content Type" value={data.contentType} />
          <ProvenanceRow
            label="Owner"
            value={truncateAddress(data.ownerAddress)}
            mono
            copyValue={data.ownerAddress}
          />
          {data.artifactKind && (
            <ProvenanceRow
              label="Artifact Kind"
              value={<StatusBadge status={artifactKindToStatus(data.artifactKind)} />}
            />
          )}
          {data.claimGenerator && (
            <ProvenanceRow label="Claim Generator" value={data.claimGenerator} />
          )}
          {data.blockTimestamp && (
            <ProvenanceRow label="Timestamp" value={formatTimestamp(data.blockTimestamp)} />
          )}
          {data.blockHeight !== undefined && (
            <ProvenanceRow label="Block Height" value={String(data.blockHeight)} mono />
          )}
          <ProvenanceRow
            label="Arweave"
            value={
              <a
                href={gatewayTxUrl(data.manifestTxId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:text-primary-hover"
              >
                <span>View on Arweave</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
        </dl>
      </div>

      {/* Find similar section */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 font-heading text-lg font-bold text-foreground">
          Similarity Search
        </h3>
        <p className="mb-4 text-sm text-foreground/60">
          Find other C2PA manifests with similar perceptual hashes.
        </p>
        <Link
          to={`/results?type=manifest&manifestId=${encodeURIComponent(data.manifestId || data.manifestTxId)}`}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          <Search className="h-4 w-4" />
          Find Similar Manifests
        </Link>
      </div>
    </div>
  );
}
