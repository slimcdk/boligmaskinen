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

- **Protected areas now, as cell values:** done on 2026-10-10, as `protected_area` and `natura2000`
  with the blocks "Near a protected area", "Near protected nature" and the example "Free to build".
  - Miljøstyrelsen's fredninger, published through Danmarks Miljøportal: Arealinformation's WFS has
    them as `dai:fredede_omr`, CC0.
  - Natura 2000 from the same WFS (`dai:habitat_omr` and `dai:fugle_bes_omr`), CC0. §3 nature
    (`dai:bes_naturtyper`, 320,000 areas) is still to come.
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
| `protected_area` | Distance to the nearest fredning; 0 inside one (in use) | m |
| `in_protected_area` | The cell (later the parcel) lies inside a fredning: `protected_area == 0` for now | |
| `natura2000` | Distance to the nearest Natura 2000 area; 0 inside one (in use) | m |
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
// Free to build: not inside a protected area (a requirement; the example "Free to build")
protected_area > 0
```

```
// Character: a listed home, or one worth preserving (milestone 4)
listed || save_value <= 4
```

A missing `save_value` is missing data, as everywhere: the last block counts for nothing there as a
preference, and keeps the home as a requirement.

## What the plans say will change

**What:** what the municipalities plan around a place, from Plandata.dk; every theme is in
[`plandata.md`](plandata.md). Most sources say what is there. The plans also say what is coming, and
only they do: a local plan proposed next door, a road planned through the fields, business turning
into housing, a forest to be planted.

Cell values to start with, each from the adopted (`_vedtaget`) or proposed (`_forslag`) layers:

| Value | Meaning |
|---|---|
| `planned_use` | The use the municipal plan's frame sets: housing, business, centre, recreation, technical, … |
| `proposed_plan_500m` | A proposed local plan within 500 m: `new_local_plan < 500` since 2026-10-10, which also counts the local plans adopted in the last two years |
| `planned_road` | Distance to a planned road or railway (in use since 2026-10-10: the municipal plans' roads and railways, adopted or proposed) |
| `in_noise_area` | The plan marks the area as noise-loaded |
| `in_consequence_zone` | A consequence zone around a business or plant |
| `forest_planned` | Forest planting is wanted here |
| `coastal_zone` | Inside the coastal zone |
| `groundwater_near_surface` | The plan marks groundwater near the surface |

```
// Quiet surroundings that stay quiet: no planned road nearby, and not in a noise-loaded area
let zero = slider(500, 0, 5000, 50)    // No points at (m)
let full = slider(2000, 0, 10000, 50)  // Full points at (m)
!in_noise_area ? ramp(planned_road, zero, full) : 0
```

```
// Nothing big coming next door (a requirement)
!proposed_plan_500m && !in_consequence_zone
```

## Airports and airfields

**What:** distance to airports and airfields, which the user asked for on 2026-10-09. Planes are loud
under the flight paths, and small airfields bring weekend noise too. The other way round, a short trip
to an airport is worth something. "Turn around" gives both.

**Data:**

- **OpenStreetMap,** in use already: `aeroway=aerodrome` covers airports, airfields, glider fields and
  military air stations, with `aerodrome:type` to tell them apart.
- **Naviair's AIP** (AD 1.1) is the official list of Danish aerodromes.
- **Noise:**
  - Miljøstyrelsen's noise mapping of airports (EU noise directive);
  - Plandata's noise-loaded areas, which include airports and air stations;
  - Forsvaret's noise zones around Aalborg, Karup and Skrydstrup, for which no national download
    was found.

**Values:**

| Value | Meaning | Unit |
|---|---|---|
| `airport` | Distance to the nearest airport with scheduled flights | m |
| `airfield` | Distance to the nearest airfield of any kind | m |
| `air_station` | Distance to the nearest military air station | m |
| `aircraft_noise` | Aircraft noise, where it is mapped | dB |

```
// Away from airports and airfields
let kind = choice(1, airport, airfield, air_station)  // From
let zero = slider(2000, 0, 20000, 100)                // No points at (m)
let full = slider(8000, 0, 30000, 100)                // Full points at (m)
ramp(kind, zero, full)
## Blocks over the area, from the sources found on 2026-10-09

Ideas for weightings that need no data about homes, so they can come before milestone 4. Some the
user asked for, others follow from the sources in `data-sources.md` and `public-data.md`. Value
names follow `public-data.md` where it already proposes one. "Both ways" means some users want it
close and others far away, so the block is turned around rather than written twice.

| Block | What it weighs | Values | Source | Notes |
|---|---|---|---|---|
| Big wind turbines | Distance to turbines, counting a tall turbine for more than a small one | `turbine` (today), `turbine_height`, or `turbine_big` (distance to turbines over a set total height) | Energistyrelsen's register (height, rotor) | The legal minimum to neighbours is 4 × the total height, so a ramp in "heights away" fits |
| Solar parks | Distance to solar plants over 1 MW | `solar_park` | Energistyrelsen via PLST's "Vedvarende energi" WFS | Both ways: some mind the view, others do not |
| Energy parks to come | Distance to designated or planned energy parks, wind and solar | `energy_park_planned` | PLST's state-designated energy parks; municipal plans (Plandata) | What will be built matters as much as what stands. Also offshore wind areas, as a view from the coast |
| Soft or hard water | Drinking water hardness at the home's supply area | `water_hardness` (°dH) | GEUS, hardness per supply area | A preference for soft water; a requirement under a set hardness |
| Clean drinking water | PFAS and nitrate in the waterworks' water | `pfas` (ng/l, sum of 4), `nitrate` (mg/l) | GEUS Jupiter | A requirement under the limit values, or a ramp below them |
| Height and slope | Height above sea level and how steep the land is | `elevation` (m), `slope` (°) | Danmarks Højdemodel | High ground for flood safety or a view; flat land for a garden or a bike |
| Low-lying land | Hollows that fill in a cloudburst, and land the sea reaches | `bluespot_depth` (m), `sea_flood_level` (the sea rise in m that reaches the cell) | Klimadatastyrelsen: Bluespot, Havvand på Land | Joins `flood_risk` above; `sea_flood_level` lets the user pick a scenario with a slider |
| Radon | The share of houses over 100 Bq/m³ | `radon` (share, per municipality) or `radon_soil` (by soil type) | BUILD's 2022 survey; GEUS soil map with its radon classes; or DinGeo per address | Coarse at first; the soil-based value is our own estimate and says so |
| Few burglaries | Home burglaries per 1,000 homes | `burglaries` (per municipality today; per postcode if DST has it) | DST STRAF22; the scene's postcode in DST's crime statistics | Finer data replaces the coarse one without changing the block |
| Vulnerable housing areas | Distance to an area on the government's yearly list | `vulnerable_area` (m) | Social- og Boligministeriet's list and the parcels in its executive order | A political label, not a measure of crime: needs care in how it is named and shown |
| Quiet roads, safe for children | Traffic on the nearest road: cars per day, the share of lorries, the share driving too fast | `traffic_aadt`, `traffic_lorries`, `traffic_speeding` | Vejdirektoratet's Mastra counts | Points on roads, so it needs a road network to spread them onto; the noise map covers some of it |
| Clean air | Yearly NO₂ and PM2.5 | `no2`, `pm25` (µg/m³) | DCE's model for 2024, 1 km grid | Finer per street in Copenhagen (Air View) |
| Away from power lines | Distance to 132–400 kV overhead lines | `power_line` (m) | Energinet | A requirement or a ramp |
| No smell from livestock | Animal units within 1 km | `animal_units_1km` | Landbrugsstyrelsen's CHR; Plandata's large livestock farms | Both ways: country life for some |
| Rail noise | Lden from railways | `noise_rail` (dB) | Miljøstyrelsen's noise mapping 2022 | Adds to today's road noise, or one `noise_all`; aircraft noise is `aircraft_noise` above |
| A doctor nearby | Minutes to the nearest general practitioner | `minutes_to_gp` | Sundhedsdatastyrelsen's SOR | Also pharmacies and dentists |
| Playgrounds and outdoor life | Distance to a playground, and to outdoor facilities (shelters, paths, fishing) | `playground`, `outdoors` (m) | GeoFA; OSM to fill the gaps | GeoFA has playgrounds from 62 municipalities only |
| Charging an electric car | Distance to a public charger | `charger` (m) | GeoFA (37 municipalities); OSM | |
| Trees | The share of the cell under tree crowns | `tree_cover` (%) | Copenhagen's crown map; nationally from the elevation model's surface minus terrain, or GeoDanmark | Different from `forest`: trees in streets and gardens count |
| Building plots for sale | Plots on sale, with price and size | `plot_for_sale` (m), `plot_price` | Vejle, Silkeborg and Egedal on opendata.dk | For people who want to build; few municipalities so far |
| Change coming nearby | A new local plan close by: building to come | `proposed_plan_500m`, `planned_use` | Plandata | See "What the plans say will change" above. Both ways: new shops and paths, or building sites and more traffic |
| District heating | Inside a district heating area, and its price | `district_heating` (in use since 2026-10-10: the distance to a district heating supply area, 0 inside), `heat_price` (kr. a year for a standard house) | Plandata's heat supply areas; Forsyningstilsynet's prices | Fits the heating blocks above |
| Fast broadband | The highest speed at the addresses in the cell | `broadband_down` (Mbit/s) | Tjekditnet | Per cell first; per address later, asked before showing it |
| A view of the water | Whether sea or a lake can be seen from the cell | `water_view` | Our own: the elevation model and the coastline, a viewshed job | Heavy to compute; a simpler start is height above the nearest coast within 2 km |
| Dark nights | Little light at night | `night_light` | To find: satellite night lights (VIIRS) or similar | For people who want to see the stars |
| Neighbours with an education | The share of adults with a further education in the parish | `education_higher` (%) | DST KMST007A per parish | Both ways. Small parishes are noisy: smooth over neighbours |
| Neighbours at work | The share employed in the parish | `employed` (%) | DST KMSTA005 per parish | |
| Young or quiet neighbourhood | Mean age in the parish; households with children in the town | `mean_age` (years), `families_with_children` (%) | DST KMGALDER per parish; BY4 per town | Both ways: playmates for children, or calm |
| City or country | People per km² in the town, or none outside towns | `density` (people/km²) | DST BY3 per town | Both ways |
| Busy by day, quiet by night | Day population against night population in the parish | `day_night_ratio` | DST KMSTA009 per parish | High in work areas, low in dormitory towns |
| A growing municipality | Population forecast to 2050 | `growth_2050` (%) | DST FRKM126 | Growing towns keep schools and shops |
| How the area votes | Party shares in the polling district at the last general election | `vote_<party>` (%) | DST FV26TOTA | Possible but sensitive; offer it only as the user's own choice, never as a predefined block |
| Kinds of crime | Violence, vandalism, theft and burglary per 1,000 inhabitants, quarterly | `crime_violence`, `crime_vandalism`, … | DST STRAF11 per municipality | Coarse; extends `burglaries` |
| Childcare and schools by the numbers | Childcare price, children per adult, and class size | `childcare_price` (kr. a month), `childcare_ratio`, `class_size` | DST RES88, BOERN8, KVOTIEN per municipality | Per institution later from the registers |
| Income in the area | Mean income | `income` (kr.) | DST INDKP101 per municipality (free); per parish or postcode only paid | Both ways |
| Fewer cars | Cars per household | `cars_per_household` | DST BIL800 per municipality | A rough proxy for how well a place does without a car |

Not a block: residents' origin (DST KMSTA001 per parish). Weighing a place by its residents' origin would be discrimination in housing, so it is left out on purpose.

```
// Away from big turbines: full points from 10 heights away
let full = slider(10, 4, 30, 1)  // Full points from (heights)
let zero = slider(4, 0, 30, 1)   // No points up to (heights)
ramp(turbine / turbine_height, full, zero)
```

```
// Soft water
let full = slider(8, 0, 30, 1)   // Full points up to (°dH)
let zero = slider(20, 0, 30, 1)  // No points from (°dH)
ramp(water_hardness, full, zero)
```

```
// Dry in a storm surge: the sea has to rise this much to reach the cell
let rise = slider(2, 0, 5, 0.1)  // Sea rise (m)
sea_flood_level > rise
```

## What this needs, and when

- **Before milestone 4:** these need no data about homes:
  - the protected areas as cell values (done 2026-10-10), and the other layers from Danmarks
    Miljøportal;
  - the plans' cell values from Plandata;
  - the distances to airports and airfields from OSM;
  - the blocks over the area found on 2026-10-09, each once its source is fetched by a job.
- **Milestone 4:**
  - BBR, DAR, MAT and VUR loaded per home, and the listed and preservation-worthy buildings (FBB,
    later the municipalities' SAVE values in GeoFA);
  - the home values and constants above;
  - `match()` in the language;
  - the catalogue blocks for heating (both kinds), room to the neighbours, size, no stairs and the
    age of the building.
- **Milestone 5:** price, days listed and sale history.
- **Each source** gets a line in "About the data" and a job, like the area data.
