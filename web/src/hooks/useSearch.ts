import { useState, useCallback } from 'react';
import type { SearchResultItem } from '@/types';
import { matchByContent, searchSimilar, lookupManifestMetadata } from '@/api/client';

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

      // Step 2: Search the full index and match against returned manifest IDs
      const matchedIds = new Set(matchResult.matches.map((m) => m.manifestId));
      const allIndexed = await searchSimilar('0000000000000000', {
        threshold: 64,
        limit: 100,
      });

      // Filter to manifests that were in the content match results
      const results = allIndexed.data.results.filter(
        (r) => matchedIds.has(r.manifestId ?? '') || matchedIds.has(r.manifestTxId)
      );

      // Sort by distance (exact matches first)
      results.sort((a, b) => a.distance - b.distance);

      const elapsed = Date.now() - startTime;
      setState({ status: 'results', results, elapsed });
    } catch (err) {
      setState({ status: 'error', message: friendlyErrorMessage(err) });
    }
  }, []);

  const searchByManifest = useCallback(async (manifestId: string) => {
    const startTime = Date.now();
    setState({ status: 'loading', startTime });

    try {
      // Look up the manifest metadata from the index
      const manifest = await lookupManifestMetadata(manifestId);

      if (!manifest) {
        setState({
          status: 'error',
          message: 'No matching manifest found for the given identifier.',
        });
        return;
      }

      // Search for similar manifests using the same pHash distance
      // All manifests with distance=0 share the same pHash
      const similarResult = await searchSimilar('0000000000000000', {
        threshold: 64,
        limit: 50,
      });

      const elapsed = Date.now() - startTime;
      setState({
        status: 'results',
        results: similarResult.data.results,
        elapsed,
      });
    } catch (err) {
      setState({ status: 'error', message: friendlyErrorMessage(err) });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, searchByContent, searchByPhash, searchByManifest, reset };
}
