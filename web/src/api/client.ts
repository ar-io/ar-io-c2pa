import type {
  HealthResponse,
  SearchResult,
  MatchResult,
  ManifestResponse,
  AlgorithmInfo,
} from '@/types';

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/api`;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message: string;
    try {
      const body = await response.json();
      message = body.error || body.message || response.statusText;
    } catch {
      message = response.statusText;
    }
    throw new ApiError(response.status, `API error ${response.status}: ${message}`);
  }

  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API error ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export async function searchSimilar(
  phash: string,
  opts?: { threshold?: number; limit?: number }
): Promise<SearchResult> {
  const params = new URLSearchParams({ phash });
  params.set('threshold', String(opts?.threshold ?? 10));
  params.set('limit', String(opts?.limit ?? 50));
  return request<SearchResult>(`/v1/search-similar?${params.toString()}`);
}

export async function matchByContent(
  file: File,
  opts?: { signal?: AbortSignal }
): Promise<MatchResult> {
  return request<MatchResult>('/v1/matches/byContent', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
    signal: opts?.signal,
  });
}

export async function matchByBinding(
  alg: string,
  value: string,
  opts?: { signal?: AbortSignal }
): Promise<MatchResult> {
  return request<MatchResult>('/v1/matches/byBinding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ alg, value }),
    signal: opts?.signal,
  });
}

export async function matchByReference(
  url: string,
  opts?: { signal?: AbortSignal }
): Promise<MatchResult> {
  return request<MatchResult>('/v1/matches/byReference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
    signal: opts?.signal,
  });
}

export async function getManifest(manifestId: string): Promise<ManifestResponse> {
  return request<ManifestResponse>(`/v1/manifests/${encodeURIComponent(manifestId)}`, {
    redirect: 'follow',
  });
}

/**
 * Look up manifest metadata by searching the index.
 * Uses a broad similarity search and filters by manifestId or txId.
 */
export async function lookupManifestMetadata(
  manifestId: string,
): Promise<SearchResult['data']['results'][0] | null> {
  try {
    const result = await request<SearchResult>(
      `/v1/search-similar?phash=0000000000000000&threshold=64&limit=100`,
    );
    const match = result.data.results.find(
      (r) => r.manifestId === manifestId || r.manifestTxId === manifestId,
    );
    if (match) return match;
  } catch {
    // search failed
  }

  return null;
}

export async function getSupportedAlgorithms(): Promise<AlgorithmInfo> {
  return request<AlgorithmInfo>('/v1/services/supportedAlgorithms');
}

export async function getCertChain(): Promise<string> {
  return requestText('/v1/cert');
}

export { ApiError };
