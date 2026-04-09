# AR.IO C2PA Sidecar

C2PA content provenance service for [AR.IO](https://ar.io) Arweave gateways. Indexes C2PA Content Credentials from gateway webhooks, provides perceptual hash similarity search, soft binding resolution, and an optional COSE signing oracle.

Used with the [`@ar-io/turbo-c2pa`](https://github.com/ar-io/ar-io-node-project/tree/main/packages/turbo-c2pa) client SDK for signing images with C2PA and uploading to Arweave.

**[API Docs (Swagger UI)](https://your-gateway.com/api-docs/)** · **[ar.io Provenance](https://ar.io/provenance/)** · **[C2PA Spec](https://c2pa.org)**

## Features

- **Manifest Repository** — stores and resolves C2PA manifest-store and proof-locator artifacts indexed from Arweave
- **Soft Binding Resolution (SBR)** — C2PA 2.3 SBR API (byBinding, byContent, byReference)
- **Similarity Search** — 64-bit pHash nearest-neighbor search via DuckDB Hamming distance
- **COSE Signing Oracle** — feature-gated ECDSA signing for C2PA manifest creation (ES256/ES384)
- **Identity Assertions** — CAWG identity signing with Ethereum wallet verification
- **API Documentation** — OpenAPI 3.0 spec served via Swagger UI at `/api-docs/`
- **Verify Web App** — React frontend for searching and verifying C2PA credentials (`web/`)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An AR.IO gateway running on the same Docker network (`ar-io-network`)

### 1. Start the sidecar

```bash
docker run -d \
  --name ar-io-c2pa \
  --network ar-io-network \
  -p 3003:3003 \
  --restart unless-stopped \
  -v ./data:/app/data \
  -e GATEWAY_URL=http://core:4000 \
  ghcr.io/ar-io/ar-io-c2pa:latest
```

Or build from source:

```bash
docker build -t ar-io-c2pa:local .
docker run -d \
  --name ar-io-c2pa \
  --network ar-io-network \
  -p 3003:3003 \
  --restart unless-stopped \
  -v ./data:/app/data \
  -e GATEWAY_URL=http://core:4000 \
  ar-io-c2pa:local
```

### 2. Configure gateway webhooks

Add the sidecar to your gateway's webhook targets in your AR.IO gateway `.env`:

```bash
# Add to existing WEBHOOK_TARGET_SERVERS (comma-separated)
WEBHOOK_TARGET_SERVERS=http://ar-io-c2pa:3003/webhook

# Or append to existing targets:
WEBHOOK_TARGET_SERVERS=http://content-scanner:3100/scan,http://ar-io-c2pa:3003/webhook
```

Then restart the gateway core:

```bash
docker compose restart core
```

The sidecar filters for `Protocol: C2PA-Manifest-Proof` tags and indexes matching transactions automatically.

### 3. Verify

```bash
# Health check
curl http://localhost:3003/health

# API docs
open http://localhost:3003/api-docs/
```

### 4. Seed test data (optional)

To populate the sidecar with real C2PA test transactions for development:

```bash
./scripts/seed-test-data.sh http://localhost:3003
```

This indexes 24 real Arweave C2PA transactions across 3 different images. See [scripts/seed-test-data.sh](scripts/seed-test-data.sh) for the transaction IDs.

## Example Searches

After seeding test data, try these:

| Type | Query | Expected |
|------|-------|----------|
| **pHash** | `e8f0fcc0f0f0f0f0` | 14 exact matches |
| **pHash** | `1f0e7b0900ff1f0e` | 4 exact + similar |
| **Manifest ID** | `urn:c2pa:fa008c04-cbee-43c2-846c-2a3d3c487219` | Single manifest detail |
| **Manifest ID** | `urn:c2pa:4f6066e2-6bb0-482b-a589-024a826d803a` | Single manifest detail |
| **Transaction** | `Dw77ya7CVKVT7ffqYl_td4UQUauAN1YitCXRYlp7lNA` | Viewable on any AR.IO gateway |

```bash
# Similarity search
curl "http://localhost:3003/v1/search-similar?phash=e8f0fcc0f0f0f0f0&threshold=10&limit=50"

# Soft binding lookup
curl -X POST http://localhost:3003/v1/matches/byBinding \
  -H "Content-Type: application/json" \
  -d '{"alg":"org.ar-io.phash","value":"6PD8wPDw8PA="}'

# Supported algorithms
curl http://localhost:3003/v1/services/supportedAlgorithms
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with database status and manifest count |
| `/api-docs/` | GET | Swagger UI — interactive API documentation |
| `/api-docs/openapi.yaml` | GET | OpenAPI 3.0 spec (YAML) |
| `/v1/search-similar` | GET | pHash similarity search |
| `/v1/matches/byBinding` | GET/POST | Resolve by exact soft binding value |
| `/v1/matches/byContent` | POST | Upload image → compute pHash → find matches |
| `/v1/matches/byReference` | POST | Fetch remote URL → compute pHash → find matches |
| `/v1/manifests/{manifestId}` | GET | Manifest retrieval (redirect-first with fallback) |
| `/v1/services/supportedAlgorithms` | GET | List supported binding algorithms |
| `/v1/sign` | POST | COSE signing oracle (feature-gated) |
| `/v1/cert` | GET | X.509 certificate chain (feature-gated) |
| `/v1/identity/sign` | POST | CAWG identity assertion signing (feature-gated) |
| `/webhook` | POST | Gateway webhook receiver (internal) |

Full API documentation: **[/api-docs/](http://localhost:3003/api-docs/)**

## Verify Web App

The `web/` directory contains a React frontend for searching and verifying C2PA Content Credentials. It's designed to be deployed separately (e.g., on Arweave) and configured to point at any sidecar instance.

```bash
cd web
pnpm install
VITE_API_URL=https://your-gateway.com/c2pa-api pnpm run build
```

See [web/README.md](web/) for details.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | Server port |
| `GATEWAY_URL` | `http://localhost:3000` | AR.IO gateway URL |
| `DUCKDB_PATH` | `./data/provenance.duckdb` | Database file path |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `MAX_IMAGE_SIZE_MB` | `50` | Max upload size for byContent |
| `ENABLE_SIGNING` | `false` | Enable COSE signing oracle |
| `SIGNING_ALGORITHM` | `ES256` | Signing algorithm (ES256, ES384) |
| `SIGNING_CERT_PEM` | — | Base64-encoded PEM certificate chain |
| `SIGNING_PRIVATE_KEY_PEM` | — | Base64-encoded PEM private key |
| `ENABLE_PROOF_LOCATOR_ARTIFACTS` | `true` | Index proof-locator artifacts |
| `ENABLE_BY_REFERENCE` | `true` | Enable byReference endpoint |

See [.env.example](.env.example) for all options.

## Development

```bash
pnpm install
pnpm run dev          # Hot-reload dev server
pnpm run build        # Build with tsup
pnpm test             # Run unit tests
pnpm run format       # Format code (Prettier)
```

## Docker Compose

```bash
# Development (local build + hot reload)
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d

# Production overlay (alongside existing gateway)
docker compose -f <gateway-compose> -f docker-compose.sidecar.yaml up -d
```

## License

[AGPL-3.0](LICENSE)
