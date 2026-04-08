import { useState, useCallback } from 'react';
import type { SearchResultItem } from '@/types';
import { matchByContent, searchSimilar, getManifest } from '@/api/client';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; startTime: number }
  | { status: 'results'; results: SearchResultItem[]; elapsed: number }
  | { status: 'error'; message: string };

function friendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return 'Unable to reach the server. Please check your connection and try again.';
    }
    if (msg.includes('413') || msg.includes('size exceeds')) {
      return 'The uploaded image is too large. Please use a smaller image (max 25 MB).';
    }
    if (msg.includes('415') || msg.includes('Unsupported content type')) {
      return 'Unsupported file type. Please upload a JPEG, PNG, WebP, GIF, TIFF, or AVIF image.';
    }
    if (msg.includes('400') || msg.includes('Invalid')) {
      return 'Invalid input. Please check your search query and try again.';
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return 'No matching manifest found for the given identifier.';
    }
    if (msg.includes('502') || msg.includes('503')) {
      return 'The service is temporarily unavailable. Please try again in a moment.';
    }

    // Return the original message if it is already user-friendly
    if (!msg.startsWith('API error')) {
      return msg;
    }

    // Strip the "API error NNN:" prefix for readability
    const cleaned = msg.replace(/^API error \d+:\s*/, '');
    return cleaned || 'An unexpected error occurred. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  const searchByPhash = useCallback(async (phash: string) => {
    const startTime = Date.now();
    setState({ status: 'loading', startTime });

    try {
      const response = await searchSimilar(phash);
      const elapsed = Date.now() - startTime;
      setState({
        status: 'results',
        results: response.data.results,
        elapsed,
      });
    } catch (err) {
      setState({ status: 'error', message: friendlyErrorMessage(err) });
    }
  }, []);

  const searchByContent = useCallback(async (file: File) => {
    const startTime = Date.now();
    setState({ status: 'loading', startTime });

    try {
      // Step 1: Upload image to get matching manifest IDs
      const matchResult = await matchByContent(file);

      if (!matchResult.matches || matchResult.matches.length === 0) {
        const elapsed = Date.now() - startTime;
        setState({ status: 'results', results: [], elapsed });
        return;
      }

      // Step 2: For each matched manifest, fetch its details and build
      // SearchResultItem entries. We use searchSimilar with txId when possible,
      // or fall back to getManifest for individual detail.
      const allResults: SearchResultItem[] = [];
      const seen = new Set<string>();

      // Try to get the first manifest's phash so we can do a similarity search
      // that gives us distances for all results at once.
      const firstManifest = matchResult.matches[0];
      if (firstManifest) {
        try {
          const manifestResponse = await getManifest(firstManifest.manifestId);
          if (manifestResponse.success && manifestResponse.data) {
            // Extract phash from assertions if available
            const phashAssertion = manifestResponse.data.assertions?.find(
              (a) => (a as Record<string, unknown>)['label'] === 'c2pa.soft-binding'
            ) as Record<string, unknown> | undefined;
            const phashValue =
              phashAssertion?.value !== undefined
                ? String((phashAssertion.value as Record<string, unknown>)?.['phash'] ?? '')
                : '';

            if (phashValue) {
              // Search similar using the extracted phash to get distances
              const similarResponse = await searchSimilar(phashValue);
              for (const r of similarResponse.data.results) {
                if (!seen.has(r.manifestTxId)) {
                  seen.add(r.manifestTxId);
                  allResults.push(r);
                }
              }
            }
          }
        } catch {
          // Fall through to per-manifest lookup below
        }
      }

      // For any matched manifests not already in results, fetch individually
      for (const match of matchResult.matches) {
        if (
          allResults.some(
            (r) => r.manifestId === match.manifestId || r.manifestTxId === match.manifestId
          )
        ) {
          continue;
        }

        try {
          const manifestResponse = await getManifest(match.manifestId);
          if (manifestResponse.success && manifestResponse.data) {
            const d = manifestResponse.data;
            if (!seen.has(d.manifestTxId)) {
              seen.add(d.manifestTxId);
              allResults.push({
                manifestTxId: d.manifestTxId,
                manifestId: d.manifestId,
                distance: 0, // Exact content match
                contentType: d.contentType,
                ownerAddress: d.ownerAddress,
                blockHeight: d.blockHeight,
                blockTimestamp: d.blockTimestamp,
                claimGenerator: d.claimGenerator,
                artifactKind: d.artifactKind,
              });
            }
          }
        } catch {
          // Skip manifests we cannot fetch
        }
      }

      // Sort by distance (exact matches first)
      allResults.sort((a, b) => a.distance - b.distance);

      const elapsed = Date.now() - startTime;
      setState({ status: 'results', results: allResults, elapsed });
    } catch (err) {
      setState({ status: 'error', message: friendlyErrorMessage(err) });
    }
  }, []);

  const searchByManifest = useCallback(
    async (manifestId: string) => {
      const startTime = Date.now();
      setState({ status: 'loading', startTime });

      try {
        const manifestResponse = await getManifest(manifestId);

        if (!manifestResponse.success || !manifestResponse.data) {
          setState({
            status: 'error',
            message: 'No matching manifest found for the given identifier.',
          });
          return;
        }

        const data = manifestResponse.data;

        // Extract phash from assertions to search for similar manifests
        const phashAssertion = data.assertions?.find(
          (a) => (a as Record<string, unknown>)['label'] === 'c2pa.soft-binding'
        ) as Record<string, unknown> | undefined;
        const phashValue =
          phashAssertion?.value !== undefined
            ? String((phashAssertion.value as Record<string, unknown>)?.['phash'] ?? '')
            : '';

        if (phashValue) {
          // Use the phash to find similar results with distance values
          await searchByPhash(phashValue);
          return;
        }

        // No phash available; return just this manifest as the single result
        const elapsed = Date.now() - startTime;
        setState({
          status: 'results',
          results: [
            {
              manifestTxId: data.manifestTxId,
              manifestId: data.manifestId,
              distance: 0,
              contentType: data.contentType,
              ownerAddress: data.ownerAddress,
              blockHeight: data.blockHeight,
              blockTimestamp: data.blockTimestamp,
              claimGenerator: data.claimGenerator,
              artifactKind: data.artifactKind,
            },
          ],
          elapsed,
        });
      } catch (err) {
        setState({ status: 'error', message: friendlyErrorMessage(err) });
      }
    },
    [searchByPhash]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, searchByContent, searchByPhash, searchByManifest, reset };
}
