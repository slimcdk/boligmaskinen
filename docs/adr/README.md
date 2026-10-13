# Architecture decisions

The decisions that shape Boligmaskinen, each with what led to it and what it costs. Read them
before changing how a part works. The guides say how to do the common changes:

- [Adding a data source](../guides/adding-a-data-source.md)
- [Adding a weighting: a predefined block](../guides/adding-a-block.md)

| ADR | Decision | Since |
|---|---|---|
| [1](0001-record-decisions.md) | Record the architecture decisions | 2026-10-13 |
| [2](0002-only-data-we-may-use.md) | Only data we may use, credited as it asks | 2026-10-07 |
| [3](0003-one-image.md) | One image for the app, its API, its data jobs and the pipeline | 2026-10-07 |
| [4](0004-a-grid-of-cells-in-a-data-pack.md) | Score a grid of cells, carried to the browser as one byte per cell | 2026-10-07 |
| [5](0005-blocks-in-our-own-language.md) | Weightings are blocks in a small language of our own | 2026-10-07 |
| [6](0006-data-jobs.md) | Data jobs: fetch into a raw archive, build, check, switch | 2026-10-09 |
| [7](0007-our-own-routing.md) | Travel times from our own routing, not a routing service | 2026-10-10 |
| [8](0008-one-user-per-instance.md) | One user per instance, with the maps saved on the server | 2026-10-07 |
| [9](0009-nothing-from-other-servers.md) | The app loads nothing from other servers | 2026-10-10 |
| [10](0010-material-3-two-languages.md) | Material Design 3, Danish and English, WCAG 2.2 AA | 2026-10-07 |
| [11](0011-elevation-from-copernicus.md) | The height above sea level from Copernicus until DHM can be had | 2026-10-12 |
| [12](0012-points-measured-in-the-browser.md) | Distances to points a block chooses are measured in the browser | 2026-10-12 |
| [13](0013-images-releases-test-instance.md) | Every green commit is an image; releases retag it; the test instance follows master | 2026-10-07 |
| [14](0014-terrain-from-our-own-tiles.md) | The background "Terrain" from our own tiles of the Copernicus model | 2026-10-13 |

## Writing one

Copy the shape of the others: a title that states the decision, then **Status**, **Date** and
**Where** (the code and the pull requests), and the sections Context, Decision, Alternatives and
Consequences. Keep it to a page.

- **When:** a choice that is hard to undo, that others have to build around, or that was taken
  over a reasonable alternative. Small choices belong in the code's comments and the pull
  request.
- **Numbers** go up by one and are never reused.
- **A decision that changes** gets a new ADR. The old one keeps its text; its status says
  "superseded by N".
- **Open decisions** stay in [the plan](../plan.md#open-decisions) until they are taken.
