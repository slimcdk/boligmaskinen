# Plandata.dk: every theme, and what it says about a home

Plandata.dk holds the plans of every municipality: local plans, the municipal plan's frames and
guidelines, waste-water and heat plans, and more. The map uses one theme today, the zone map. This
page lists all of them, and what each could tell a home buyer. The user pointed at the side menu of
[Plandata's map](https://kort.plandata.dk/spatialmap) on 2026-10-09.

- **Access:** WFS and WMS at `geoserver.plandata.dk/geoserver/wfs`. The capabilities of 2026-10-09
  list 211 layers, which are the themes of the map's side menu.
- **Licence:** CC BY 4.0 for every layer with the municipalities' plans, and for the layers Plan- og
  Landdistriktsstyrelsen owns ([webservices](https://www.plandata.dk/webservices/introduktion-til-webservices)).
- **Status:** most themes come as three layers:
  - `_vedtaget`, adopted;
  - `_forslag`, proposed;
  - `_aflyst`, cancelled.

  A proposal is often the most interesting for a buyer: it is what may come. Layers ending in `_v`
  are views, and those with `_version` or `_med_historik` keep the history.
- **Codelists:** the `codelist` layers explain the codes, such as the uses in the frames.

## Local plans

| Theme | WFS layers | For a home |
|---|---|---|
| Local plans (lokalplaner) | `pdk:theme_pdk_lokalplan_vedtaget`, `_forslag`, `_aflyst`; sub-areas `pdk:theme_pdk_lokalplandelomraade_*` | What may be built on and around a home: use, height, density. A proposed plan next door means building to come |
| Building fields (byggefelter) | `pdk:theme_pdk_byggefelt_*` | Where on a plot buildings may stand |
| Local plans for solar and wind | `pdk:theme_pdk_lokalplan_{vedtaget,forslag,aflyst}_{solcelle,vindmoelle}` | Solar parks and wind turbines planned near a home (see the energy parks in `data-sources.md`) |

## The municipal plan

| Theme | WFS layers | For a home |
|---|---|---|
| Frames (kommuneplanrammer) | `pdk:theme_pdk_kommuneplanramme_vedtaget_v`, `_forslag_v`, and `_alle_*` | The intended use of every area (housing, business, centre, recreation, technical) with its density and height, so what the land around a home will become. Future zone status shows land to be built on |
| Supplements and strategies | `pdk:theme_pdk_kommuneplantillaeg_*`, `pdk:theme_pdk_kommuneplanstrategi_*`, `pdk:theme_pdk_statslige_kommuneplantillaeg_*` | Changes to the plan, including the state's own; recent ones point at change |
| Guidelines (digitale retningslinjer) | `pdk:theme_pdk_digitalretningslinje_*` | The guidelines below as one layer |
| Valuable landscapes | `pdk:theme_pdk_bevaringsvaerdigelandskaber_*`, `pdk:theme_pdk_stoerresammenhaengendelandskaber_*` | Landscape that is meant to stay open: a view that lasts |
| Cultural heritage | `pdk:theme_pdk_kulturhistoriskbevaringsvaerdi_*`, `pdk:theme_pdk_vaerdifuldtkulturmiljoe_*`, `pdk:theme_pdk_specifikgeologiskbevaringsvaerdi_*` | Valuable cultural settings and geology; joins the listed-buildings idea in `block-ideas.md` |
| Nature | `pdk:theme_pdk_naturbeskyttelsesomraade_*`, `pdk:theme_pdk_oekologiskforbindelse_*` | Areas for nature, and the green links between them |
| Forest planting | `pdk:theme_pdk_skovrejsningsomraade_*` | Where forest is wanted (a future forest) or unwanted |
| Low-lying land | `pdk:theme_pdk_lavbundsareal_*` | Wet land that may be given back to nature; also a sign of water |
| Flooding and erosion | `pdk:theme_pdk_oversvoemerosion_*` | The municipalities' risk areas: one more flood signal, with Klimadatastyrelsen and Miljøstyrelsen (`public-data.md`) |
| Groundwater near the surface | `pdk:theme_pdk_terraennaertgrundvand_*` | Wet basements, rising with the climate |
| Noise-loaded areas | `pdk:theme_pdk_stoejbelastetareal_*` | Areas the plan marks as loud, from roads, railways, airports, firing ranges and business |
| Consequence zones | `pdk:theme_pdk_konsekvensomraade_*`, `pdk:theme_pdk_tekniskanlaegkonsekvensomraade_*`, `pdk:theme_pdk_virksomhedsaerligtbeliggenhedskrav_*` | Zones around businesses and plants that smell, make noise or are risky, where homes are kept out |
| Business and production | `pdk:theme_pdk_produktionserhvervsomraade_*` | Heavy business areas |
| Large livestock farms | `pdk:theme_pdk_storehusdyrbrug_*` | Smell, with Landbrugsstyrelsen's CHR (`public-data.md`) |
| Planned roads, railways and plants | `pdk:theme_pdk_planlagttrafikanlaeg_*`, `pdk:theme_pdk_planlagttekniskanlaeg_*` | A motorway, railway or plant to come near a home |
| Transformation | `pdk:theme_pdk_transformationsomraade_*`, `pdk:theme_pdk_omdannelseslandsby_*` | Business areas turning into housing, villages being remade: change ahead |
| Retail | `pdk:theme_pdk_detailhandel_*` | Shopping areas |
| Holiday homes and urban zone to come | `pdk:theme_pdk_byzonesommerhusomraade_*` | Land planned as urban zone or for holiday homes |
| Valuable farmland | `pdk:theme_pdk_vaerdifuldtlandbrugsomraade_*` | Farmland meant to stay farmland |
| Use of water, lakes and coast | `pdk:theme_pdk_anvendelsevandsoekyst_*` | Planned use of the water and the coast |
| Development agreements | `pdk:theme_pdk_udbygningsaftale_*` | Agreements on roads and paths for new development |
| Investigation areas | `pdk:theme_pdk_undersoegelsesomraade_*` | Areas being looked at for something new |
| Overview | `pdk:theme_pdk_kommuneplan_oversigt_*`, `pdk:theme_pdk_kommuneplantillaeg_oversigt_*` | Which plan is in force where |

## Zones and permits

| Theme | WFS layers | For a home |
|---|---|---|
| Zone map | `pdk:theme_pdk_zonekort_v` and its versions | Urban zone, rural zone, holiday homes. **In use** |
| Rural zone permits | `pdk:theme_pdk_landzonetilladelse_*` | Permits given in the rural zone, such as new buildings or changed use, near a home |
| Back to rural zone | `pdk:theme_pdk_tilbagefoerttillandzone_vedtaget_v` | Land returned to rural zone |
| Coastal zone (kystnærhedszonen) | `knz:theme-knz-kystnaerhedszone-polygon` | Within about 3 km of the coast, where building is held back |
| Regional plans | `region:regionplaner` | The old regional plans, before 2007 |

## Supply: heat and waste water

| Theme | WFS layers | For a home |
|---|---|---|
| Heat plans and supply areas | `pdk:theme_pdk_varmeplansomraade_*`, `pdk:theme_pdk_forsyningomraade_*`, `pdk:theme_pdk_forsyningsforbudomraade_*` | District heating planned or not, and areas where a heat source is ruled out (see `public-data.md`) |
| Waste-water plans | `pdk:theme_pdk_spildevandsplan_*`, `pdk:theme_pdk_spildevandsplantillaeg_*`, `pdk:theme_pdk_kloakopland_*` | Sewered or not, and separate sewers to come, which may mean costs for the owner |
| Connection duty | `pdk:theme_pdk_tilslutningspligtomraade_*`, `pdk:theme_pdk_mulighedforudtraedenkloakopland_*` | A duty to connect to the sewer or district heating, or the right to leave the sewer |

## Projects

| Theme | WFS layers | For a home |
|---|---|---|
| Environmental assessments (VVM) | `pdk:theme_pdk_selvstaendig_*_vvm_v`, `pdk:theme_pdk_kommuneplantillaeg_*_vvm_v` | Large projects near a home: roads, plants, livestock, energy |
| Calls for ideas | `pdk:theme_pdk_indkaldideforslag_*` | The first step of a new plan: something may change here |

## In the app

The themes become cell values like the zone map. A proposal (`_forslag`) or a recent supplement
says what may change, which no other source tells. For a start, see "What the plans say will change"
in `block-ideas.md`.
