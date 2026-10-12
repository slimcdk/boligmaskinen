# The block language

The weighting is a list of blocks, and every block is a small formula in this language. The
predefined blocks are formulas too; the user can read and change them. This document describes
version 1, the current version.

The language exists for one job: turning the values of a cell or a home into points. That is why it
has no loops, no functions of its own, and no access to files or the network. Every block finishes,
in time proportional to its length, so a server can run any user's blocks without a sandbox. The
parser and compiler are in `packages/engine/src/formula.ts`, one implementation for the browser and
the backend.

## A block

```
// Close to a wood
let full = slider(300, 0, 20000, 50)   // Full points up to (m)
let zero = slider(3000, 0, 20000, 50)  // No points from (m)
ramp(forest, full, zero)
```

- `let` lines name values. Some of them become controls in the side panel (see Controls).
- The last line is the result.
- A block has a **role**:
  - A **preference** gives a score from 0 to 1 per cell, which counts with the block's weight.
  - A **requirement** removes the cells where the result is false or 0.
  - The role is set in the panel, not in the code.

## Syntax

- **Lines.** Any number of `let name = expression` lines, then one expression: the result.
  - `;` at the end of a line is allowed but not needed.
  - The result may start with `return`.
- **Comments** run from `//` to the end of the line.
  - A comment at the end of a `let` line is the label of its control.
  - The first comment line of the block is its description in the panel, when it has no controls.
- **Numbers:** `300`, `0.5`, `.5`, `1e3`. `true` and `false` are 1 and 0.
- **Names:** letters, digits and `_`, not starting with a digit. Upper and lower case differ.
  `let`, `return`, `true` and `false` are reserved.
- **A `let` name** cannot be a value, a function or a constant that already exists.

### Operators, from the loosest to the tightest

| Operator | Meaning |
|---|---|
| `c ? a : b` | `a` where `c` is true, otherwise `b` |
| `a \|\| b` | or |
| `a && b` | and |
| `==` `!=` (also `===` `!==`) | equal, not equal |
| `<` `<=` `>` `>=` | comparison |
| `+` `-` | add, subtract |
| `*` `/` `%` | multiply, divide, remainder |
| `-a` `+a` `!a` | minus, plus, not |
| `a ** b` | power; `2 ** 3 ** 2` is `2 ** 9`, and `-2 ** 2` is `-4` |

Comparisons and logic give 1 for true and 0 for false, so they can be counted:
`(school < 1000) + (daycare < 500)` is 0, 1 or 2.

## Missing data

Some values have no data in some places, for example road noise where it was never mapped. Missing
data is carried along instead of guessed:

- **Arithmetic** with missing data gives missing data.
- **Comparisons** with missing data give missing data.
- **`&&` and `||`** decide without the missing side when they can:
  - `false && x` is false.
  - `true || x` is true.
  - Otherwise missing data gives missing data.
- **`!x` and `x ? a : b`** give missing data when `x` is missing.
- **When the result is missing:**
  - A preference counts for nothing in that cell, and the other blocks' weights fill in.
  - A requirement keeps the cell. Missing data never removes a place.
- **On purpose:** `known(x)` is true where `x` has data, and `fallback(x, y)` is `y` where `x` has
  none.

## Values

The values a block can read are listed under "Values" in the code editor. Distances are in metres
to the nearest one; beyond 20 km they count as 20 km.

| Value | What it is |
|---|---|
| `forest` | Distance to a wood of at least 5 ha |
| `water` | Distance to a lake of at least 5 ha, or the sea |
| `beach` | Distance to a beach |
| `noise` | Noise, Lden in dB: the loudest of roads, railways, airports and industry where Miljøstyrelsen maps them, else an estimate from the roads (railways, airports and industry added 2026-10-10, which keeps the language version) |
| `no2`, `pm25` | Nitrogen dioxide and fine particles, yearly means 2024 in µg/m³ on a 1 km grid (added 2026-10-10; additions keep the language version) |
| `water_hardness` | The hardness of the drinking water from the public waterworks, °dH; missing where homes have wells of their own (GEUS; added 2026-10-10, which keeps the language version) |
| `elevation` | The height above sea level in whole metres, from −10 m: the low part of the cell in the Copernicus model of the surface, so mostly the ground, though treetops may lift it in a forest; missing at sea. A control in it says "(m a.s.l.)" (added 2026-10-12, which keeps the language version) |
| `turbine` | Distance to a wind turbine in operation |
| `turbine_heights` | The same distance in the turbine's total height, the nearest in those terms: 4 is what Danish rules keep from a neighbour; 25.4 or more where none is that near (added 2026-10-10, which keeps the language version) |
| `solar` | Distance to a solar park of at least 1 ha: a plant, or panels on the ground (OpenStreetMap; added 2026-10-10, which keeps the language version) |
| `planned_road` | Distance to a road or railway the municipal plans lay out, adopted or proposed (Plandata.dk; added 2026-10-10, which keeps the language version) |
| `new_local_plan` | Distance to a local plan of the last two years, proposed or adopted; 0 inside one, so `new_local_plan < 500` is "a new local plan within 500 m" (Plandata.dk; added 2026-10-10, which keeps the language version) |
| `district_heating` | Distance to an area the heat plans give district heating; 0 inside one, so `district_heating == 0` is "in a district heating area" (Plandata.dk; added 2026-10-10, which keeps the language version) |
| `building_line` | Distance to a building line around a forest, church, lake or stream, inside which building needs a dispensation; 0 inside one (Danmarks Miljøportal; added 2026-10-10, which keeps the language version) |
| `consequence_zone` | Distance to a zone the municipal plans draw around a business or technical plant that smells, makes noise or is a risk; 0 inside one (Plandata.dk; added 2026-10-10, which keeps the language version) |
| `extraction_area` | Distance to an area the regions' raw material plans set aside for digging sand, gravel or clay; 0 inside one (Danmarks Miljøportal; added 2026-10-10, which keeps the language version) |
| `extraction_interest` | Distance to an area the regions' raw material plans keep for digging later; 0 inside one (Danmarks Miljøportal; added 2026-10-10, which keeps the language version) |
| `power_line` | Distance to an overhead power line of 132 kV or more; the lines under ground do not count (OpenStreetMap; added 2026-10-10, which keeps the language version) |
| `airport` | Distance to an airport: an aerodrome with an IATA code, such as Billund or Kastrup (OpenStreetMap; added 2026-10-10, which keeps the language version) |
| `airfield` | Distance to an airfield of any kind: the airports and air stations, and the public, private, gliding and microlight fields (OpenStreetMap; added 2026-10-10, which keeps the language version) |
| `air_station` | Distance to a military air station: Aalborg, Karup or Skrydstrup (OpenStreetMap; added 2026-10-10, which keeps the language version) |
| `protected_area` | Distance to a protected area, a fredning of land in force (not the land around churches); 0 inside one, so `protected_area > 0` is "not inside" (Miljøstyrelsen; added 2026-10-10, which keeps the language version) |
| `natura2000` | Distance to a Natura 2000 area for habitats or birds; 0 inside one (Miljøstyrelsen; added 2026-10-10, which keeps the language version) |
| `density` | Addresses within 300 m |
| `supermarket`, `school`, `daycare`, `station` | Distance to the nearest one |
| `departures` | Departures per hour between 7 and 9 on a weekday from the stops within 500 m, each trip once, up to 255 (Rejseplanen; added 2026-10-10, which keeps the language version) |
| `pharmacy`, `library` | Distance to the nearest pharmacy or public library (OpenStreetMap; added 2026-10-10, which keeps the language version) |
| `charger` | Distance to the nearest public charger for electric cars, of any provider (GeoFA and OpenStreetMap; added 2026-10-12, which keeps the language version) |
| `charger_clever`, `_norlys`, `_ok`, `_spirii`, `_ewii`, `_eon`, `_tesla`, `_circle_k`, `_uno_x`, `_shell`, `_q8`, `_other` | The same for one provider's chargers, or for those of every other operator. The browser measures these from the data pack's points (`chargers.json`) the first time a block reads them, rather than loading a layer for each. The block "EV charger" ticks the providers with a checkbox each: `min(clever ? charger_clever : FAR, …)` |
| `zone` | Planning zone: `BYZONE`, `LANDZONE` or `SOMMERHUS` |
| `income_tax` | Municipal income tax, % |
| `land_tax` | Land tax, ‰ |
| `burglaries` | Home burglaries per 1,000 residents |
| `population` | Residents of the municipality |
| `income` | Mean disposable income per resident of the municipality, kr.; missing where the statistics have none (Danmarks Statistik; added 2026-10-10, which keeps the language version) |
| `nursery_price` | The yearly rate for a municipal nursery place (0–2 years), kr. (Danmarks Statistik; added 2026-10-10, which keeps the language version) |
| `class_size` | Pupils per class in the municipality's folkeskoler (Danmarks Statistik; added 2026-10-10, which keeps the language version) |
| `<place>_car`, `_bike`, `_walk`, `_train` | Minutes to one of the user's places, e.g. `work_car`. Renaming the place renames the values in every block. `_train` is by public transport, every kind (bus, train, metro, light rail, ferry): on Rejseplanen's timetable of a weekday, the time to be at the place between 7:30 and 8:30 from leaving the cell, waiting included (since 2026-10-10; estimated from the distance where the server has no timetable) |

### Constants

| Constant | Value |
|---|---|
| `BYZONE` | 1 |
| `LANDZONE` | 2 |
| `SOMMERHUS` | 3 |
| `FAR` | Infinity: farther than any distance, so `a ? distance : FAR` leaves a distance out of a `min()` when `a` is off (added 2026-10-12, which keeps the language version) |

## Functions

| Function | What it gives |
|---|---|
| `ramp(x, full, zero)` | 1 at `full`, 0 at `zero`, a straight line between; works in either direction |
| `clamp(x)`, `clamp(x, lo, hi)` | `x` kept between 0 and 1, or between `lo` and `hi` |
| `min(a, b, …)`, `max(a, b, …)` | The smallest or largest value |
| `abs(x)` | `x` without its sign |
| `sqrt(x)`, `pow(x, y)`, `exp(x)`, `log(x)` | Square root, power, e to the power, natural logarithm |
| `round(x)`, `floor(x)`, `ceil(x)` | Rounded to a whole number: nearest, down, up |
| `known(x)` | True where `x` has data |
| `fallback(x, y)` | `y` where `x` has no data, otherwise `x` |
| `slider(value, min, max, step)` | `value`; makes a slider (see Controls) |
| `choice(n, a, b, …)` | The `n`th of the values, counting from 1; makes a choice (see Controls) |

## Controls

Like free values in GeoGebra, some `let` lines become controls in the side panel:

| The line | The control |
|---|---|
| `let reach = 3000` | A slider from 0 to about three times the value |
| `let reach = slider(3000, 0, 10000, 100)` | A slider with that range and step |
| `let byzone = true` | A checkbox; checkboxes that follow each other share a row, and the panel's summary names those ticked, or those not when few are not ("All but OK") |
| `let travel = choice(2, work_car, work_bike, work_walk)` | A choice between the values, named after them without their shared start ("car", "bike", "walk") |

- **Label and unit.** The comment at the end of the line is the label. A unit in brackets at its
  end, such as `(m)`, `(min)`, `(dB)` or `(%)`, is the unit.
- **Distances** (`(m)`) get a slider on a square-root scale, so short distances can be set
  precisely.
- **Moving a control** rewrites the number in the code, so the code is always the whole truth.
- **Turning a block around.** A block whose ramp's ends are called `full` and `zero` can be turned
  around: "Turn around" in the panel swaps the two values in the code. Full points then go to the
  other end, such as noise instead of quiet. `ramp()` works in either direction, so nothing else
  changes. The labels "Full points at" and "No points at" hold either way, and the panel's summary
  says which way the block points ("Full points up to 45 dB" or "Full points from 65 dB").
  A predefined block that still has its own name takes its opposite name ("Quiet" becomes
  "Noisy"), and Reset brings back both.

## When the code is wrong

- **Syntax errors** say where they are: `Line 2, column 14: Expected ")" but found "end of code"`.
- **An unknown name** suggests close ones: `Unknown name "forrest". Did you mean forest?`
- **A function with the wrong number of values** says how many it takes.
- **A preference has to give a score from 0 to 1.** The data is checked when the block runs; a
  block that gives more, or less, is left out, and the panel says how many cells were wrong and
  suggests `clamp(…)` or the role of a requirement.

## In the database

The same code runs in PostgreSQL too (`packages/engine/src/sql.ts`), for scoring homes where they
are stored. Missing data is NULL there, and every function gives the number it gives in the
browser, NULL where the browser has no data. Two things differ: a number past ±1.8 × 10³⁰⁸ stops
the query where the browser says infinity, and the browser keeps scores as 32-bit numbers, so the
points agree to about 1e-5. Like the generated JavaScript, the SQL is made from the parsed code,
never from its text.

## Versions and migrations

Saved blocks outlive the language they were written in, so the language has versions, and code
is carried over from one version to the next by migrations.

- **Every saved block records its language version** (`language` on the block). The current
  version is 1, and a block saved before versions existed is version 1.
- **Additions keep the version:** a new function, a new value or a new constant. They cannot change
  what existing code means. A new function or constant can clash with a `let` name; the migration
  for that version renames the `let`.
- **Anything that could change existing code raises the version:** renaming or removing a value
  or a function, changing what a function takes or gives, or reserving a new word.
- **A migration turns code of one version into code of the next.**
  - It works on the code's tokens, as renaming a place already does, so the user's comments,
    layout and own names stay as they were.
  - It is a plain function from text to text, kept in `packages/engine/src/migrations.ts` with the
    version it leads to.
- **Blocks are upgraded when they are loaded:** from the browser's storage today, and from the
  database when weightings are saved on the server. A block goes through each migration in turn
  until it reaches the current version.
- **A migration that cannot rewrite a block safely leaves it as it was.** The block keeps its old
  version and code, is left out of the weighting, and the panel says what to change. Code never
  changes its meaning without the user seeing it.
- **Every migration is tested.** Old code goes in, the expected code comes out, and where the
  meaning should stay the same, the points must be equal before and after.
- **Predefined blocks** are written at the current version. "Reset" always gives the current
  version's code.
