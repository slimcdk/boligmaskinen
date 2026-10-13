# 2. Only data we may use, credited as it asks

- **Status:** accepted
- **Date:** 2026-10-07
- **Where:** [`docs/data-sources.md`](../data-sources.md), `SOURCES` in
  `frontend/src/app/panel/about-dialog.ts`, "Data sources" in the README, Track A in
  [the plan](../plan.md#track-a-access-applications-start-now-runs-alongside)

## Context

Danish data about places and homes comes in three kinds:

- open data, under licences such as CC BY 4.0, CC0 or the ODbL;
- registers behind an application, such as Datafordeleren (addresses, buildings, valuations) and
  EJF (sale prices);
- commercial listings.

Scraping home portals is common, and often against their terms. Datatilsynet's 2024 decision on
Boliglag rules out owner names. Sale prices tied to addresses are personal data under the GDPR.

## Decision

- **Open sources first.** A gated source only with a legal basis: an approved application, a
  licence, or the user's own key or e-mail. Nothing is scraped where the terms forbid it.
- **Personal data:** no owner names and no search by name. Sale prices need a documented GDPR
  legal basis.
- **The licence is checked on the provider's own page** before a source is used, and the source
  is credited as it asks, in "About the data" and in the README's list.
- **Every source we come across is written down** in `docs/data-sources.md`, with what it offers:
  the ones in use, the candidates and what they need, and the ones set aside, with the reason.
  Several sources for the same data are welcome; one may be richer, or open where another is not.
- **Access that takes an application** is Track A, which runs alongside the milestones because
  others decide how long it takes.

## Alternatives

- **Scraping the portals for homes for sale:** fast, but against their terms, and fragile.
- **A commercial data provider for everything:** possible later for listings and prices (Track
  A), but not as the base of a self-hosted app anyone can run.

## Consequences

- Homes, homes for sale, prices and alerts (milestones 4 to 6) wait for Track A.
- Some sources wait or are left out: flood maps that state no licence, and Danmarks Højdemodel
  until there is a Dataforsyningen token ([ADR 11](0011-elevation-from-copernicus.md)).
- The layers made from OpenStreetMap are under the ODbL: an instance open to others must offer
  them, or the way they are made (the README's licence section).
- A new source is not done until it is credited and written down
  ([the guide](../guides/adding-a-data-source.md)).
