# Adding a weighting: a predefined block

How a new weighting reaches the catalogue ("What matters to you?") as a predefined block: a
criterion the engine writes code for, with its sliders, its texts in both languages and its
tests. Read [ADR 5](../adr/0005-blocks-in-our-own-language.md) (blocks in our own language) first.

The block reads one or more values. A value that does not exist yet comes from a source first:
[Adding a data source](adding-a-data-source.md). The two usually go in one pull request.

## 1. Write the idea down

Every weighting idea goes into [`docs/block-ideas.md`](../block-ideas.md) when it comes up: what it
weighs, the values it reads (reuse the names in [`public-data.md`](../public-data.md)), the source,
and whether it works both ways. Write a code sketch where it helps. Mark it done, with the date and
the value, when it is built.

## 2. A criterion or an example

- **One value with a curve** ("near a pharmacy", "quiet", "soft water") is a **criterion**: an
  entry in `DEFAULT_CRITERIA` in `packages/engine/src/types.ts`. `criterionCode` in `library.ts`
  writes its code: the note as a comment, a slider for full points and one for no points, and
  `ramp(value, full, zero)`.
- **Code beyond one value** ("forest or water", "free to build") is an **example**: an entry in
  `EXAMPLES` in `library.ts`, with its code written by hand. It is listed under "Examples of code".
- **Checkboxes or a choice** (the planning zone, the chargers' providers) need a case of their own
  in `criterionCode`, as `kind: 'category'` and `sites: 'chargers'` have.

## 3. The criterion's fields

```ts
{ id: 'pharmacy', group: 'Everyday life', name: 'Pharmacy', opposite: 'Away from pharmacies',
  note: 'Nearest pharmacy, from OpenStreetMap.', kind: 'distance', layer: 'pharmacy',
  role: 'want', weight: 1, full: 1000, zero: 5000 },
```

| Field | What it is |
|---|---|
| `id` | The same as the value it reads. Four old ones differ (`VALUE_NAME` in `library.ts`); do not add more |
| `group` | The catalogue group: `Nature`, `Peace and quiet`, `Infrastructure and plans`, `Everyday life` or `Area and economy` |
| `name` | What gives points, short: "Quiet", "High ground", "Away from wind turbines" |
| `opposite` | The name when the block is turned around: "Noisy", "Low ground" |
| `note` | One sentence: what is measured and from where. It is the first comment in the code and the text in the catalogue |
| `kind` | As the value's: `distance`, `noise`, `count`, `scaled`, `municipal`, `category` |
| `layer` or `field` | The layer it reads, or the municipal field |
| `unit`, `min`, `max`, `step` | The sliders' scale, for `scaled`, `municipal` and `count` (distances and noise have theirs) |
| `full`, `zero` | Where the points are full and where they are none. Nearer is better when `full` < `zero`; the ramp works either way |
| `role` | `want` (a preference, points 0 to 1) or `must` (a requirement, removes cells) |
| `weight` | Its weight at the start, 1 for most; 0 to `MAX_WEIGHT` (10) |

**Choose `full` and `zero` from the data,** for all of Denmark: what share of the address points
gets full points, and what share none? A default that gives all of Denmark the same points says
nothing. Look at the histogram in the panel with the block alone, and at a few places you know.

**The labels must hold both ways:** "Full points at" and "No points at" are right whether the block
is turned around or not (`turnAround` in `formula.ts`).

## 4. Texts in both languages

- `frontend/src/i18n/en.json` and `da.json`: `criteria.<id>` with `name`, `opposite` and `note`. The
  English is the same as in `DEFAULT_CRITERIA`. `texts.spec.ts` fails until `da.json` names the
  block, and `npm test` first checks that both catalogues have the same keys.
- A new unit for its summary ("2 per hour", "10 m a.s.l.") goes under `words`.
- A new catalogue group needs a name under `groups` in both catalogues, and `CriterionGroup` and
  `ValueGroup` in the engine.

## 5. The language

Adding a criterion or a value is an addition: the language keeps its version. Changing a
predefined block that users may have saved is not:

- A user's block keeps the code it was saved with; "Reset" brings the new code.
- A change that alters how existing code runs (a value renamed, a function changed) raises
  `LANGUAGE_VERSION` and comes with a migration in `migrations.ts`
  ([`docs/block-language.md`](../block-language.md), "Versions and migrations").

## 6. Tests

- **The engine** (`packages/engine`): the block's code parses and compiles, gives points from 0 to
  1 on made-up values, and its summary reads right (`blocks.spec.ts`).
- **The database** (`backend/test/block-sql.test.ts`): runs every predefined block in PostGIS and
  in the engine, on made-up rows of every value, and needs them equal. It picks the new block up by
  itself.
- **The browser** (`frontend/e2e/app.spec.ts`): add the block from the catalogue in the test with
  the newest blocks ("… and the height score the map"), check its summary (`.rule`), and that it
  reads a layer of the test data pack (no error).
- **Accessibility and the phone:** the catalogue and the block are checked by
  `e2e/accessibility.spec.ts`; a block with new controls needs a look on a phone and in dark mode
  ([ADR 10](../adr/0010-material-3-two-languages.md)).

## 7. Write it down

- [`docs/block-ideas.md`](../block-ideas.md): the idea marked done.
- `CHANGELOG.md` under Unreleased, and the plan's status when it is part of a milestone.
