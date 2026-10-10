# syntax=docker/dockerfile:1

# The app image: the Node backend, which serves the built frontend, its data pack and the API from
# one port, and the data pipeline its jobs run. The data pack is not part of the image; it lives
# in /data/data-pack (see README.md).
#
# CI builds this image once for every commit on master and tags it sha-<commit>. A release does
# not rebuild it: the release workflow gives the same image its version with crane, which only
# changes the version label and APP_VERSION, so the layers that passed the tests are the ones that ship.

FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
# The scoring engine, shared with the backend
COPY packages/engine/ /src/packages/engine/
COPY frontend/ ./
ARG REVISION=""
ARG SOURCE=""
RUN REVISION="$REVISION" SOURCE="$SOURCE" npm run build

# Debian, not Alpine: the pipeline's Python packages (geopandas, rasterio, scipy, osmium) come as
# wheels built for glibc. Python runs the pipeline's steps, wget answers the healthcheck, and
# PostgreSQL's client 18 (from PostgreSQL's own apt repository, as Debian has 17) dumps the
# database for the nightly backup. The downloads try again, as a build fails on one lost lookup.
FROM node:24-trixie-slim AS base
RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates wget \
    && install -d /usr/share/postgresql-common/pgdg \
    && wget -qO /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --tries=5 --waitretry=10 --retry-connrefused --retry-on-host-error \
       https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

# The backend's packages are JavaScript only, so they are installed once, on the machine that builds
FROM --platform=$BUILDPLATFORM node:24-trixie-slim AS backend
WORKDIR /src/backend
COPY packages/engine/ /src/packages/engine/
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# The data pipeline (pipeline/), installed with its locked dependencies in a virtual environment
# on the image's own Python, so it runs as it is in the final stage
FROM base AS pipeline
COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=/usr/bin/python3 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
WORKDIR /app/pipeline
COPY pipeline/pyproject.toml pipeline/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY pipeline/README.md ./
COPY pipeline/src src
# The packages' own test suites are 90 MB that never run here
RUN uv sync --frozen --no-dev --no-editable \
    && find .venv -depth -type d -name tests -path '*/site-packages/*' -exec rm -rf {} +

# go-pmtiles cuts the region's basemap out of Protomaps' planet build
FROM base AS pmtiles
ARG TARGETARCH
ARG PMTILES_VERSION=1.31.2
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) arch=x86_64; sum=3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f ;; \
      arm64) arch=arm64; sum=f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1 ;; \
      *) echo "There is no go-pmtiles build for $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    wget -qO /tmp/pmtiles.tgz --tries=5 --waitretry=10 --retry-connrefused --retry-on-host-error \
      "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_${arch}.tar.gz"; \
    echo "$sum  /tmp/pmtiles.tgz" | sha256sum -c -; \
    tar -xzf /tmp/pmtiles.tgz -C /usr/local/bin pmtiles

FROM base
ARG REVISION=""
ARG SOURCE=""
ARG CREATED=""
# Which version is running, as the OCI labels name it; the backend serves it at /api/version.
# Releases set APP_VERSION on the finished image.
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/frontend \
    DATA_PACK_DIR=/data/data-pack \
    DATA_DIR=/data \
    PIPELINE_PYTHON=/app/pipeline/.venv/bin/python \
    APP_VERSION="" \
    APP_REVISION="$REVISION" \
    APP_SOURCE="$SOURCE" \
    APP_CREATED="$CREATED"
WORKDIR /app
# npm and corepack only install packages, which the stages above did: out of the running app
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=pmtiles /usr/local/bin/pmtiles /usr/local/bin/pmtiles
COPY --from=pipeline /app/pipeline/.venv pipeline/.venv
# node_modules/@boligmaskinen/engine links to ../packages/engine, which Node runs as TypeScript
COPY --from=backend /src/backend/node_modules backend/node_modules
COPY packages/engine/package.json packages/engine/
COPY packages/engine/src packages/engine/src
COPY backend/package.json backend/
COPY backend/src backend/src
COPY backend/migrations backend/migrations
COPY --from=frontend /src/frontend/dist/frontend/browser frontend
# The licences of the libraries in the frontend's bundles, which "About the data" links to
COPY --from=frontend /src/frontend/dist/frontend/3rdpartylicenses.txt frontend/licences/third-party.txt
# A named volume starts as a copy of /data, so it belongs to the app's user (node, 1000) too
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s --start-period=90s --start-interval=2s CMD wget -qO /dev/null http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "backend/src/server.ts"]
