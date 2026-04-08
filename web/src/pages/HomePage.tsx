import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Cpu, Activity } from 'lucide-react';
import SearchBox, { type SearchParams } from '@/components/SearchBox';
import { useFileContext } from '@/contexts/FileContext';
import { checkHealth, getSupportedAlgorithms } from '@/api/client';
import type { HealthResponse, AlgorithmInfo } from '@/types';

export default function HomePage() {
  const navigate = useNavigate();
  const { setFile } = useFileContext();
  const [health, setHealth] = useState<HealthResponse['data'] | null>(null);
  const [algorithms, setAlgorithms] = useState<AlgorithmInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [healthRes, algRes] = await Promise.allSettled([
          checkHealth(),
          getSupportedAlgorithms(),
        ]);

        if (cancelled) return;

        if (healthRes.status === 'fulfilled' && healthRes.value.success) {
          setHealth(healthRes.value.data);
        }
        if (algRes.status === 'fulfilled') {
          setAlgorithms(algRes.value);
        }
      } catch {
        // Stats are non-critical; silently ignore
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = useCallback(
    (params: SearchParams) => {
      switch (params.type) {
        case 'content': {
          setFile(params.file);
          navigate('/results?type=content');
          break;
        }
        case 'phash':
          navigate(`/results?type=phash&phash=${encodeURIComponent(params.phash)}`);
          break;
        case 'manifest':
          navigate(`/manifest/${encodeURIComponent(params.manifestId)}`);
          break;
      }
    },
    [navigate, setFile]
  );

  const isServiceHealthy = health?.status === 'ok';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero section */}
      <div className="pb-8 pt-12 text-center">
        <h1 className="font-heading text-4xl font-bold text-foreground sm:text-5xl">
          Verify Content Provenance
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground/70">
          Search and verify C2PA Content Credentials registered on Arweave through AR.IO gateways.
        </p>
      </div>

      {/* Search box */}
      <div className="mx-auto mt-8 max-w-2xl">
        <SearchBox onSearch={handleSearch} />
      </div>

      {/* Stats section */}
      <div className="mt-16 grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-3">
        {/* Indexed Manifests */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-md">
          <Database className="mx-auto mb-3 h-6 w-6 text-primary/60" />
          {health?.stats.indexedManifests !== undefined ? (
            <p className="font-heading text-3xl font-bold text-primary">
              {health.stats.indexedManifests.toLocaleString()}
            </p>
          ) : (
            <div className="mx-auto h-9 w-20 animate-pulse rounded-lg bg-foreground/10" />
          )}
          <p className="mt-1 text-sm text-foreground/60">Indexed Manifests</p>
        </div>

        {/* Algorithms */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-md">
          <Cpu className="mx-auto mb-3 h-6 w-6 text-primary/60" />
          {algorithms ? (
            <div className="space-y-1">
              {algorithms.fingerprints.map((fp) => (
                <p key={fp.alg} className="font-mono text-sm text-foreground">
                  {fp.alg}
                </p>
              ))}
              {algorithms.watermarks.map((wm) => (
                <p key={wm.alg} className="font-mono text-sm text-foreground">
                  {wm.alg}
                </p>
              ))}
              {algorithms.fingerprints.length === 0 && algorithms.watermarks.length === 0 && (
                <p className="text-sm text-foreground/40">None configured</p>
              )}
            </div>
          ) : (
            <div className="mx-auto h-9 w-20 animate-pulse rounded-lg bg-foreground/10" />
          )}
          <p className="mt-2 text-sm text-foreground/60">Algorithms</p>
        </div>

        {/* Service Status */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-md">
          <Activity className="mx-auto mb-3 h-6 w-6 text-primary/60" />
          {health !== null ? (
            <div className="flex items-center justify-center gap-2">
              <span
                className={`inline-block h-3 w-3 rounded-full ${
                  isServiceHealthy ? 'bg-success' : 'bg-error'
                }`}
              />
              <span className="text-sm font-medium text-foreground">
                {isServiceHealthy ? 'Operational' : 'Degraded'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-foreground/20" />
              <div className="h-4 w-16 animate-pulse rounded bg-foreground/10" />
            </div>
          )}
          <p className="mt-2 text-sm text-foreground/60">Service Status</p>
        </div>
      </div>
    </div>
  );
}
