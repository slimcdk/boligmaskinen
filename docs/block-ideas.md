# Block ideas for when there is data about homes

Blocks to build when milestone 4 brings data about each home (DAR addresses, BBR buildings and
units, MAT parcels, VUR valuations) and milestone 5 brings what is for sale. Started 2026-10-07.

This is a catalogue of ideas, not a decision. Each idea says:

- what the block weighs;
- which values it needs in the block language;
- where the data comes from;
- a first sketch of its code.

The value names and constants are proposals.

**Data codes to check:** BBR's code lists (heating installation, fuel, building type, roof material)
must be checked against the data when it is loaded. The constants below stand for those codes; they
are not the codes themselves.

## How home values fit the language

- A home inherits the values of the grid cell it lies in (`forest`, `noise`, `zone`, …) and adds
  its own (`area_m2`, `heating`, …). One block can mix both.
- A home value that is missing, such as a field BBR does not have for an old building, is missing
  data, like a cell without noise data. A preference counts for nothing there, and a requirement
  keeps the home.
- New values, constants and functions do not change the language version (see "Versions and
  migrations" in `block-language.md`).

## Heating

**What:** the home's heating, which says a lot about running costs and how future-proof it is.

**Data:** BBR records, per building or unit:

- the heating installation (`varmeinstallation`): district heating, central heating, heat pump,
  electric heating, stoves;
- the fuel (`opvarmningsmiddel`): electricity, gas, oil, solid fuel, straw;
- any supplementary heating (`supplerende varme`).

Open through Datafordeleren, which needs the key in Track A.

**Values:** `heating` (one of `DISTRICT_HEATING`, `HEAT_PUMP`, `GAS`, `ELECTRIC`, `OIL`, `WOOD`, …,
combining installation and fuel) and `extra_heating` (e.g. `WOOD_STOVE`).

There are two ways to build it, which the user raised on 2026-10-07.

### A. One block with points per type (recommended for preferences)

One "Heating" block whose controls give each type its points. The block's own weight says how
much heating matters next to everything else.

```
// Heating
let district = 1     // District heating
let heat_pump = 0.9  // Heat pump
let gas = 0.5        // Natural gas
let electric = 0.4   // Electric heating
let oil = 0.1        // Oil
let wood = 0.3       // Wood or straw
match(heating, DISTRICT_HEATING, district, HEAT_PUMP, heat_pump, GAS, gas, ELECTRIC, electric, OIL, oil, WOOD, wood)
```

This needs a new function, `match(x, key1, value1, key2, value2, …, default?)`. It gives the
value for the key that `x` equals, the default otherwise, and missing data when there is no
default. Without it, the code is a chain of `heating == DISTRICT_HEATING ? district : …`.

### B. A selector with a weight, added once per type

A block with one choice and its own weight. It is added once for district heating, once for heat
pumps, and so on:

```
let kind = choice(1, DISTRICT_HEATING, HEAT_PUMP, GAS, ELECTRIC, OIL, WOOD)  // Heating
heating == kind
```

**As preferences this works against itself.** A home has one heating type, so it can only satisfy
one of these blocks, and the weighted average counts the others as zero.

- With "district heating" at weight 8 and "heat pump" at weight 5, a home with district heating
  gets 8/13 of the full points, and one with a heat pump 5/13.
- Both are punished for not having the other, and adding a third alternative lowers everyone.

Design A gives each type its points in one block, so the alternatives do not dilute each other.

**As a requirement, a selector fits:** "only homes with district heating or a heat pump". That is
one block with a checkbox per type, like the planning zone block:

```
// Only these kinds of heating
let district = true   // District heating
let heat_pump = true  // Heat pump
let gas = false       // Natural gas
let electric = false  // Electric heating
let oil = false       // Oil
let wood = false      // Wood or straw
(heating == DISTRICT_HEATING && district) || (heating == HEAT_PUMP && heat_pump) || (heating == GAS && gas)
  || (heating == ELECTRIC && electric) || (heating == OIL && oil) || (heating == WOOD && wood)
```

**Proposal:** the catalogue offers both: "Heating: points per type" (A) and "Heating: only these
types" (the requirement).

**Adding a block more than once:** this already works for blocks outside the catalogue; the
catalogue's own blocks are added once, so they are not counted twice. If repeated selector blocks
are wanted after all, they need their own way of combining, such as "the best of these", and that
is a change to the weighting, not to the language.

## Room to the neighbours

**What:** how close the nearest other house is. A detached house with room around it, or close
neighbours.

**Data:** GeoDanmark's building footprints (polygons, more exact than BBR's point per building) and
BBR's use of each building. PostGIS works out, per home, the distance from its building to the
nearest other building with homes. MAT gives the parcel, so "inside my own parcel" can be told
apart from "the neighbour's".

**Values:**

| Value | Meaning | Unit |
|---|---|---|
| `neighbour` | Distance from the home's building to the nearest other building with homes | m |
| `homes_100m` | Homes within 100 m of the home | homes |
| `plot_m2` | Area of the home's parcel | m² |
| `detached` | True for a detached house | |

```
// Room to the neighbours
let zero = slider(5, 0, 200, 1)    // No points below (m)
let full = slider(40, 0, 200, 1)   // Full points from (m)
ramp(neighbour, zero, full)
```

As a requirement: `neighbour >= 15 && detached`.

## The home itself

| Value | Meaning | Unit | Source |
|---|---|---|---|
| `area_m2` | Living area | m² | BBR |
| `rooms` | Rooms | | BBR |
| `bathrooms` | Bathrooms | | BBR |
| `home_type` | `DETACHED`, `TERRACED`, `FLAT`, `HOLIDAY_HOME`, `FARM`, … | | BBR |
| `built`, `renovated` | Year built, year of the last major renovation | year | BBR |
| `floor` | Floor of a flat (0 = ground floor) | | DAR |
| `lift` | The building has a lift | | BBR |
| `asbestos_roof` | The roof is fibre cement that may contain asbestos | | BBR (roof material) |
| `garage` | A garage or carport on the parcel | | BBR (other buildings on the parcel) |

```
// Space for a family
let full = slider(140, 0, 400, 5)   // Full points from (m²)
let zero = slider(90, 0, 400, 5)    // No points below (m²)
ramp(area_m2, zero, full) * (rooms >= 4 ? 1 : 0.5)
```

```
// No stairs: ground floor, or a lift
floor == 0 || lift
```

```
// Built after 1980, or renovated since 2000
built >= 1980 || renovated >= 2000
```

## Money

| Value | Meaning | Unit | Source | Milestone |
|---|---|---|---|---|
| `valuation` | Public property valuation | kr. | VUR | 4 |
| `land_tax_dkk` | Land tax per year: the land value times the municipality's rate (`land_tax`) | kr. | VUR + DST | 4 |
| `price`, `price_m2` | Asking price, per m² | kr. | Listings | 5 |
| `days_listed` | Days on the market | days | Listings | 5 |
| `last_sale`, `last_sale_year` | Last sale price and year | kr., year | EJF | 5 (needs approval) |

```
// Within budget, with a margin
let budget = slider(4000000, 0, 15000000, 50000)  // Budget (kr.)
ramp(price, budget * 0.9, budget * 1.1)
```

## Around the home, more exactly than the cell

These exist at cell level today. At home level they can be measured at the building itself:

| Value | Meaning | Source |
|---|---|---|
| `noise_facade` | Road noise at the building rather than the 100 m cell | Miljøstyrelsen noise maps |
| `fibre` | Fibre broadband at the address | Tjekditnet (Digitaliseringsstyrelsen); ask before showing it per address |
| `district_school` | The district school, and its grades through `uddannelsesstatistik.dk` | GeoFA school districts |
| `flood_risk` | Risk of flooding from cloudbursts or storm surges | Klimadatastyrelsen / DMI |
| `contaminated` | The parcel is mapped as contaminated land (V1 or V2) | Danmarks Miljøportal |
| `radon` | Radon risk in the area | Sundhedsstyrelsen; only per municipality before 2007, so coarse |

```
// Not on contaminated land, and not at risk of flooding
!contaminated && flood_risk < 2
```

## Protected areas, and later listed buildings

**What:** whether a place lies by or in a protected area, and later, whether the home or the
buildings around it are listed or worth preserving. The user asked for both on 2026-10-09.

Both cut two ways, so each block can be turned around:

- **By a protected area:** nature that stays, and land where nothing will be built. A preference with
  full points close to it.
- **In a protected area:** the protection limits what may be built or changed. For someone who
  wants to build on, that is a requirement: not inside a fredning.
- **A listed home** (fredet), or one worth preserving (bevaringsværdig): character, but rules for
  every change and repair. Some look for it, others avoid it.

**Data:**

- **Protected areas now, as cell values:**
  - Miljøstyrelsen's fredninger, published through Danmarks Miljøportal: Arealdata, and the layer
    `FREDEDE_OMR_BK` in Arealinformation's WMS. WFS is still to check.
  - Natura 2000 and §3 nature from the same portal, CC0 (see `public-data.md`).
- **Listed and preservation-worthy buildings later, per home (milestone 4):**
  - Slots- og Kulturstyrelsen's FBB: about 7,000 listed buildings, and about 360,000 with a SAVE
    value from 1 (the highest) to 9. It is an INSPIRE download (an Atom feed), with no conditions
    stated.
  - FBB closes in 2026. Listed buildings move to a new register. The SAVE values go to the
    municipalities, and KL gathers them in a database in GeoFA.
  - BBR also records whether a building is listed.

**Values:**

| Value | Meaning | Unit |
|---|---|---|
| `protected_area` | Distance to the nearest fredning | m |
| `in_protected_area` | The cell (later the parcel) lies inside a fredning | |
| `natura2000` | Distance to the nearest Natura 2000 area | m |
| `listed` | The home's building is listed (fredet) | |
| `save_value` | The building's SAVE value, 1 (worth most) to 9; missing where it is not assessed | |
| `listed_nearby` | Listed buildings within 300 m: an old, kept setting | buildings |

```
// Near protected nature
let full = slider(300, 0, 5000, 50)    // Full points at (m)
let zero = slider(3000, 0, 20000, 50)  // No points at (m)
ramp(protected_area, full, zero)
```

```
// Free to build: not inside a protected area (a requirement)
!in_protected_area
```

```
// Character: a listed home, or one worth preserving (milestone 4)
listed || save_value <= 4
```

A missing `save_value` is missing data, as everywhere: the last block counts for nothing there as a
preference, and keeps the home as a requirement.

## What this needs, and when

- **Before milestone 4:** the protected areas as cell values, with the other layers from Danmarks
  Miljøportal; they need no data about homes.
- **Milestone 4:**
  - BBR, DAR, MAT and VUR loaded per home, and the listed and preservation-worthy buildings (FBB,
    later the municipalities' SAVE values in GeoFA);
  - the home values and constants above;
  - `match()` in the language;
  - the catalogue blocks for heating (both kinds), room to the neighbours, size, no stairs and the
    age of the building.
- **Milestone 5:** price, days listed and sale history.
- **Each source** gets a line in "About the data" and a job, like the area data.
