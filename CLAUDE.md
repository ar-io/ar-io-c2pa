# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Trusthash Sidecar is a C2PA manifest repository, COSE signing oracle, and pHash similarity search service for AR.IO Arweave gateways. It indexes C2PA Content Credentials from gateway webhooks using Arweave transaction tags (no JUMBF parsing). Used with the `@ar-io/turbo-c2pa` client SDK.

## Commands

```bash
pnpm run dev              # Start dev server with hot reload (tsx --watch)
pnpm run build            # Build with tsup (outputs to dist/)
pnpm test                 # Run unit tests (vitest)
pnpm run start            # Run built dist/index.js
pnpm run format           # Format code (Prettier)
pnpm run format:check     # Check formatting (CI uses this)

# Integration tests (requires Docker)
./scripts/run-integration.sh

# Docker
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d   # Dev (local build)
# For use alongside a gateway, use the sidecar overlay:
# docker compose -f <gateway-compose> -f docker-compose.sidecar.yaml up -d
```

Tests use vitest with no config file (defaults). Integration tests gate on `RUN_INTEGRATION=1` env var and use `describe.skip` otherwise. Unit tests create synthetic images with sharp in `beforeAll`.

## Architecture

### Request Flow

Gateway sends webhooks to `POST /webhook` when C2PA transactions are indexed. The webhook service (`services/webhook.service.ts`) validates required tags using constants from `src/protocol/` (inlined C2PA tag schema), extracts pHash from soft binding values, and upserts into DuckDB.

### Key Layers

- **Routes** (`src/routes/`): Hono route modules mounted in `index.ts`. Each route file exports a `Hono` instance.
- **Services** (`src/services/`): Business logic. Routes call services; services call DB or external APIs.
- **DB** (`src/db/`): DuckDB with custom migration framework. `index.ts` has all queries; `schema.ts` has DDL; `migrations.ts` has versioned migrations (table-rewrite pattern for DuckDB schema changes).
- **Config** (`src/config.ts`): Zod-validated env vars. Loaded once at startup. Boolean env vars use a custom `envBoolean` preprocessor (only `"true"` and `"1"` are truthy).

### Database

DuckDB (single-file `data/provenance.duckdb`). Two tables:

- `manifests` - indexed C2PA artifacts (manifest-store or proof-locator kinds)
- `soft_bindings` - algorithm/value pairs linked to manifest IDs

pHash stored as `FLOAT[64]` array (one float per bit of 64-bit hash). Similarity search uses `array_distance()` L2 distance which equals Hamming distance on 0/1 vectors.

Migrations run automatically on startup via `runMigrations()`. They use a `schema_migrations` version table. DuckDB lacks `ALTER COLUMN`, so migrations that change nullability do full table rewrites (create new table, copy data, drop old, rename).

### Two Artifact Kinds

Webhook processing maps `C2PA-Storage-Mode` tag values to artifact kinds:

- `full`/`manifest` -> `manifest-store` (C2PA bytes stored on Arweave)
- `proof` -> `proof-locator` (pointer to remote manifest, digest-verified on fetch)

### Manifest Resolution (`GET /v1/manifests/:manifestId`)

Multi-step resolution chain: redirect to `fetchUrl` -> redirect to `repoUrl` -> local gateway fetch (manifest-store) -> remote fetch + digest verify + ephemeral cache (proof-locator).

### Signing Oracle

`POST /v1/sign` accepts raw COSE Sig_structure bytes, returns ECDSA signature in IEEE P1363 format. Gated by `ENABLE_SIGNING` env var. Supports ES256/ES384 with local PEM keys. `POST /v1/identity/sign` adds Ethereum wallet verification (CAWG identity assertions).

### Soft Binding Resolution

`/v1/matches/byBinding` does exact GraphQL tag lookups against the gateway. `/v1/matches/byContent` computes pHash from uploaded image. `/v1/matches/byReference` fetches remote image and computes pHash. All return manifest matches.

### Protocol Constants (`src/protocol/`)

C2PA ANS-104 tag names and types are inlined in `src/protocol/` (originally from `@ar-io/c2pa-protocol`). These are protocol-versioned constants (v1.0.0) — only change when the protocol version bumps.

## Critical Details

- Port 3003 (not 3000 which is the gateway)
- Gateway must be running first (creates `ar-io-network` Docker network)
- In Docker, `GATEWAY_URL` must not be localhost (config validates this at startup and exits)
- Docker uses `.env.docker` with `GATEWAY_URL=http://core:4000`; local dev uses `.env` with `GATEWAY_URL=http://localhost:3000`
- `pnpm run format` before committing (Prettier, enforced by CI)
- OpenAPI spec at `openapi/c2pa-sbr-1.1.0.yaml`
- `data/` directory holds DuckDB file - never commit it
