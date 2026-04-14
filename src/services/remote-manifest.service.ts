import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { fetchRemoteBytes, RemoteFetchError } from './remote-fetch.service.js';

export type RemoteManifestResolution = 'proof-remote-fetch' | 'proof-remote-cache';

type CachedRemoteManifest = {
  buffer: Buffer;
  expiresAt: number;
};

// Map insertion order doubles as the LRU queue: on hit we delete+reinsert to
// move the entry to the tail; eviction pops from the head.
const remoteManifestCache = new Map<string, CachedRemoteManifest>();
let cachedBytes = 0;

export class RemoteManifestResolutionError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'RemoteManifestResolutionError';
    this.statusCode = statusCode;
  }
}

function normalizeDigestAlgorithm(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'sha256' || normalized === 'sha-256' || normalized === 'sha2-256') {
    return 'sha256';
  }
  if (normalized === 'sha384' || normalized === 'sha-384' || normalized === 'sha2-384') {
    return 'sha384';
  }
  if (normalized === 'sha512' || normalized === 'sha-512' || normalized === 'sha2-512') {
    return 'sha512';
  }
  throw new RemoteManifestResolutionError(502, `Unsupported digest algorithm: ${value}`);
}

function normalizeBase64(value: string): string {
  const trimmed = value.trim();
  const withStandardAlphabet = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padding = withStandardAlphabet.length % 4;
  if (padding === 0) {
    return withStandardAlphabet;
  }
  return `${withStandardAlphabet}${'='.repeat(4 - padding)}`;
}

function decodeDigest(value: string): Buffer {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  const normalized = normalizeBase64(trimmed);
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === 0) {
    throw new RemoteManifestResolutionError(502, 'Invalid manifest digest value');
  }
  return decoded;
}

function verifyDigest(buffer: Buffer, digestAlg: string, digestB64: string): void {
  const expected = decodeDigest(digestB64);
  const normalizedAlg = normalizeDigestAlgorithm(digestAlg);
  const actual = createHash(normalizedAlg).update(buffer).digest();

  if (!actual.equals(expected)) {
    throw new RemoteManifestResolutionError(502, 'Remote manifest digest verification failed');
  }
}

/**
 * Hash the composite cache key so a `|` inside the manifestId or URL can't
 * collide with a different request (e.g. `"foo|bar"` + `"baz"` vs. `"foo"` +
 * `"bar|baz"`).
 */
function buildCacheKey(options: {
  manifestId: string;
  remoteManifestUrl: string;
  manifestDigestAlg: string;
  manifestDigestB64: string;
}): string {
  const payload = JSON.stringify([
    options.manifestId,
    options.remoteManifestUrl,
    options.manifestDigestAlg.toLowerCase(),
    options.manifestDigestB64,
  ]);
  return createHash('sha256').update(payload).digest('hex');
}

function deleteCacheEntry(key: string): void {
  const entry = remoteManifestCache.get(key);
  if (!entry) return;
  cachedBytes -= entry.buffer.length;
  remoteManifestCache.delete(key);
}

function pruneExpiredCacheEntries(now: number): void {
  for (const [key, entry] of remoteManifestCache.entries()) {
    if (entry.expiresAt <= now) {
      deleteCacheEntry(key);
    }
  }
}

function evictLruUntilWithinLimits(): void {
  const maxEntries = config.REMOTE_MANIFEST_CACHE_MAX_ENTRIES;
  const maxBytes = config.REMOTE_MANIFEST_CACHE_MAX_BYTES;
  while (remoteManifestCache.size > maxEntries || cachedBytes > maxBytes) {
    const oldestKey = remoteManifestCache.keys().next().value;
    if (!oldestKey) break;
    deleteCacheEntry(oldestKey);
  }
}

function getCachedManifest(cacheKey: string): Buffer | null {
  const now = Date.now();
  pruneExpiredCacheEntries(now);
  const cached = remoteManifestCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  // promote to MRU by re-inserting (Map preserves insertion order)
  remoteManifestCache.delete(cacheKey);
  remoteManifestCache.set(cacheKey, cached);

  return cached.buffer;
}

function setCachedManifest(cacheKey: string, buffer: Buffer): void {
  const now = Date.now();
  pruneExpiredCacheEntries(now);

  // Replace any prior entry under this key so the byte counter stays accurate.
  deleteCacheEntry(cacheKey);

  remoteManifestCache.set(cacheKey, {
    buffer,
    expiresAt: now + config.REMOTE_MANIFEST_CACHE_TTL_MS,
  });
  cachedBytes += buffer.length;

  evictLruUntilWithinLimits();
}

export async function fetchRemoteManifestWithCache(options: {
  manifestId: string;
  remoteManifestUrl: string;
  manifestDigestAlg: string;
  manifestDigestB64: string;
}): Promise<{ buffer: Buffer; resolutionPath: RemoteManifestResolution; cacheHit: boolean }> {
  const cacheKey = buildCacheKey(options);

  const cached = getCachedManifest(cacheKey);
  if (cached) {
    logger.debug(
      { manifestId: options.manifestId, remoteManifestUrl: options.remoteManifestUrl },
      'Using cached remote manifest bytes'
    );
    return {
      buffer: cached,
      resolutionPath: 'proof-remote-cache',
      cacheHit: true,
    };
  }

  let fetched: { buffer: Buffer; contentType: string };
  try {
    fetched = await fetchRemoteBytes(options.remoteManifestUrl, {
      maxBytes: config.REMOTE_MANIFEST_MAX_BYTES,
      timeoutMs: config.REFERENCE_FETCH_TIMEOUT_MS,
      allowInsecure: config.ALLOW_INSECURE_REFERENCE_URL,
      headers: {
        Accept: 'application/c2pa, application/octet-stream;q=0.8',
      },
    });
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      if (error.statusCode === 413) {
        throw new RemoteManifestResolutionError(
          502,
          'Remote manifest exceeds configured size limit'
        );
      }
      throw new RemoteManifestResolutionError(error.statusCode, error.message);
    }
    throw error;
  }

  if (fetched.buffer.length === 0) {
    throw new RemoteManifestResolutionError(502, 'Remote manifest response was empty');
  }

  verifyDigest(fetched.buffer, options.manifestDigestAlg, options.manifestDigestB64);
  setCachedManifest(cacheKey, fetched.buffer);

  logger.info(
    {
      manifestId: options.manifestId,
      remoteManifestUrl: options.remoteManifestUrl,
      digestAlg: options.manifestDigestAlg,
      cacheHit: false,
    },
    'Fetched and verified remote manifest bytes'
  );

  return {
    buffer: fetched.buffer,
    resolutionPath: 'proof-remote-fetch',
    cacheHit: false,
  };
}

export function clearRemoteManifestCache(): void {
  remoteManifestCache.clear();
  cachedBytes = 0;
}
