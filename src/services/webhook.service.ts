/**
 * Webhook service for processing gateway notifications.
 *
 * Handles incoming webhooks from the AR.IO gateway when
 * manifest sidecar transactions are indexed.
 */

import { logger } from '../utils/logger.js';
import { insertManifestArtifactWithBindingsIfAbsent } from '../db/index.js';
import { parsePHash, binaryStringToFloatArray } from '../utils/bit-vector.js';
import { config } from '../config.js';
import {
  PROTOCOL_NAME,
  TAG_PROTOCOL,
  TAG_STORAGE_MODE,
  TAG_MANIFEST_ID,
  TAG_MANIFEST_STORE_HASH,
  TAG_MANIFEST_REPO_URL,
  TAG_MANIFEST_FETCH_URL,
  TAG_ASSET_CONTENT_TYPE,
  TAG_SOFT_BINDING_ALG,
  TAG_SOFT_BINDING_VALUE,
  TAG_CLAIM_GENERATOR,
  ALG_PHASH,
} from '../protocol/index.js';

/**
 * Webhook payload tag
 */
interface WebhookTag {
  name: string;
  value: string;
}

/**
 * Check if a string is base64url-encoded (no +, /, = characters).
 * The ar-io gateway sends tag names/values as base64url in webhook payloads.
 */
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Decode tags from the gateway's native format.
 * The gateway sends tag names and values as base64url-encoded strings.
 * We detect this by checking if any tag name matches a known plain-text
 * name — if not, we assume they're base64url-encoded and decode them.
 */
function decodeTags(tags: WebhookTag[]): WebhookTag[] {
  if (tags.length === 0) return tags;

  // Check if tags are already plain UTF-8 by looking for a known tag name
  const knownNames = ['Content-Type', 'Protocol', TAG_PROTOCOL, TAG_STORAGE_MODE, TAG_MANIFEST_ID];
  const alreadyPlain = tags.some((t) => knownNames.includes(t.name));
  if (alreadyPlain) return tags;

  // Check if the first tag name looks like base64url
  if (!BASE64URL_RE.test(tags[0].name)) return tags;

  // Decode base64url → UTF-8
  try {
    return tags.map((t) => ({
      name: Buffer.from(t.name, 'base64url').toString('utf-8'),
      value: Buffer.from(t.value, 'base64url').toString('utf-8'),
    }));
  } catch {
    // If decoding fails, return original tags
    return tags;
  }
}

/**
 * Webhook payload from gateway
 */
export interface WebhookPayload {
  /** Transaction ID */
  tx_id?: string;
  id?: string;
  /** Tags array */
  tags?: WebhookTag[];
  /** Owner address */
  owner?: string;
  owner_address?: string;
  /** Block height */
  block_height?: number;
  height?: number;
  /** Block timestamp */
  block_timestamp?: number;
  timestamp?: number;
}

/**
 * Result of processing a webhook
 */
export interface WebhookResult {
  success: boolean;
  action: 'indexed' | 'skipped' | 'error';
  txId?: string;
  reason?: string;
}

/**
 * Extract a tag value from the tags array (case-insensitive).
 */
function getTagValue(tags: WebhookTag[], name: string): string | undefined {
  const lower = name.toLowerCase();
  return tags.find((t) => t.name.toLowerCase() === lower)?.value;
}

/**
 * Validate a URL that arrived via an untrusted Arweave tag.
 *
 * The gateway indexes every tx matching the protocol filter, so fetch/repo
 * URLs can be attacker-controlled. A /v1/manifests/:id request later
 * redirects to this URL, so a `javascript:` or `data:` scheme here would
 * let an attacker XSS anyone who follows the redirect.
 *
 * Rule: keep only http/https URLs whose hostname isn't localhost or a
 * literal private IP. DNS-level rebinding is caught later at fetch time
 * (for proof-locators) and is irrelevant for pure redirects.
 */
function isSafeManifestUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  // Node preserves `[...]` around IPv6 literals in `.hostname`; strip them
  // so the prefix checks below actually match.
  let host = url.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  if (!host) return false;
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return false;
  }
  // Block literal private IPv4 addresses at ingest time.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b] = v4.map((x) => Number(x));
    if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168)) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
  }
  // Any IPv6 literal in host form uses brackets in URL — hostname strips them.
  // Reject obvious private/multicast IPv6 prefixes; full validation lives in
  // remote-fetch.service.ts when we actually dial out.
  if (host.includes(':')) {
    const lower = host;
    if (lower === '::' || lower === '::1') return false;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return false;
    if (
      lower.startsWith('fe80') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    )
      return false;
    if (lower.startsWith('ff')) return false;
  }
  return true;
}

function sanitizeManifestUrl(
  raw: string | undefined | null,
  txId: string,
  field: string
): string | null {
  if (!raw) return null;
  if (isSafeManifestUrl(raw)) return raw;
  logger.warn(
    { txId, field, value: raw.slice(0, 200) },
    'Rejecting unsafe manifest URL from webhook'
  );
  return null;
}

/**
 * Process a webhook payload from the gateway.
 *
 * Required tags (Protocol: C2PA-Manifest-Proof schema):
 * - Protocol=C2PA-Manifest-Proof
 * - C2PA-Storage-Mode=full|manifest|proof
 * - C2PA-Manifest-ID (URN)
 * - C2PA-Soft-Binding-Alg + C2PA-Soft-Binding-Value
 *
 * For proof mode, also required:
 * - C2PA-Manifest-Fetch-URL
 * - C2PA-Manifest-Store-Hash (base64url SHA-256, used for digest verification)
 */
export async function processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  const txId = payload.tx_id || payload.id;
  const tags = decodeTags(payload.tags || []);
  const owner = payload.owner || payload.owner_address;
  const blockHeight = payload.block_height ?? payload.height;
  const blockTimestamp = payload.block_timestamp ?? payload.timestamp;

  if (!txId) {
    return {
      success: false,
      action: 'error',
      reason: 'Missing transaction ID in payload',
    };
  }

  logger.info({ txId, tagCount: tags.length }, 'Processing webhook');

  try {
    // Extract tags
    const protocolTag = getTagValue(tags, TAG_PROTOCOL);
    const storageModeTag = getTagValue(tags, TAG_STORAGE_MODE);
    const manifestIdTag = getTagValue(tags, TAG_MANIFEST_ID);
    const manifestStoreHash = getTagValue(tags, TAG_MANIFEST_STORE_HASH);
    const repoUrl = getTagValue(tags, TAG_MANIFEST_REPO_URL);
    const fetchUrl = getTagValue(tags, TAG_MANIFEST_FETCH_URL);
    const assetContentType = getTagValue(tags, TAG_ASSET_CONTENT_TYPE);
    const contentTypeTag = getTagValue(tags, 'Content-Type');
    const claimGenerator = getTagValue(tags, TAG_CLAIM_GENERATOR);
    const softBindingAlg = getTagValue(tags, TAG_SOFT_BINDING_ALG);
    const softBindingValue = getTagValue(tags, TAG_SOFT_BINDING_VALUE);

    // Require Protocol tag
    if (protocolTag !== PROTOCOL_NAME) {
      logger.debug({ txId, protocolTag }, 'Not a C2PA-Manifest-Proof transaction, skipping');
      return { success: true, action: 'skipped', txId, reason: 'Missing Protocol tag' };
    }

    if (!manifestIdTag) {
      logger.debug({ txId }, 'Missing C2PA-Manifest-ID tag, skipping');
      return { success: true, action: 'skipped', txId, reason: 'Missing required tags' };
    }

    if (!storageModeTag) {
      logger.debug({ txId }, 'Missing C2PA-Storage-Mode tag, skipping');
      return { success: true, action: 'skipped', txId, reason: 'Missing required tags' };
    }

    // Resolve artifact kind from storage mode
    const mode = storageModeTag.trim().toLowerCase();
    const artifactKind: 'manifest-store' | 'proof-locator' | null =
      mode === 'full' || mode === 'manifest'
        ? 'manifest-store'
        : mode === 'proof'
          ? 'proof-locator'
          : null;

    if (!artifactKind) {
      logger.debug({ txId, storageModeTag }, 'Unsupported storage mode, skipping');
      return { success: true, action: 'skipped', txId, reason: 'Unsupported storage mode' };
    }

    if (artifactKind === 'proof-locator' && !config.ENABLE_PROOF_LOCATOR_ARTIFACTS) {
      logger.debug({ txId }, 'Proof-locator artifact indexing disabled');
      return {
        success: true,
        action: 'skipped',
        txId,
        reason: 'Proof-locator artifacts are disabled',
      };
    }

    // Proof-locator requires fetch URL + store hash for digest verification
    if (artifactKind === 'proof-locator' && (!fetchUrl || !manifestStoreHash)) {
      logger.debug({ txId, fetchUrl, manifestStoreHash }, 'Missing required proof-locator tags');
      return {
        success: true,
        action: 'skipped',
        txId,
        reason: 'Missing required proof-locator tags',
      };
    }

    // Require soft binding
    if (!softBindingAlg || !softBindingValue) {
      logger.debug({ txId }, 'Missing soft binding tags, skipping');
      return { success: true, action: 'skipped', txId, reason: 'Missing soft binding tags' };
    }

    if (softBindingAlg !== ALG_PHASH) {
      logger.debug({ txId, softBindingAlg }, 'Unsupported soft binding algorithm');
      return {
        success: true,
        action: 'skipped',
        txId,
        reason: 'Unsupported soft binding algorithm',
      };
    }

    // Derive pHash from soft binding value (base64-encoded 8-byte hash).
    // Reject anything that doesn't decode to exactly 8 bytes so garbage tags
    // can't poison the index with arbitrary floats or trigger later errors.
    let phashFloats: number[] | null = null;
    try {
      const decoded = Buffer.from(softBindingValue, 'base64');
      if (decoded.length !== 8) {
        throw new Error(`Expected 8-byte pHash, got ${decoded.length} bytes`);
      }
      const pHashHex = decoded.toString('hex');
      const binary = parsePHash(pHashHex);
      phashFloats = binaryStringToFloatArray(binary);
    } catch (error) {
      logger.warn({ txId, softBindingValue, error }, 'Invalid pHash in soft binding value');
      return {
        success: false,
        action: 'error',
        txId,
        reason: `Invalid pHash in soft binding value`,
      };
    }

    const contentType = assetContentType || contentTypeTag || 'application/c2pa';

    // Strip any fetch/repo URLs that would produce an unsafe redirect at
    // /v1/manifests/:id. Keep the manifest record otherwise — the caller can
    // still resolve via the fallback manifest-store path by tx id.
    const safeFetchUrl = sanitizeManifestUrl(fetchUrl, txId, 'fetchUrl');
    const safeRepoUrl = sanitizeManifestUrl(repoUrl, txId, 'repoUrl');

    // Proof-locator transactions whose fetchUrl didn't survive validation
    // cannot be resolved safely — skip the whole record.
    if (artifactKind === 'proof-locator' && !safeFetchUrl) {
      logger.warn({ txId, fetchUrl }, 'Proof-locator fetchUrl rejected by URL policy');
      return {
        success: true,
        action: 'skipped',
        txId,
        reason: 'Unsafe proof-locator fetchUrl',
      };
    }

    const inserted = await insertManifestArtifactWithBindingsIfAbsent(
      {
        manifestTxId: txId,
        manifestId: manifestIdTag,
        artifactKind,
        remoteManifestUrl: safeFetchUrl,
        manifestDigestAlg: manifestStoreHash ? 'SHA-256' : null,
        manifestDigestB64: manifestStoreHash || null,
        repoUrl: safeRepoUrl,
        fetchUrl: safeFetchUrl,
        originalHash: null,
        contentType,
        phash: phashFloats,
        hasPriorManifest: false,
        claimGenerator: claimGenerator || 'unknown',
        ownerAddress: owner || 'unknown',
        blockHeight,
        blockTimestamp: blockTimestamp ? new Date(blockTimestamp * 1000) : undefined,
      },
      [{ alg: softBindingAlg, valueB64: softBindingValue, scopeJson: null }]
    );

    if (!inserted) {
      logger.debug({ txId, manifestId: manifestIdTag }, 'Manifest already indexed, skipping');
      return { success: true, action: 'skipped', txId, reason: 'Already indexed' };
    }

    logger.info({ txId, artifactKind, owner, blockHeight }, 'Manifest indexed from webhook');

    return { success: true, action: 'indexed', txId };
  } catch (error) {
    logger.error({ error, txId }, 'Failed to process webhook');
    return { success: false, action: 'error', txId, reason: (error as Error).message };
  }
}

/**
 * Process multiple webhooks in batch.
 */
export async function processWebhookBatch(payloads: WebhookPayload[]): Promise<WebhookResult[]> {
  logger.info({ count: payloads.length }, 'Processing webhook batch');

  const results: WebhookResult[] = [];

  for (const payload of payloads) {
    const result = await processWebhook(payload);
    results.push(result);
  }

  const indexed = results.filter((r) => r.action === 'indexed').length;
  const skipped = results.filter((r) => r.action === 'skipped').length;
  const errors = results.filter((r) => r.action === 'error').length;

  logger.info({ total: payloads.length, indexed, skipped, errors }, 'Webhook batch complete');

  return results;
}
