# Boligmaskinen backend

One Node server for the whole app: it serves the built frontend, its data pack and the API from
one port. The app image (`../Dockerfile`) runs it, so a single image is the whole app; PostGIS runs
next to it as its own container when the backend starts using it.

For now the API only tells which version is running. The data jobs, the database and the vector
tiles come next.

## Run

Node 24 runs the TypeScript sources directly (type stripping), so there is no build step.
`npm run typecheck` checks the types.

```sh
npm install
(cd ../frontend && npm run build)    # the server serves frontend/dist/frontend/browser
npm run dev                          # http://localhost:8080, restarts on changes
npm test                             # Vitest
npm run typecheck
```

## Endpoints

| Path | What it serves |
|---|---|
| `/` and the app's own paths | The frontend; unknown paths get `index.html`, because the app is a single page. Hashed bundles may be cached for good. |
| `/data-pack/…` | The data pack, from `DATA_PACK_DIR`. |
| `/api/version` | Which version is running, from the `APP_*` variables, named like the OCI image labels. Without them it answers 404 and the frontend reads its own `build-info.json`. |
| `/api/health` | `{"status":"ok"}`, for the image's health check. |

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | `8080`, `0.0.0.0` | Where the server listens. |
| `STATIC_DIR` | `../frontend/dist/frontend/browser` | The built frontend. |
| `DATA_PACK_DIR` | none | The data pack. Without it, the frontend's build has to contain one (`public/data-pack`). The image uses `/data/data-pack`. |
| `APP_VERSION`, `APP_REVISION`, `APP_SOURCE`, `APP_CREATED` | empty | The release tag, commit, repository URL and build time. CI sets the last three when it builds the image, and a release sets `APP_VERSION` on the same image. |
