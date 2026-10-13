# 10. Material Design 3, Danish and English, WCAG 2.2 AA

- **Status:** accepted
- **Date:** 2026-10-07; both languages since 2026-10-10
- **Where:** `.claude/skills/material-design-3-ui/`, `frontend/src/styles.scss`,
  `frontend/src/i18n/`, `frontend/tools/check-i18n.mjs`, `frontend/e2e/accessibility.spec.ts`;
  [#50](https://github.com/slimcdk/boligmaskinen/pull/50),
  [#78](https://github.com/slimcdk/boligmaskinen/pull/78),
  [#93](https://github.com/slimcdk/boligmaskinen/pull/93),
  [#99](https://github.com/slimcdk/boligmaskinen/pull/99)

## Context

The app is a full-screen map with panels, used on desktops and phones, by Danes first. It should
look and behave consistently as it grows, and be usable with a keyboard and a screen reader.

## Decision

- **Material Design 3 through Angular Material.** Colours, type, shape and elevation come from
  the `--mat-sys-*` tokens, never literals; light and dark mode both work. UI work follows the
  `material-design-3-ui` skill in `.claude/skills/` and ends with its self-audit.
- **Danish and English** with Transloco: the texts are in `frontend/src/i18n/en.json` and
  `da.json`. The app follows the browser's language, and the footer switches it.
  - The engine's names (blocks, groups, values) are English in the code and translated by
    `Texts`; a name the user gave stays as it is.
  - The sources' and the jobs' English stays in the code (`SOURCES`, the job definitions); only
    their Danish is in `da.json` (`about.sources`, `jobs.byId`).
  - `npm test` first checks that both catalogues have the same keys and placeholders.
- **WCAG 2.2 AA:** axe runs in the end-to-end tests on the main views, in both themes and on a
  phone, and must find nothing. Touch screens get 48 px targets.

## Alternatives

- **A design of our own:** more to decide and keep consistent.
- **Danish only:** the code, the docs and contributors are in English; one more language is
  little once every text goes through a key.

## Consequences

- Every text a user sees needs a key in `en.json` and the same key in `da.json`.
- New UI is checked in light and dark mode and on a phone, and by axe.
