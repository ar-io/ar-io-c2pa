import { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { useFileContext } from '@/contexts/FileContext';
import type { SearchResultItem } from '@/types';
import MatchCard from '@/components/MatchCard';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getFile } = useFileContext();
  const { state, searchByContent, searchByPhash, searchByManifest, reset } = useSearch();

  // Determine query type from URL params
  const queryType = searchParams.get('type');
  const queryPhash = searchParams.get('phash');

  const searchKey =
    queryType === 'phash'
      ? `phash:${queryPhash}`
      : queryType === 'content'
        ? 'content'
        : queryType === 'manifest'
          ? `manifest:${searchParams.get('manifestId')}`
          : '';

  // Trigger the appropriate search when searchKey changes
  useEffect(() => {
    if (!searchKey) return;
    reset();

    if (queryType === 'phash' && queryPhash) {
      searchByPhash(queryPhash);
    } else if (queryType === 'content') {
      const file = getFile();
      if (file) {
        searchByContent(file);
      }
    } else if (queryType === 'manifest') {
      const manifestId = searchParams.get('manifestId');
      if (manifestId) {
        searchByManifest(manifestId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

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
      <nav className="mb-8 text-sm text-foreground/60">
        <Link to="/" className="text-primary hover:text-primary-hover">
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
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  {state.results.length} {state.results.length === 1 ? 'result' : 'results'} found
                  <span className="ml-2 text-sm font-normal text-foreground/50">
                    in {state.elapsed}ms
                  </span>
                </h1>
              </div>

              {/* Exact match highlight */}
              {exactMatches.length > 0 && (
                <div className="mb-8">
                  <div className="mb-4 flex items-center gap-2 rounded-2xl border-2 border-success/30 bg-success-bg p-4">
                    <ShieldCheck className="h-5 w-5 text-success" />
                    <span className="text-sm font-semibold text-success">
                      This image is registered on the Arweave permaweb.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {exactMatches.map((result) => (
                      <MatchCard key={result.manifestTxId} result={result} />
                    ))}
                  </div>
                </div>
              )}

              {/* Similar matches */}
              {similarMatches.length > 0 && (
                <div>
                  <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
                    Similar Matches
                  </h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {similarMatches.map((result, index) => (
                      <MatchCard key={result.manifestTxId} result={result} rank={index + 1} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Idle state (navigated directly without search params) */}
      {state.status === 'idle' && !queryType && (
        <EmptyState
          title="No Search Query"
          description="Navigate to the home page to search for content provenance."
          action={{ label: 'Go to Search', onClick: () => navigate('/') }}
        />
      )}

      {state.status === 'idle' && queryType && (
        <EmptyState
          title="Search Expired"
          description="The uploaded file is no longer available. Please return to the search page and try again."
          action={{ label: 'Back to Search', onClick: handleTryAgain }}
        />
      )}
    </div>
  );
}
