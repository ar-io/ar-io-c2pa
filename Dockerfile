# =============================================================================
# Trusthash Sidecar — Standalone Docker image
# =============================================================================
# For use when the sidecar is in its own repo (not the monorepo).
# Native modules (DuckDB, sharp) compile correctly via pnpm lifecycle scripts.
# =============================================================================

FROM node:20-bookworm-slim

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Install build tools for native modules (DuckDB node-pre-gyp, sharp) and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install dependencies (pnpm runs lifecycle scripts by default)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the backend
RUN pnpm run build

# Create directory for data
RUN mkdir -p /app/data

# Set environment
ENV NODE_ENV=production
ENV PORT=3003
ENV DUCKDB_PATH=/app/data/provenance.duckdb

EXPOSE 3003

CMD ["node", "dist/index.js"]
