export interface HealthResponse {
  success: boolean;
  data: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    version: string;
    services: { database: string };
    stats: { indexedManifests: number };
  };
}

export interface MatchResult {
  matches: Array<{
    manifestId: string;
    endpoint?: string;
    similarityScore?: number;
  }>;
}

export interface SearchResultItem {
  manifestTxId: string;
  manifestId: string | null;
  distance: number;
  contentType: string;
  ownerAddress: string;
  blockHeight?: number;
  blockTimestamp?: string;
  claimGenerator?: string;
  artifactKind?: string;
}

export interface SearchResult {
  success: boolean;
  data: {
    query: { phash: string; threshold: number; limit: number };
    results: SearchResultItem[];
    total: number;
  };
}

export interface AlgorithmInfo {
  watermarks: Array<{ alg: string }>;
  fingerprints: Array<{ alg: string }>;
}

export interface ManifestResponse {
  success: boolean;
  data: {
    manifestId: string;
    manifestTxId: string;
    contentType: string;
    ownerAddress: string;
    blockHeight?: number;
    blockTimestamp?: string;
    claimGenerator?: string;
    artifactKind?: string;
    assertions?: Record<string, unknown>[];
    ingredients?: Record<string, unknown>[];
  };
}

export interface ByBindingRequest {
  alg: string;
  value: string;
}

export interface ByReferenceRequest {
  url: string;
}

export type VerificationStatus = 'idle' | 'loading' | 'success' | 'error';
