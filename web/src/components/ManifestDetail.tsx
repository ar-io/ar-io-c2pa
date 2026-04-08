import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Search } from 'lucide-react';
import { getManifest } from '@/api/client';
import type { ManifestResponse } from '@/types';
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

function viewblockUrl(txId: string): string {
  return `https://viewblock.io/arweave/tx/${txId}`;
}

function artifactKindToStatus(kind?: string): 'proof-locator' | 'manifest-store' {
  if (kind === 'proof-locator') return 'proof-locator';
  return 'manifest-store';
}

/** Render a pHash as an 8x8 grid of colored cells. */
function PHashGrid({ phash }: { phash: string }) {
  // Convert hex pHash to binary string
  let binary = '';
  for (const char of phash) {
    binary += parseInt(char, 16).toString(2).padStart(4, '0');
  }
  // Ensure we have exactly 64 bits
  binary = binary.slice(0, 64).padEnd(64, '0');

  return (
    <div className="inline-grid grid-cols-8 gap-px overflow-hidden rounded-lg border border-[#23232D]/10">
      {binary.split('').map((bit, i) => (
        <div
          key={i}
          className={`h-5 w-5 ${bit === '1' ? 'bg-[#5427C8]' : 'bg-[#F0F0F0]'}`}
          title={`Bit ${i}: ${bit}`}
        />
      ))}
    </div>
  );
}

export default function ManifestDetail({ manifestId }: ManifestDetailProps) {
  const [data, setData] = useState<ManifestResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getManifest(manifestId);
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError('Manifest data unavailable');
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
        action={{ label: 'Back to Search', onClick: () => window.history.back() }}
      />
    );
  }

  // Extract phash from assertions if available
  const phashAssertion = data.assertions?.find(
    (a) => (a as Record<string, unknown>)['label'] === 'c2pa.soft-binding',
  ) as Record<string, unknown> | undefined;
  const phashValue =
    phashAssertion?.value !== undefined
      ? String((phashAssertion.value as Record<string, unknown>)?.['phash'] ?? '')
      : '';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-bold text-[#23232D]">Content Credentials</h2>
        <p className="mt-1 text-sm text-[#23232D]/60">
          Provenance information for this C2PA manifest
        </p>
      </div>

      <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6">
        <dl>
          <ProvenanceRow
            label="Manifest ID"
            value={data.manifestId}
            mono
            copyValue={data.manifestId}
          />
          <ProvenanceRow
            label="Transaction ID"
            value={
              <a
                href={viewblockUrl(data.manifestTxId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#5427C8] hover:text-[#4520A8]"
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
        </dl>
      </div>

      {/* Soft Bindings / pHash section */}
      {phashValue && (
        <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6">
          <h3 className="mb-4 font-heading text-lg font-bold text-[#23232D]">
            Perceptual Hash (pHash)
          </h3>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <PHashGrid phash={phashValue} />
            <div className="space-y-3">
              <ProvenanceRow label="pHash" value={phashValue} mono copyValue={phashValue} />
              <Link
                to={`/results?type=phash&phash=${encodeURIComponent(phashValue)}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#5427C8] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4520A8]"
              >
                <Search className="h-4 w-4" />
                Find Similar
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients section */}
      {data.ingredients && data.ingredients.length > 0 && (
        <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6">
          <h3 className="mb-4 font-heading text-lg font-bold text-[#23232D]">Ingredients</h3>
          <div className="space-y-3">
            {data.ingredients.map((ingredient, i) => {
              const ing = ingredient as Record<string, unknown>;
              return (
                <div key={i} className="rounded-xl border border-[#23232D]/5 bg-white p-4">
                  {Boolean(ing['title']) && (
                    <p className="text-sm font-medium text-[#23232D]">{String(ing['title'])}</p>
                  )}
                  {Boolean(ing['format']) && (
                    <p className="text-xs text-[#23232D]/60">{String(ing['format'])}</p>
                  )}
                  {Boolean(ing['manifestId']) && (
                    <Link
                      to={`/manifest/${encodeURIComponent(String(ing['manifestId']))}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[#5427C8] hover:text-[#4520A8]"
                    >
                      <span className="font-mono">
                        {String(ing['manifestId']).slice(0, 30)}...
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assertions section */}
      {data.assertions && data.assertions.length > 0 && (
        <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6">
          <h3 className="mb-4 font-heading text-lg font-bold text-[#23232D]">Assertions</h3>
          <div className="space-y-2">
            {data.assertions.map((assertion, i) => {
              const a = assertion as Record<string, unknown>;
              return (
                <div key={i} className="rounded-xl border border-[#23232D]/5 bg-white p-4">
                  <p className="text-sm font-medium text-[#23232D]">
                    {String(a['label'] || `Assertion ${i + 1}`)}
                  </p>
                  {Boolean(a['data']) && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[#F0F0F0] p-3 font-mono text-xs text-[#23232D]/70">
                      {JSON.stringify(a['data'], null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
