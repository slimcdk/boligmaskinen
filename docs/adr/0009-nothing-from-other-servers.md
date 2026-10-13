# 9. The app loads nothing from other servers

- **Status:** accepted
- **Date:** 2026-10-10
- **Where:** `backend/src/security.ts`, the basemap job in `backend/src/pipeline/builds.ts`,
  `frontend/src/styles.scss`; [#77](https://github.com/slimcdk/boligmaskinen/pull/77),
  [#87](https://github.com/slimcdk/boligmaskinen/pull/87),
  [#128](https://github.com/slimcdk/boligmaskinen/pull/128)

## Context

Someone who runs an instance for others must not hand their visitors to third parties: under the
GDPR a font from Google is a transfer. A home server's app should also work with only the home
server, and a strict Content Security Policy protects the users from injected code.

## Decision

- **A strict Content Security Policy:** `default-src 'self'`, with no `http(s):` source anywhere in
  it, which a test checks. Styles allow `'unsafe-inline'`, which Angular Material needs.
- **`'unsafe-eval'` only for the heat worker,** which compiles blocks to JavaScript
  ([ADR 5](0005-blocks-in-our-own-language.md)). A dedicated worker runs under its own script's
  policy, so the page does not get it.
- **Fonts and icons are bundled:** Roboto and the variable Material Symbols font from npm, served
  with hashed names.
- **The basemap is in the data pack:** the basemap job cuts the region's tiles out of Protomaps'
  daily planet build with go-pmtiles, with its fonts, sprites and styles. Natural Earth draws the
  world around it.
- **The licence texts** of the fonts, icons and libraries are served with them.

## Alternatives

- **Hosted tiles and Google Fonts:** less to build and store, but every visit reaches a third
  party.

## Consequences

- The data pack carries the basemap: about 75 MB for Denmark up to zoom 12.
- A view that needs online tiles, such as aerial photos (#53), goes through the backend, which can
  keep a token on the server and cache the tiles; the browser still talks only to the app.
- A new library or asset is served by the app, or not used.
