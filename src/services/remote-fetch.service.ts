import { isIP } from 'node:net';
import dns from 'node:dns/promises';
import { config } from '../config.js';
import { fetchWithTimeout } from '../utils/http.js';
import { readStreamWithLimit, SizeLimitError } from '../utils/stream.js';

export class RemoteFetchError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'RemoteFetchError';
    this.statusCode = statusCode;
  }
}

function isLocalHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local')
  );
}

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split('.').map((value) => Number(value));
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false;
  }

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

/**
 * Expand an IPv6 address (compressed or not) to eight 16-bit groups as
 * numbers. Returns null if the input isn't a valid IPv6 literal. This is
 * good enough for range classification and avoids pulling in ipaddr.js.
 */
function expandIpv6(ip: string): number[] | null {
  let addr = ip.trim().toLowerCase();
  if (addr.startsWith('[') && addr.endsWith(']')) {
    addr = addr.slice(1, -1);
  }
  // Strip zone id (fe80::1%eth0)
  const zoneIdx = addr.indexOf('%');
  if (zoneIdx !== -1) {
    addr = addr.slice(0, zoneIdx);
  }

  // Handle IPv4-mapped suffix (::ffff:1.2.3.4) by converting to two groups.
  const v4Match = addr.match(/(.*:)([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$/);
  if (v4Match) {
    const head = v4Match[1];
    const v4 = v4Match[2].split('.').map(Number);
    if (v4.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    addr = `${head}${hi}:${lo}`;
  }

  const doubleColonParts = addr.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseGroups = (s: string): number[] | null => {
    if (s === '') return [];
    const parts = s.split(':');
    const groups: number[] = [];
    for (const p of parts) {
      if (p.length === 0 || p.length > 4) return null;
      if (!/^[0-9a-f]+$/.test(p)) return null;
      groups.push(parseInt(p, 16));
    }
    return groups;
  };

  let groups: number[];
  if (doubleColonParts.length === 2) {
    const head = parseGroups(doubleColonParts[0]);
    const tail = parseGroups(doubleColonParts[1]);
    if (!head || !tail) return null;
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...new Array(missing).fill(0), ...tail];
  } else {
    const parsed = parseGroups(doubleColonParts[0]);
    if (!parsed) return null;
    groups = parsed;
  }
  return groups.length === 8 ? groups : null;
}

function isPrivateIpv6(ip: string): boolean {
  const groups = expandIpv6(ip);
  if (!groups) return false;

  // ::0 unspecified
  if (groups.every((g) => g === 0)) return true;
  // ::1 loopback
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;

  const first = groups[0];
  // Unique local fc00::/7 → first 7 bits are 1111110
  if ((first & 0xfe00) === 0xfc00) return true;
  // Link-local fe80::/10 → first 10 bits are 1111111010
  if ((first & 0xffc0) === 0xfe80) return true;
  // Multicast ff00::/8
  if ((first & 0xff00) === 0xff00) return true;
  // IPv4-mapped ::ffff:0:0/96 — classify via embedded v4 if the mapped
  // address is itself private.
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  ) {
    const a = (groups[6] >> 8) & 0xff;
    const b = groups[6] & 0xff;
    const ipv4 = `${a}.${b}.${(groups[7] >> 8) & 0xff}.${groups[7] & 0xff}`;
    if (isPrivateIpv4(ipv4)) return true;
  }
  return false;
}

/**
 * Node's URL keeps `[...]` around IPv6 literals in `.hostname`, which makes
 * `isIP()` return 0. Strip the brackets so range checks actually run.
 */
function unwrapHostname(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function assertRemoteUrlAllowed(url: URL, allowInsecure: boolean): void {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RemoteFetchError(400, 'referenceUrl must use http or https');
  }

  if (!allowInsecure && url.protocol !== 'https:') {
    throw new RemoteFetchError(400, 'Only https reference URLs are allowed');
  }

  if (isLocalHostname(url.hostname)) {
    throw new RemoteFetchError(400, 'Local or private reference hosts are not allowed');
  }

  const host = unwrapHostname(url.hostname);
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) {
    throw new RemoteFetchError(400, 'Private IPv4 reference hosts are not allowed');
  }
  if (ipVersion === 6 && isPrivateIpv6(host)) {
    throw new RemoteFetchError(400, 'Private IPv6 reference hosts are not allowed');
  }
}

export function parseAndValidateRemoteUrl(
  rawUrl: string,
  options: { allowInsecure?: boolean } = {}
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RemoteFetchError(400, 'Invalid referenceUrl');
  }

  assertRemoteUrlAllowed(parsed, options.allowInsecure ?? config.ALLOW_INSECURE_REFERENCE_URL);
  return parsed;
}

/**
 * Resolve DNS and validate the resolved IP is not private.
 * Returns the resolved IP to pin the connection and prevent DNS rebinding.
 */
async function resolveAndValidateIp(hostname: string): Promise<string | null> {
  const unwrapped = unwrapHostname(hostname);
  const ipVersion = isIP(unwrapped);
  if (ipVersion !== 0) {
    // Already an IP address — validate directly
    if (ipVersion === 4 && isPrivateIpv4(unwrapped)) {
      throw new RemoteFetchError(400, 'Private IPv4 reference hosts are not allowed');
    }
    if (ipVersion === 6 && isPrivateIpv6(unwrapped)) {
      throw new RemoteFetchError(400, 'Private IPv6 reference hosts are not allowed');
    }
    return null; // Already an IP, no DNS pinning needed
  }

  let addresses: string[] = [];
  try {
    addresses = await dns.resolve4(unwrapped);
  } catch {
    try {
      addresses = await dns.resolve6(unwrapped);
    } catch {
      // DNS resolution failed — fall through without pinning.
      // The hostname-based validation still blocks local/private hostnames.
      return null;
    }
  }

  if (addresses.length === 0) {
    return null; // No addresses resolved, fall through
  }

  const resolvedIp = addresses[0];
  const resolvedIpVersion = isIP(resolvedIp);
  if (resolvedIpVersion === 4 && isPrivateIpv4(resolvedIp)) {
    throw new RemoteFetchError(400, 'Resolved IP is a private IPv4 address');
  }
  if (resolvedIpVersion === 6 && isPrivateIpv6(resolvedIp)) {
    throw new RemoteFetchError(400, 'Resolved IP is a private IPv6 address');
  }

  return resolvedIp;
}

const MAX_REDIRECTS = 5;

async function dispatchSingleRequest(
  url: URL,
  timeoutMs: number,
  headers: Record<string, string>
): Promise<Response> {
  // Resolve DNS once and validate the resolved IP to prevent DNS rebinding
  const resolvedIp = await resolveAndValidateIp(url.hostname);

  // Pin the fetch to the resolved IP, preserving the original Host header.
  // For HTTPS, we skip the hostname replacement because replacing the hostname
  // with a raw IP breaks TLS/SNI — the server needs the original hostname for
  // certificate matching. The DNS-rebinding protection still works because we
  // validated the resolved IP above.
  const fetchUrl = new URL(url.toString());
  const fetchHeaders: Record<string, string> = { ...headers };
  if (resolvedIp && url.protocol === 'http:') {
    fetchHeaders['Host'] = url.hostname;
    fetchUrl.hostname = resolvedIp;
  }

  return fetchWithTimeout(fetchUrl.toString(), timeoutMs, {
    headers: fetchHeaders,
    redirect: 'manual',
  });
}

export async function fetchRemoteBytes(
  rawUrl: string,
  options: {
    timeoutMs?: number;
    maxBytes: number;
    allowInsecure?: boolean;
    headers?: Record<string, string>;
  }
): Promise<{ buffer: Buffer; contentType: string }> {
  const allowInsecure = options.allowInsecure ?? config.ALLOW_INSECURE_REFERENCE_URL;
  const timeoutMs = options.timeoutMs ?? config.REFERENCE_FETCH_TIMEOUT_MS;
  const headers = options.headers ?? {};

  // Follow redirects manually so each hop is re-validated against the same
  // scheme/host/private-IP policy. Using fetch's redirect:'follow' would
  // allow an attacker-controlled public URL to 302 to http://192.168.x.x/.
  let currentUrl = parseAndValidateRemoteUrl(rawUrl, { allowInsecure });
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      response = await dispatchSingleRequest(currentUrl, timeoutMs, headers);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new RemoteFetchError(504, 'Remote fetch timed out');
      }
      if (error instanceof RemoteFetchError) throw error;
      throw new RemoteFetchError(502, `Remote fetch failed: ${(error as Error).message}`);
    }

    const status = response.status;
    if (status >= 300 && status < 400 && status !== 304) {
      const location = response.headers.get('location');
      if (!location) {
        throw new RemoteFetchError(502, 'Redirect response missing Location header');
      }
      if (hop === MAX_REDIRECTS) {
        throw new RemoteFetchError(502, 'Too many redirects');
      }
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        throw new RemoteFetchError(502, 'Invalid redirect Location');
      }
      currentUrl = parseAndValidateRemoteUrl(nextUrl.toString(), { allowInsecure });
      continue;
    }

    break;
  }

  if (!response) {
    throw new RemoteFetchError(502, 'Remote fetch produced no response');
  }

  if (!response.ok) {
    throw new RemoteFetchError(502, `Remote fetch failed with status ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > options.maxBytes) {
      throw new RemoteFetchError(413, 'Remote content exceeds configured size limit');
    }
  }

  let buffer: Buffer;
  try {
    buffer = await readStreamWithLimit(response.body, options.maxBytes);
  } catch (error) {
    if (error instanceof SizeLimitError) {
      throw new RemoteFetchError(413, 'Remote content exceeds configured size limit');
    }
    throw error;
  }

  return {
    buffer,
    contentType:
      response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream',
  };
}
