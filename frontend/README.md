# Boligmaskinen frontend (prototype)

Angular 22 + Angular Material prototype of the map-first home search: a full-screen
MapLibre map with a heatmap of how well every cell in Denmark fits what the user cares
about.

## How the weighting works

- The weighting is a list of standalone **blocks**. Every block is a small formula over
  the data, in a safe expression language (`src/app/scoring/formula.ts`) that is compiled
  to closures and never run as JavaScript.
  - Example: `ramp(forest, 300, 3000)`.
  - The formula can read every data layer (`forest`, `noise`, `zone`, `income_tax`, …)
    and the travel time to each of the user's places (`work_car`, `work_train`, …).
- **Predefined blocks are code too** (`src/app/scoring/library.ts`). The user can read and
  change them, and "Reset" brings back the original.
- **A preference** gives a score from 0 to 1 per cell and counts with its importance.
  **A requirement** removes the cells where it is false.
- The blocks are averaged by importance into 0–100 points. The weighting and the heatmap
  are always the result, never blocks.
- **Like free values in GeoGebra**, some `let` lines become controls in the side panel:
  - a number or `slider(value, min, max, step)` becomes a slider (distances on a
    square-root scale);
  - `true`/`false` becomes a checkbox;
  - `choice(1, a, b, …)` becomes a choice.
  - The comment at the end of the line is the label, and "(m)", "(min)" or "(dB)" is the unit.
  - Moving a control rewrites the value in the code.
- **Code is checked** for syntax and unknown names ("did you mean …"). A preference has to
  give a score from 0 to 1 in every cell; a block that does not is left out and explained.
- **Missing data** spreads through arithmetic, comparisons and logic, so a requirement
  never removes a cell for missing data.
- **Renaming a place** renames its values in every block's code.
- **Every preference has a weight slider** from 0 (off) to 10 on its line in the panel.

## Light and dark mode

- The app follows the system's light or dark setting. The button with the half-filled
  circle in the footer picks "System", "Light" or "Dark", and the choice is kept in the
  browser.
- `src/app/theme/theme.service.ts` holds the choice and the outcome (`scheme`):
  - The stylesheet uses `color-scheme: light dark`, and the Material theme's colours are
    `light-dark()` pairs, so CSS follows the system without any code.
  - A page that embeds the app may pin a theme with `data-theme` on the root element, as
    the artifact viewer does. The viewer's own choice is set as `data-scheme` and wins
    over both.
  - `scheme` is for what CSS cannot reach: the map style and the heatmap colours.
- The map switches between the Protomaps "light" and "dark" flavours
  (`style-layers.json`, `style-layers-dark.json` and `sprites/light|dark` in the data pack).
  - They have the same layers, so only the colours change and no tiles are loaded again.
  - The app's own layers (world, municipalities) take their colours from
    `src/app/map/colours.ts`.
- The heatmap ramp turns around in dark mode: more points are darker orange on the light
  map and brighter on the dark map. The legend and the histogram use the same ramp.

## Footer: about, data jobs and version

- **"About the data"** opens a dialog: how the map is made, and every source with its
  licence and a link.
- **The gear** opens the data jobs: what each fetch or build does, how often it runs, when
  it runs next and when it last ran. "Run now" starts it, and the history shows each
  run's log.
  - Until there is a backend, `src/app/admin/jobs.service.ts` simulates the runs.
  - The shapes in `src/app/admin/jobs.ts` are what the backend's job API should serve.
- **The version label** shows the release tag, or the short commit hash, or "local build".
  - The app asks the backend's `api/version` first. Without a backend it reads
    `build-info.json`, which `tools/build-info.mjs` writes on every `npm start` and
    `npm run build`.
  - The fields are named like the OCI image labels: `version`, `revision`, `source`,
    `created`.
  - The image has the same values both as labels and as the environment variables
    `APP_VERSION`, `APP_REVISION`, `APP_SOURCE` and `APP_CREATED`, which the backend serves
    (see `../backend/README.md`).

## Requirements

- Node.js 22.22.3 or newer (see `.nvmrc`). Angular 22 does not run on Node 20.
- The data pack produced by the pilot pipeline in `../pilot` (see below).

## Data pack

`public/data-pack/` is generated and git-ignored. It holds the byte-container PNGs
for the basemap and the 13 feature layers, plus glyphs, sprites and the basemap styles.
Build it with the pilot pipeline (`../pilot/README.md`) and `../pilot/web/pack_site.py`,
then copy the output's `basemap/`, `data/`, `sprites/`, `world/`, `fonts.json` and
`style-layers*.json` into `public/data-pack/`.

`e2e/data-pack/` is a small data pack for Aarhus Kommune, which is committed. The
end-to-end tests use it, and `npm start -- --configuration e2e` serves the app with it.

## Develop

```sh
npm install
npx ng serve          # http://localhost:4200
npx ng build
```

## Tests

Every element gets tests as it is built: Vitest for logic and components, Playwright for
what a user does in the browser. Run both before anything is published.

```sh
npm test              # Vitest: unit and component tests (jsdom), about 5 seconds
npm run e2e           # Playwright: end-to-end tests in Chrome, about a minute
npm run e2e:ui        # Playwright's UI mode, for writing and debugging tests
```

- `src/**/*.spec.ts` are the Vitest tests. Among them is a parity test showing that the
  predefined blocks score exactly like the original engine.
- `e2e/*.spec.ts` are the Playwright tests. They start `ng serve --configuration e2e` on
  port 4310, which serves the test data pack in `e2e/data-pack` (Aarhus Kommune) instead
  of `public/data-pack`. So they give the same results on every machine and in CI, and a
  fresh clone can run them without building any data.
- They use the installed Google Chrome (`channel: 'chrome'`), so no browser is
  downloaded.
  - In the dev container, `PLAYWRIGHT_CHANNEL=chromium` uses Playwright's own Chromium.
  - Without a GPU (CI, the dev container) the map's WebGL is drawn in software with
    SwiftShader (`PLAYWRIGHT_SOFTWARE_GL=1`, or automatically when `CI` is set).
- `e2e/theme.spec.ts` checks light and dark mode by how bright the map actually is on a
  screenshot (`e2e/pixels.ts`).
- The map keeps its view in the address (`#map=zoom/lat/lng`). Tests and links can open a
  given view, and tests read the zoom from it.

## Structure

| Path | What it is |
|---|---|
| `src/app/scoring/` | The weighting engine, framework-free and unit-tested so it can move to a shared package for the backend. `blocks.ts`: evaluating the blocks. `formula.ts`: the block language. `library.ts`: the predefined blocks. `values.ts`: what a formula can read. `engine.ts`: decoding, lower limits, blur. `travel.ts`: travel-time estimates. |
| `src/app/data/` | Loading the data pack (byte containers, chunked PMTiles source). |
| `src/app/state/` | The blocks, places and map settings as signals, persisted in localStorage. `migrate.ts` carries over the earlier prototypes' choices. |
| `src/app/map/` | MapLibre map, heatmap rendering (`heat.service.ts`) and the points breakdown. |
| `src/app/panel/` | The Material side panel: result, catalogue dialog, block rows with their controls, the code editor dialog, places. |
| `src/app/admin/` | The data-jobs dialog, the job model the backend should serve, and the simulated jobs. |
| `src/app/theme/` | Light and dark mode: the viewer's choice and the footer button. |
| `e2e/` | Playwright end-to-end tests, and `e2e/data-pack/`, the test data pack. |
| `tools/` | `build-info.mjs` (the version label) and `to_artifact.py` (publishing). |

## Publishing as a Claude artifact

`tools/to_artifact.py dist/frontend/browser <out>` turns the build into a page fragment
plus files that the artifact host accepts.
