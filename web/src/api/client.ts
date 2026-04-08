import type {
  HealthResponse,
  SearchResult,
  MatchResult,
  ManifestResponse,
  AlgorithmInfo,
} from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  if (opts?.threshold !== undefined) {
    params.set('threshold', String(opts.threshold));
  }
  if (opts?.limit !== undefined) {
    params.set('limit', String(opts.limit));
  }
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

export async function getSupportedAlgorithms(): Promise<AlgorithmInfo> {
  return request<AlgorithmInfo>('/v1/services/supportedAlgorithms');
}

export async function getCertChain(): Promise<string> {
  return requestText('/v1/cert');
}

export { ApiError };
