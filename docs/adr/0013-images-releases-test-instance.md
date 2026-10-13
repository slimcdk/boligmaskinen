# 13. Every green commit is an image; releases retag it; the test instance follows master

- **Status:** accepted
- **Date:** 2026-10-07; arm64 since 2026-10-10, badges and coverage since 2026-10-12
- **Where:** `.github/workflows/` (`ci.yml`, `arm64.yml`, `release.yml`), `.github/dependabot.yml`,
  `.github/scripts/`; [#1](https://github.com/slimcdk/boligmaskinen/pull/1),
  [#77](https://github.com/slimcdk/boligmaskinen/pull/77),
  [#89](https://github.com/slimcdk/boligmaskinen/pull/89),
  [#135](https://github.com/slimcdk/boligmaskinen/pull/135)

## Context

What runs should be exactly what was tested. The owner runs a test instance at home that should
show the newest work without waiting for releases.

## Decision

- **Every push and pull request** runs the engine, frontend, backend, pipeline and end-to-end
  tests, and starts the image with `compose.yaml` and the test data pack. The unit tests measure
  their coverage.
- **Every commit on `master` that passes** is built once, for amd64 and arm64, and pushed as
  `ghcr.io/slimcdk/boligmaskinen:sha-<commit>`, also tagged `master`. A pull request that changes
  what goes into the image also builds it for arm64 (`arm64.yml`).
- **A release builds nothing.** `release.yml` gives the image of the released commit its version
  with crane: only the version label and `APP_VERSION` change; the layers stay the ones tested.
- **The test instance runs `:master`** and is updated by hand; it is never pinned to a release.
- **Dependabot** proposes updates weekly; CI tests them like any other pull request.
- **The badges** in the README come from the branch `badges`, which the job "Badges" force-pushes
  after every run on master. The branch belongs to CI: never delete it with the merged branches.

## Alternatives

- **Build on release:** the released image would not be the one tested.
- **The test instance on releases:** the owner wanted to see the newest work.

## Consequences

- `master` must always be ready to run; a pull request is merged only when CI is green.
- Merging several pull requests at once makes GitHub cancel the pending runs of the commits in
  between; the newest run tests and builds them all.
- The badges show the newest run on master; a part whose tests fail keeps its last coverage.
