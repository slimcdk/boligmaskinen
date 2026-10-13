# 8. One user per instance, with the maps saved on the server

- **Status:** accepted
- **Date:** 2026-10-07; saved on the server since 2026-10-09
- **Where:** `backend/src/routes/profile.ts` and `backend/src/profile/` (the profile API),
  `frontend/src/app/state/` (`profile-sync.ts`,
  `sync.ts`, `store.ts`), [`docs/self-hosting.md`](../self-hosting.md);
  [#55](https://github.com/slimcdk/boligmaskinen/pull/55)

## Context

An instance runs in a home, for its household. The phone and the desktop should show the same
maps. Logins (OIDC, a user per person) are a lot of work, and nobody needed them yet.

## Decision

- **An instance has one user** and no login (the owner's decision of 2026-10-07; logins are under
  "Later: users" in the plan).
- **The maps** (their blocks and groups) **and the places are saved on the server** through the
  profile API, so every browser has them. A change is saved 0.8 s after the last one; other
  devices' changes arrive when the page is shown and every 30 s, with an ETag. When two devices
  changed the same map, the change made here wins and the user is told.
- **Which map is open, and the map settings, stay with each browser.**
- **Without a backend or a database** (`503` or `404` from `/api/profile`), the app keeps the maps
  in the browser, as the prototype did.

## Alternatives

- **Maps only in the browser:** what the prototype had; lost with the browser's data, and not on
  the phone.
- **Users and logins now:** not needed by one household, and a lot to build and secure.

## Consequences

- Everyone who can reach an instance sees and changes the same maps. On the internet it belongs
  behind a reverse proxy's authentication (the self-hosting guide says so).
- Ids are made with `crypto.getRandomValues` (`newId`), as `crypto.randomUUID` needs HTTPS and a
  home server is often plain HTTP.
- A tool that drives the app against a real instance must not save there: the README's screenshots
  answer `/api/profile` with `503` (`frontend/screenshots/`).
