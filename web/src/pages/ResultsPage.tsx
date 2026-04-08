import { useEffect, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import type { SearchResultItem } from '@/types';
import MatchCard from '@/components/MatchCard';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

/** Reconstruct a File from the base64 data URL stored in router state. */
function dataUrlToFile(dataUrl: string, fileName: string, fileType: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header?.match(/:(.*?);/)?.[1] || fileType || 'application/octet-stream';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}

interface ContentRouterState {
  type: 'content';
  fileName: string;
  fileType: string;
  fileData: string;
}

function isContentState(value: unknown): value is ContentRouterState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj['type'] === 'content' && typeof obj['fileData'] === 'string';
}

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, searchByContent, searchByPhash, searchByManifest, reset } = useSearch();

  // Determine query type from URL params or router state
  const queryType = searchParams.get('type');
  const queryPhash = searchParams.get('phash');
  const routerState = location.state as unknown;

  // Trigger the appropriate search on mount
  useEffect(() => {
    // Avoid re-triggering if we already have results or are loading
    if (state.status === 'results' || state.status === 'loading') return;

    if (queryType === 'phash' && queryPhash) {
      searchByPhash(queryPhash);
    } else if (queryType === 'manifest') {
      const manifestId = searchParams.get('manifestId');
      if (manifestId) {
        searchByManifest(manifestId);
      }
    } else if (isContentState(routerState)) {
      const file = dataUrlToFile(routerState.fileData, routerState.fileName, routerState.fileType);
      searchByContent(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryType, queryPhash, routerState]);

  // Separate exact matches (distance === 0) from similar matches
  const { exactMatches, similarMatches } = useMemo(() => {
    if (state.status !== 'results') return { exactMatches: [], similarMatches: [] };
    const exact: SearchResultItem[] = [];
    const similar: SearchResultItem[] = [];
    for (const r of state.results) {
      if (r.distance === 0) {
        exact.push(r);
      } else {
        similar.push(r);
      }
    }
    // Similar matches ranked by ascending distance (closest first)
    similar.sort((a, b) => a.distance - b.distance);
    return { exactMatches: exact, similarMatches: similar };
  }, [state]);

  const handleTryAgain = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-[#23232D]/60">
        <Link to="/" className="text-[#5427C8] hover:text-[#4520A8]">
          Home
        </Link>
        <span className="mx-2">&gt;</span>
        <span>Search Results</span>
      </nav>

      {/* Loading state */}
      {state.status === 'loading' && (
        <Spinner message="Analyzing image and searching for matches..." size="lg" />
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <EmptyState
          title="Search Failed"
          description={state.message}
          action={{ label: 'Try Again', onClick: handleTryAgain }}
        />
      )}

      {/* Results state */}
      {state.status === 'results' && (
        <>
          {state.results.length === 0 ? (
            <EmptyState
              title="No Matches Found"
              description="No C2PA manifests were found matching your query. Try uploading a different image or searching with a different hash."
              action={{ label: 'Back to Search', onClick: handleTryAgain }}
            />
          ) : (
            <>
              {/* Results header */}
              <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[#23232D]">
                  {state.results.length}{' '}
                  {state.results.length === 1 ? 'result' : 'results'} found
                  <span className="ml-2 text-base font-normal text-[#23232D]/50">
                    in {state.elapsed}ms
                  </span>
                </h1>
              </div>

              {/* Exact match highlight */}
              {exactMatches.length > 0 && (
                <div className="mb-8">
                  <div className="rounded-2xl border-2 border-[#16A34A]/30 bg-[#F0FDF4] p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <ShieldCheck className="h-6 w-6 text-[#16A34A]" />
                      <span className="font-heading text-lg font-bold text-[#16A34A]">
                        This image is registered on the Arweave permaweb.
                      </span>
                    </div>
                    <div className="space-y-4">
                      {exactMatches.map((result) => (
                        <MatchCard
                          key={result.manifestTxId}
                          result={result}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Similar matches */}
              {similarMatches.length > 0 && (
                <div>
                  <h2 className="mb-4 font-heading text-lg font-bold text-[#23232D]">
                    Similar Matches
                  </h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {similarMatches.map((result, index) => (
                      <MatchCard
                        key={result.manifestTxId}
                        result={result}
                        rank={index + 1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Idle state (navigated directly without search params) */}
      {state.status === 'idle' &&
        !queryType &&
        !isContentState(routerState) && (
          <EmptyState
            title="No Search Query"
            description="Navigate to the home page to search for content provenance."
            action={{ label: 'Go to Search', onClick: () => navigate('/') }}
          />
        )}
    </div>
  );
}
