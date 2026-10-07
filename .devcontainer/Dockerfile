FROM mcr.microsoft.com/devcontainers/typescript-node:24-trixie

# uv runs the pilot pipeline and installs the Python version it asks for
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /usr/local/bin/

# go-pmtiles cuts the basemap (pilot/pipeline/basemap.sh), psql talks to the database, and
# Playwright's Chromium needs its system libraries (the browser itself comes with post-create.sh)
ARG PMTILES_VERSION=1.31.2
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) arch=x86_64 ;; \
      arm64) arch=arm64 ;; \
      *) echo "No go-pmtiles build for $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_${arch}.tar.gz" \
      | tar -xz -C /usr/local/bin pmtiles; \
    apt-get update; \
    apt-get install -y --no-install-recommends postgresql-client; \
    npx -y playwright@1.63.0 install-deps chromium; \
    rm -rf /var/lib/apt/lists/*
