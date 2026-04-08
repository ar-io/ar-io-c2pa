import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Cpu, Activity } from 'lucide-react';
import SearchBox, { type SearchParams } from '@/components/SearchBox';
import { checkHealth, getSupportedAlgorithms } from '@/api/client';
import type { HealthResponse, AlgorithmInfo } from '@/types';

export default function HomePage() {
  const navigate = useNavigate();
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
          // Convert file to base64 data URL and pass via router state
          const reader = new FileReader();
          reader.onload = () => {
            navigate('/results', {
              state: {
                type: 'content',
                fileName: params.file.name,
                fileType: params.file.type,
                fileData: reader.result as string,
              },
            });
          };
          reader.readAsDataURL(params.file);
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
    [navigate],
  );

  const isServiceHealthy = health?.status === 'ok';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero section */}
      <div className="pb-8 pt-16 text-center">
        <h1 className="font-heading text-4xl font-bold text-[#23232D] sm:text-5xl">
          Verify Content Provenance
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[#23232D]/70">
          Search and verify C2PA Content Credentials registered on Arweave through AR.IO gateways.
        </p>
      </div>

      {/* Search box */}
      <div className="mx-auto mt-8 max-w-2xl">
        <SearchBox onSearch={handleSearch} />
      </div>

      {/* Stats section */}
      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Indexed Manifests */}
        <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6 text-center">
          <Database className="mx-auto mb-3 h-6 w-6 text-[#5427C8]/60" />
          <p className="font-heading text-3xl font-bold text-[#5427C8]">
            {health?.stats.indexedManifests !== undefined
              ? health.stats.indexedManifests.toLocaleString()
              : '--'}
          </p>
          <p className="mt-1 text-sm text-[#23232D]/60">Indexed Manifests</p>
        </div>

        {/* Algorithms */}
        <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6 text-center">
          <Cpu className="mx-auto mb-3 h-6 w-6 text-[#5427C8]/60" />
          {algorithms ? (
            <div className="space-y-1">
              {algorithms.fingerprints.map((fp) => (
                <p key={fp.alg} className="font-mono text-sm text-[#23232D]">
                  {fp.alg}
                </p>
              ))}
              {algorithms.watermarks.map((wm) => (
                <p key={wm.alg} className="font-mono text-sm text-[#23232D]">
                  {wm.alg}
                </p>
              ))}
              {algorithms.fingerprints.length === 0 && algorithms.watermarks.length === 0 && (
                <p className="text-sm text-[#23232D]/40">None configured</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#23232D]/40">--</p>
          )}
          <p className="mt-2 text-sm text-[#23232D]/60">Algorithms</p>
        </div>

        {/* Service Status */}
        <div className="rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] p-6 text-center">
          <Activity className="mx-auto mb-3 h-6 w-6 text-[#5427C8]/60" />
          <div className="flex items-center justify-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                health === null
                  ? 'bg-[#23232D]/20'
                  : isServiceHealthy
                    ? 'bg-[#16A34A]'
                    : 'bg-[#DC2626]'
              }`}
            />
            <span className="text-sm font-medium text-[#23232D]">
              {health === null ? 'Checking...' : isServiceHealthy ? 'Operational' : 'Degraded'}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#23232D]/60">Service Status</p>
        </div>
      </div>
    </div>
  );
}
