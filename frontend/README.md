# Boligmaskinen frontend (prototype)

Angular 22 + Angular Material prototype of the map-first home search: a full-screen
MapLibre map with a heatmap of how well every cell in Denmark fits what the user cares
about.

## How the weighting works

The block language has its own reference: [`../docs/block-language.md`](../docs/block-language.md).

- The weighting is a list of standalone **blocks**. Every block is a small formula over
  the data, in a safe expression language (`../packages/engine/src/formula.ts`) that is compiled
  to closures and never run as JavaScript.
  - Example: `ramp(forest, 300, 3000)`.
  - The formula can read every data layer (`forest`, `noise`, `zone`, `income_tax`, …)
    and the travel time to each of the user's places (`work_car`, `work_train`, …).
- **Predefined blocks are code too** (`../packages/engine/src/library.ts`). The user can read and
  change them, and "Reset" brings back the original.
- **A preference** gives a score from 0 to 1 per cell and counts with its importance.
  **A requirement** removes the cells where it is false.
- The blocks are averaged by importance into 0–100 points. The weighting and the heatmap
  are always the result, never blocks.
- **100 m up close.** The national pack shows 200 m cells; from zoom 10 the map loads the pack's
  detail tiles around the view (`map/detail.ts`) and draws the grid's own 100 m cells there, with
  the limit and the colour scale of the whole map, so the two look the same. A click explains the
  spot from the cells the map shows.
- **Off the main thread.** The weighting, the smoothing and the colours are computed in a Web
  Worker, which holds the data layers. The page sends it the blocks and draws the pixels it sends
  back, so the panel answers while a slider moves. When something changes during a drawing, only
  the newest state is drawn next.
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
- **"Turn around"** swaps the two ends of a block's ramp in its code, so full points go to the other
  end: "Quiet" becomes "Noisy". The weight only says how much a block matters; which way it points
  is in its code.

## Maps and groups

- **A map** is a named weighting with its own blocks: "Family", "Near the sea". The menu under
  the title switches between them, and starts a new map, duplicates, renames or deletes the open
  one. There is always one map.
- **The places are shared** by every map; each map has its own blocks for them. "Add" lists the
  places, so another map can give a place a block too. A new name or a removed place reaches every
  map.
- **Groups** hold the blocks of a map. A predefined block starts in its catalogue group ("Nature",
  "Peace and quiet", …), or wherever blocks of its kind already are, also under a new name; the
  user's own blocks go in "My blocks", places in "Your places". The block's menu moves it to another
  group or a new one, and a group without blocks is gone.
- **No two groups share a name:** a group renamed to the name of another joins it.
- **A group can be switched off.** Its blocks then count for nothing, as if they were left out, and
  keep their settings. A group has no weight of its own.
- **A requirement has a switch** in place of a weight. A preference is turned off with its weight
  (0), and a block that counts for nothing is dimmed.
- What earlier versions saved becomes the first map, "My map", with its blocks in groups.
- The logic is in `../packages/engine/src/maps.ts`; the store (`src/app/state/store.ts`) works on
  the open map.

## Saved on the server

The maps and places are kept on the server, so every browser has them (`src/app/state/profile-sync.ts`,
with the backend's API in `profile-api.ts`). Which map is open and the map settings belong to each
browser.

- **The store works on its own copy,** which is also kept in localStorage (`boligmaskinen.prototype.v4`),
  so the app opens at once and works while the server cannot be reached.
- **A change is saved 0.8 seconds after the last one,** so a slider sends one save. When the page is
  hidden, what waits is sent at once, in a request that outlives the page.
- **Changes from other devices** are fetched when the page is shown again and every 30 seconds while
  it is visible; the ETag makes that cheap.
- **Merging** (`src/app/state/sync.ts`) goes one map or place at a time. The browser remembers each
  one's version on the server and a hash of what the server has:
  - what changed only on the server is taken, and what changed only here is saved;
  - when both changed the same map, the change made here wins, saved from the server's version, and a
    snackbar says so;
  - what another device deleted goes, unless it was changed here since;
  - a browser that meets the server for the first time adds its maps and places, under names of their
    own when the server has ones like them. The empty map a new browser starts with is left out.
- **The cloud beside the map's name** says the maps are saved. Without a backend, such as on the
  artifact host or with `npm start` alone, nothing is said and the maps stay in the browser. When the
  server cannot be reached, it says so in words and tries again every 30 seconds.
- **Ids are random** (`newId` in the engine), so maps from two devices never share one.
  `crypto.randomUUID` is not used, since it needs HTTPS and a home server on the LAN has none.

## The panels: two floating, or a card and a bottom sheet on phones

- **On a larger screen two panels float over the map**, as Home Assistant's map does: 12 px from the
  window's edges, with M3's large corners and elevation, each only as tall as its content.
  - **The map panel** (`src/app/panel/map-panel.ts`) is on top: the app's name, which cells to show and
    from how many points, the histogram, and the map settings. Its settings may take most of the window.
  - **The weighting panel** (`src/app/panel/panel.ts`) is below it: the open map, the blocks in groups,
    the places and the footer. It takes the rest of the window and scrolls inside.
  - The map runs under them to the edges and keeps its view beside them (MapLibre's padding), moving
    as they open and close. The chevron hides both, "What matters to you" brings them back, and Escape
    inside them hides them.
- **On a phone (up to 700 px)** the map panel is a card at the top, without the app's name, and the
  weighting is an M3 bottom sheet (`src/app/sheet/bottom-sheet.ts`). The sheet starts down, with the
  open map and "What matters to you" over the map, and its handle raises it to half the screen or near
  the top: drag it to any height and it settles at the nearest, or tap it (or Enter or Space) to go up
  and down. The map stays usable between them and keeps its view between them.
- **Dropping a place on a phone:** the sheet goes down while the map is tapped, and comes back up with
  the new place's block. The hint at the top can cancel.
- The legend is gone from the map; the panel's footer and the data jobs adapt to a narrow screen.
- The weight sliders have no tooltip on touch screens, which would stop the panel from scrolling
  under a finger.
- The end-to-end tests run the sheet and the data jobs at 390 × 844 with touch.

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
- The heatmap ramp turns around in dark mode: more points are darker on the light map and
  brighter on the dark map. The legend and the histogram use the same ramp.

## Heatmap colours

- **"Map settings" picks the colours:** Red to green (the default), Orange (the theme's tertiary
  colour), Azure (its primary), Violet or Rose. A browser keeps the colours it had.
- **The scales are made from the tones of Angular Material's M3 palettes** (`src/app/map/m3-tones.ts`,
  copied from `@angular/material`). One hue in steps of lightness can be read with every kind of
  colour vision; Red to green says that it cannot.
- **"Smooth" or "Steps":** steps divide the scale into five, each with one colour and opacity.
- **The panel shows the histogram, not the numbers.** The result in words (cells and median) is the
  histogram's label for screen readers. The map itself has no legend: the histogram's bars have the
  map's colours.

## Footer: about, data jobs and version

- **"About the data"** opens a dialog: how the map is made, and a section per source with what it
  gives, its licence and the credit it asks for (`SOURCES` in `src/app/panel/about-dialog.ts`). The map
  itself shows only "© OpenStreetMap", until it is first moved or for five seconds, as OSMF's
  attribution guidelines ask; see `../docs/data-sources.md`.
- **The gear** opens the data jobs: what each fetch or build does, how often it runs, when
  it runs next and when it last ran. "Run now" starts it.
  - "Tasks" can be filtered to the failing, running, waiting or not yet built ones; "Recent runs"
    has each run's result, and its log when picked.
  - With a backend, the dialog shows its jobs through `api/jobs` and refreshes every 2 seconds
    while it is open (`src/app/admin/jobs.service.ts`, `jobs-api.ts`).
  - Without one, such as on the artifact host, it shows a simulated preview
    (`jobs-simulation.ts`) and says so.
  - When the backend answers but cannot show the jobs, for example without a database, the
    dialog shows its reason.
  - The shapes in `src/app/admin/jobs.ts` are the same as the backend's.
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
- The data pack, which the pipeline in `../pipeline` builds (see below).

## Data pack

`public/data-pack/` is generated and git-ignored. It holds the byte-container PNGs
for the basemap and the 13 feature layers, plus glyphs, sprites and the basemap styles.
Copy the one a running app has built (`DATA_DIR/data-pack`), or build it with the pipeline's
steps (`../pipeline/README.md`). A pack the jobs built names itself in `meta.json` (`pack`), and
the app reads its files from `data-packs/<pack>/`; with the backend running, `proxy.conf.json`
sends those to it. Without a backend, remove `pack` from the copy's `meta.json`.

`e2e/data-pack/` is a small data pack for Aarhus Kommune, which is committed. The
end-to-end tests use it, and `npm start -- --configuration e2e` serves the app with it.

## Develop

```sh
npm install
npx ng serve          # http://localhost:4200
npx ng build
```

To work with the backend (saved maps, the real data jobs), start it on port 8080 (`../backend`,
`npm run dev` with `DATABASE_URL` and an absolute `DATA_PACK_DIR`), and the dev server with
`npx ng serve --proxy-config proxy.conf.json`, which sends `/api` to it.

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
- `e2e-live/*.spec.ts` run against the whole app, with the backend and its database
  (`npx playwright test -c playwright.live.config.ts`, with `BASE_URL`). CI runs them against
  the image started with `compose.yaml`. They start a real job from the jobs dialog and read its
  log, and check that the footer shows the version the server reports.
- The map keeps its view in the address (`#map=zoom/lat/lng`). Tests and links can open a
  given view, and tests read the zoom from it.

## Structure

| Path | What it is |
|---|---|
| `../packages/engine/` | The weighting engine, shared with the backend and imported as `@boligmaskinen/engine` (a path in `tsconfig.json`). See its README. |
| `src/app/data/` | Loading the data pack (byte containers, chunked PMTiles source). |
| `src/app/state/` | The maps with their blocks and groups, the places and the map settings as signals, persisted in localStorage. `migrate.ts` carries over the earlier prototypes' choices. |
| `src/app/map/` | MapLibre map, and the heatmap: `heat-engine.ts` weighs the blocks, smooths and colours the cells and explains a cell's points; it runs in a Web Worker (`heat.worker.ts`), and `heat.service.ts` sends it the blocks and puts its pixels on the map. |
| `src/app/panel/` | The two panels: the map panel (the result and the map settings) and the weighting panel (the map switcher, the groups with their block rows and controls, the places, the footer), and their dialogs. |
| `src/app/sheet/` | The bottom sheet the weighting panel is in on a phone. |
| `src/app/admin/` | The data-jobs dialog, its API client, the job model it shares with the backend, and the simulated preview. |
| `src/app/theme/` | Light and dark mode: the viewer's choice and the footer button. |
| `e2e/` | Playwright end-to-end tests, and `e2e/data-pack/`, the test data pack. |
| `tools/` | `build-info.mjs` (the version label) and `to_artifact.py` (publishing). |

## Publishing as a Claude artifact

`tools/to_artifact.py dist/frontend/browser <out>` turns the build into a page fragment
plus files that the artifact host accepts.
