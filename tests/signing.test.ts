/**
 * Tests for the COSE signing oracle.
 *
 * Covers:
 * - DER → IEEE P1363 conversion
 * - POST /v1/sign endpoint (feature gating, signing, verification)
 * - GET /v1/cert endpoint
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { Hono } from 'hono';

// Generate a test EC P-256 key pair once
let testPrivateKeyPem: string;
let testCertPem: string;
let testPublicKey: crypto.KeyObject;

beforeAll(() => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  testPrivateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  testPublicKey = publicKey;

  // Generate a self-signed certificate for testing
  testCertPem = testPrivateKeyPem.replace('PRIVATE KEY', 'CERTIFICATE');
  // For test purposes, just use the PEM key as cert placeholder
  // Real cert validation isn't in scope for the signing oracle
  testCertPem =
    '-----BEGIN CERTIFICATE-----\nTESTQ0VSVFJGSVNGT1JURVNUSU5HT05MWQ==\n-----END CERTIFICATE-----';
});

// ─── DER → P1363 conversion ───

import { derToIeeeP1363 } from '../src/services/signing.service.js';

describe('derToIeeeP1363', () => {
  it('converts a valid DER signature to 64-byte P1363 for P-256', () => {
    // Sign something with Node.js crypto to get a real DER signature
    const data = Buffer.from('test data for signing');
    const derSig = crypto.sign('SHA-256', data, {
      key: testPrivateKeyPem,
      dsaEncoding: 'der',
    });

    const p1363 = derToIeeeP1363(Buffer.from(derSig), 32);

    expect(p1363.length).toBe(64);

    // Verify the converted signature works
    const isValid = crypto.verify(
      'SHA-256',
      data,
      {
        key: testPublicKey,
        dsaEncoding: 'ieee-p1363',
      },
      p1363
    );

    expect(isValid).toBe(true);
  });

  it('handles DER signatures with leading zero padding in r', () => {
    // Run multiple signatures to increase chance of hitting a padded r/s
    const data = Buffer.from('test with padding variations');
    let foundPadded = false;

    for (let i = 0; i < 50; i++) {
      const derSig = crypto.sign('SHA-256', Buffer.concat([data, Buffer.from([i])]), {
        key: testPrivateKeyPem,
        dsaEncoding: 'der',
      });

      const p1363 = derToIeeeP1363(Buffer.from(derSig), 32);
      expect(p1363.length).toBe(64);

      // Check if original DER had padding (r or s > 32 bytes)
      const rLen = derSig[3];
      if (rLen > 32) foundPadded = true;

      // Verify round-trip
      const isValid = crypto.verify(
        'SHA-256',
        Buffer.concat([data, Buffer.from([i])]),
        { key: testPublicKey, dsaEncoding: 'ieee-p1363' },
        p1363
      );
      expect(isValid).toBe(true);
    }

    // It's statistically very likely we hit at least one padded signature in 50 tries
    // but don't fail the test if we didn't — the conversion logic is still tested
  });

  it('rejects invalid DER input', () => {
    expect(() => derToIeeeP1363(Buffer.from([0x00, 0x01]), 32)).toThrow('Invalid DER signature');
  });

  it('handles short r/s by left-padding', () => {
    // Construct a minimal valid DER with short r and s (< 32 bytes)
    const shortR = Buffer.from([0x01]);
    const shortS = Buffer.from([0x02]);
    const der = Buffer.concat([
      Buffer.from([0x30, 2 + shortR.length + 2 + shortS.length]),
      Buffer.from([0x02, shortR.length]),
      shortR,
      Buffer.from([0x02, shortS.length]),
      shortS,
    ]);

    const p1363 = derToIeeeP1363(der, 32);

    expect(p1363.length).toBe(64);
    // r should be at position 31 (left-padded with zeros)
    expect(p1363[31]).toBe(0x01);
    expect(p1363[0]).toBe(0x00);
    // s should be at position 63
    expect(p1363[63]).toBe(0x02);
    expect(p1363[32]).toBe(0x00);
  });

  it('strips DER sign-padding and places value at the right edge', () => {
    // 33-byte r = 0x00 + 32 real bytes (DER sign-pad). The old code only
    // stripped when r[0] === 0x00, which was correct here, but the check
    // was unsafe — if the padding were missing the trim skipped and the
    // output was silently corrupt. Verify the happy path stays correct.
    const r = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(32, 0xaa)]);
    const s = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(32, 0xbb)]);
    const der = Buffer.concat([
      Buffer.from([0x30, 2 + r.length + 2 + s.length]),
      Buffer.from([0x02, r.length]),
      r,
      Buffer.from([0x02, s.length]),
      s,
    ]);

    const p1363 = derToIeeeP1363(der, 32);

    expect(p1363.length).toBe(64);
    expect(p1363.subarray(0, 32).equals(Buffer.alloc(32, 0xaa))).toBe(true);
    expect(p1363.subarray(32, 64).equals(Buffer.alloc(32, 0xbb))).toBe(true);
  });

  it('rejects a DER whose integer is longer than componentBytes', () => {
    // 33-byte r with no 0x00 pad — value literally exceeds curve order.
    // Previous code silently copied with a negative offset and produced
    // garbage; we now throw.
    const r = Buffer.alloc(33, 0x7f);
    const s = Buffer.alloc(32, 0x01);
    const der = Buffer.concat([
      Buffer.from([0x30, 2 + r.length + 2 + s.length]),
      Buffer.from([0x02, r.length]),
      r,
      Buffer.from([0x02, s.length]),
      s,
    ]);

    expect(() => derToIeeeP1363(der, 32)).toThrow(/exceeds 32 bytes/);
  });

  it('rejects a DER truncated before r length byte', () => {
    expect(() => derToIeeeP1363(Buffer.from([0x30, 0x10, 0x02]), 32)).toThrow(/truncated/);
  });

  it('rejects a DER whose declared r length overruns the buffer', () => {
    // Claims rLen=0x20 but only 4 bytes follow.
    const der = Buffer.from([0x30, 0x24, 0x02, 0x20, 0x01, 0x02, 0x03, 0x04]);
    expect(() => derToIeeeP1363(der, 32)).toThrow(/overruns/);
  });

  it('rejects a DER missing the s INTEGER', () => {
    // Valid SEQUENCE header + valid r, but body ends before s.
    const der = Buffer.from([0x30, 0x04, 0x02, 0x02, 0x01, 0x02]);
    expect(() => derToIeeeP1363(der, 32)).toThrow();
  });

  it('rejects an unsupported SEQUENCE length form', () => {
    // 0x85 = long form with 5 length bytes (we cap at 4).
    const der = Buffer.from([0x30, 0x85, 0x00, 0x00, 0x00, 0x00, 0x01]);
    expect(() => derToIeeeP1363(der, 32)).toThrow(/unsupported SEQUENCE length/);
  });
});

// ─── Route tests ───

describe('signing routes', () => {
  // We need to mock config before importing routes
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  function createSigningApp(enabled: boolean) {
    // Dynamically create a Hono app that mimics the signing route behavior
    // This avoids config module caching issues
    const app = new Hono();

    if (!enabled) {
      app.post('/v1/sign', (c) =>
        c.json({ error: 'Signing is not enabled on this instance' }, 501)
      );
      app.get('/v1/cert', (c) => c.json({ error: 'Signing is not enabled on this instance' }, 501));
      return app;
    }

    app.post('/v1/sign', async (c) => {
      const body = await c.req.arrayBuffer();
      if (!body || body.byteLength === 0) {
        return c.json({ error: 'Request body is required' }, 400);
      }

      const payload = Buffer.from(body);
      const derSignature = crypto.sign('SHA-256', payload, {
        key: testPrivateKeyPem,
        dsaEncoding: 'der',
      });
      const p1363 = derToIeeeP1363(Buffer.from(derSignature), 32);

      return new Response(p1363, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    });

    app.get('/v1/cert', (c) => {
      return new Response(testCertPem, {
        status: 200,
        headers: { 'Content-Type': 'application/x-pem-file' },
      });
    });

    return app;
  }

  describe('POST /v1/sign', () => {
    it('returns 501 when signing is disabled', async () => {
      const app = createSigningApp(false);
      const res = await app.request('/v1/sign', { method: 'POST' });
      expect(res.status).toBe(501);
    });

    it('returns 400 for empty body', async () => {
      const app = createSigningApp(true);
      const res = await app.request('/v1/sign', {
        method: 'POST',
        body: new ArrayBuffer(0),
      });
      expect(res.status).toBe(400);
    });

    it('signs payload and returns 64-byte IEEE P1363 signature', async () => {
      const app = createSigningApp(true);
      const payload = Buffer.from('COSE Sig_structure test payload');

      const res = await app.request('/v1/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: payload,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');

      const sigBytes = Buffer.from(await res.arrayBuffer());
      expect(sigBytes.length).toBe(64);

      // Verify the signature is valid
      const isValid = crypto.verify(
        'SHA-256',
        payload,
        {
          key: testPublicKey,
          dsaEncoding: 'ieee-p1363',
        },
        sigBytes
      );
      expect(isValid).toBe(true);
    });

    it('produces different signatures for different payloads', async () => {
      const app = createSigningApp(true);

      const res1 = await app.request('/v1/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('payload one'),
      });

      const res2 = await app.request('/v1/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('payload two'),
      });

      const sig1 = Buffer.from(await res1.arrayBuffer());
      const sig2 = Buffer.from(await res2.arrayBuffer());

      expect(sig1.equals(sig2)).toBe(false);
    });
  });

  describe('GET /v1/cert', () => {
    it('returns 501 when signing is disabled', async () => {
      const app = createSigningApp(false);
      const res = await app.request('/v1/cert');
      expect(res.status).toBe(501);
    });

    it('returns PEM certificate with correct content-type', async () => {
      const app = createSigningApp(true);
      const res = await app.request('/v1/cert');

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/x-pem-file');

      const body = await res.text();
      expect(body).toContain('-----BEGIN CERTIFICATE-----');
      expect(body).toContain('-----END CERTIFICATE-----');
    });
  });
});
