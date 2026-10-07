# syntax=docker/dockerfile:1

# The app image: the Node backend, which serves the built frontend, its data pack and the API from
# one port. The data pack is not part of the image; mount it at /data/data-pack (see README.md).
#
# CI builds this image once for every commit on master and tags it sha-<commit>. A release does
# not rebuild it: the release workflow gives the same image its version with crane, which only
# changes the version label and APP_VERSION, so the layers that passed the tests are the ones that ship.

FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ARG REVISION=""
ARG SOURCE=""
RUN REVISION="$REVISION" SOURCE="$SOURCE" npm run build

FROM node:24-alpine AS backend
WORKDIR /src/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine
ARG REVISION=""
ARG SOURCE=""
ARG CREATED=""
# Which version is running, as the OCI labels name it; the backend serves it at /api/version.
# Releases set APP_VERSION on the finished image.
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/frontend \
    DATA_PACK_DIR=/data/data-pack \
    APP_VERSION="" \
    APP_REVISION="$REVISION" \
    APP_SOURCE="$SOURCE" \
    APP_CREATED="$CREATED"
WORKDIR /app
COPY --from=backend /src/backend/node_modules backend/node_modules
COPY backend/package.json backend/
COPY backend/src backend/src
COPY backend/migrations backend/migrations
COPY --from=frontend /src/frontend/dist/frontend/browser frontend
USER node
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s --start-period=90s --start-interval=2s CMD wget -qO /dev/null http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "backend/src/server.ts"]
