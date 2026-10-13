# 5. Weightings are blocks in a small language of our own

- **Status:** accepted
- **Date:** 2026-10-07; compiled to JavaScript and SQL on 2026-10-09 and 2026-10-10
- **Where:** [`docs/block-language.md`](../block-language.md), `packages/engine/src/`
  (`formula.ts`, `codegen.ts`, `sql.ts`, `library.ts`, `migrations.ts`);
  [#37](https://github.com/slimcdk/boligmaskinen/pull/37),
  [#54](https://github.com/slimcdk/boligmaskinen/pull/54),
  [#73](https://github.com/slimcdk/boligmaskinen/pull/73),
  [#74](https://github.com/slimcdk/boligmaskinen/pull/74),
  [#97](https://github.com/slimcdk/boligmaskinen/pull/97)

## Context

People weigh very different things, and in ways fixed filters cannot say: "near a train, or ten
minutes by bike", "quiet, unless it is a town". A map can come from a link someone shared, so
its code must be safe to run.

## Decision

- **A weighting is a list of blocks.** Each block is a small formula over the cell's values, in a
  language of our own, whose `let … = slider(…)` lines become sliders, checkboxes and choices in
  the panel. A block is a preference (points from 0 to 1) or a requirement (removes cells).
- **The predefined blocks are code too.** `criterionCode` in `library.ts` writes them from the
  criteria in `DEFAULT_CRITERIA`, so a user can read, change, reset and turn around each one.
- **The language has versions.** A block records the version its code is written for. A change
  that could alter existing code raises `LANGUAGE_VERSION` and comes with a migration in
  `migrations.ts`; a migration that cannot rewrite a block safely leaves it alone and says why.
  An addition (a value, a function, a constant) keeps the version.
- **One parse, three ways to run:** compiled to JavaScript in a Web Worker for the map, to SQL so
  PostGIS scores as the browser does, and as closures when the page may not compile code.
- **Groups only organise.** A map's blocks sit in groups that switch on and off together; a group
  has no weight of its own (the owner's decision of 2026-10-07).

## Alternatives

- **Fixed filters with weights:** simple, but cannot combine values or say anything new.
- **JavaScript as the language:** powerful, but not safe to run from a link, and not SQL.
- **Groups as a level of weighting:** turned down; their weights hid what each block counts.

## Consequences

- A new value is an addition: it needs no new version, and every block can use it at once.
- Renaming or changing a value, a function or a constant needs a version and a migration.
- The compiled blocks need `'unsafe-eval'`, which only the heat worker gets
  ([ADR 9](0009-nothing-from-other-servers.md)).
- The browser and the database must stay equal: the SQL test scores every predefined block and
  every operator against PostGIS.
