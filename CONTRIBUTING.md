# Working on Boligmaskinen

How the project is worked on, for anyone who picks it up. [The README](README.md) says how to
start it; [the plan](docs/plan.md) says where it is going and what is next.

## Before you change something

- **The decisions** that shape the project, and why they were taken, are in
  [`docs/adr/`](docs/adr/README.md). A change that goes against one gets a new ADR first.
- **The guides** walk through the common changes:
  - [Adding a data source](docs/guides/adding-a-data-source.md): from its licence to a value in the
    block language and its line in "About the data".
  - [Adding a weighting](docs/guides/adding-a-block.md): a predefined block in the catalogue.
- **Each part has a README** of its own: [`frontend/`](frontend/README.md),
  [`backend/`](backend/README.md), [`packages/engine/`](packages/engine/README.md) and
  [`pipeline/`](pipeline/README.md). The block language is in
  [`docs/block-language.md`](docs/block-language.md).

## How a change goes in

- **A branch and a pull request** for each step, small enough to review; `master` is always
  ready to run, as the test instance runs it ([ADR 13](docs/adr/0013-images-releases-test-instance.md)).
- **Tests come with every change:** Vitest for the engine, the frontend and the backend (the
  backend's database tests run against PostGIS with `TEST_DATABASE_URL`), pytest for the
  pipeline, and Playwright for what a user does (`frontend/e2e`, and `frontend/e2e-live` against
  the whole app). The unit tests measure their coverage.
- **CI must be green** before a merge. Pull requests are merged with a merge commit, and the
  branch is deleted afterwards.
- **Commit messages** say what the change does, in the imperative and in plain words ("Add the
  chargers for electric cars"), with the why in the body.

## The rules that hold everywhere

- **Only data we may use,** credited as it asks
  ([ADR 2](docs/adr/0002-only-data-we-may-use.md)). Every source we come across goes into
  [`docs/data-sources.md`](docs/data-sources.md), and every weighting idea into
  [`docs/block-ideas.md`](docs/block-ideas.md), also the ones not built.
- **The UI follows Material Design 3,** with the skill in `.claude/skills/material-design-3-ui`
  and its self-audit, in light and dark mode and on a phone
  ([ADR 10](docs/adr/0010-material-3-two-languages.md)).
- **Every text a user sees** has a key in `frontend/src/i18n/en.json` and in `da.json`. The code,
  its comments, the docs and the commit messages are in English.
- **Nothing is loaded from other servers** by the browser ([ADR 9](docs/adr/0009-nothing-from-other-servers.md)).
- **Each pipeline step fits in about 1 GB of memory** for all of Denmark
  ([ADR 3](docs/adr/0003-one-image.md)).
- **The block language has versions:** a change that could alter existing code raises the
  version and comes with a migration ([ADR 5](docs/adr/0005-blocks-in-our-own-language.md)).
