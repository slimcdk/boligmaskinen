# Public data beyond the sources in use

Danish (and EU) public data that could enrich the map, checked on the providers' own pages on
2026-10-09. Each source has a short row in [data-sources.md](data-sources.md); this page has the
details. Nothing here is used yet.

**Confidence:**
- **H**: confirmed on the provider's own page.
- **H\***: also queried the live endpoint.
- **M**: partly confirmed.
- **?**: not confirmed.

**Changes on the way:**
- DMI and Klimadatastyrelsen merge into "DMI, Kort og Grunddata" on 1 December 2026, so endpoints
  and terms may move.
- kyst.dk already redirects to Miljøstyrelsen's "Kyster og Klimatilpasning".
- The broadband mapping (Tjekditnet) belongs to Digitaliseringsstyrelsen, not Energistyrelsen.

## Climate and water

| Source | What | Resolution | Access | Licence or terms | In the app | Conf. |
|---|---|---|---|---|---|---|
| Klimadatastyrelsen: Bluespot, Havvand på Land, Flow | Yearly national flood screening: hollows that fill with rain, sea flooding in steps of 0.1 m, flow paths | National rasters from the elevation model (DHM) | FTPS, WMS/WMTS; a free Dataforsyningen user and token | CC BY 4.0 | `sea_flood` at 1 m, `in_bluespot`; screening only | H\* |
| Miljøstyrelsen (formerly Kystdirektoratet) | Flood maps 2024: sea (10 to 10,000-year) and watercourses (10 to 100-year); acute coastal erosion; high-water statistics 2024 | Watercourses on a 40 cm grid; polygons; statistics per tide gauge (PDF) | ZIP and WMS; erosion as WFS | Erosion CC BY 4.0. The flood maps state no licence, and Miljøstyrelsen says they are not for the single property | `flood_return_years`, a coastal-erosion flag | H (flood licence ?) |
| DMI: Klimaatlas v2025a, and the free data | Future climate indicators; observed climate | Klimaatlas on a 1 km grid and per municipality (Excel); the API on a 10/20 km grid and per municipality | Download, ArcGIS REST/WFS; the API needs no key | Klimaatlas: free, also commercially, with "Kilde: DMI Klimaatlas" and its version, unchanged. The API: CC BY 4.0 | `cloudburst_days_2071`, `sun_hours` | H\* |
| GEUS | Jupiter boreholes, water levels and chemistry; the soil map (jordartskort) | Points; 1:25,000 for 88 % of Denmark, 1:200,000 for all | Jupiter download, WMS/WFS; the maps on GEUS Dataverse | GEUS's terms (2023): free, derived products allowed, credit GEUS. The 1:25,000 map v7.1 is CC BY 4.0 | `soil_type` (clay, sand, peat) | H |

## Environment and health

| Source | What | Resolution | Access | Licence or terms | In the app | Conf. |
|---|---|---|---|---|---|---|
| Danmarks Miljøportal, Arealdata | Soil contamination V1/V2, områdeklassificering, §3 nature, Natura 2000, fredninger, drinking-water protection (BNBO); about 1,500 datasets | Parcel polygons | WFS/WMS and Shape/GDB, no login | These layers CC0; the portal's terms are CC0 or CC BY | `on_v2_land`, `in_protected_nature`, `in_bnbo` | H\* |
| DCE air quality 2024, through Miljøportal | Yearly NO₂, PM2.5, PM10, O₃, NH₃, SO₂ | 1 km grid (90,162 cells) | WFS | CC BY 4.0 | `no2`, `pm25` per cell | H\* |
| DCE, "Luften på din vej 2.0" | NO₂, PM2.5, PM10, black carbon, particle number per street (2019) | About 2.5 million addresses | A map only; no download found | None published | Set aside (see data-sources.md) | M |
| Sundhedsstyrelsen's radon map | Share of houses over 200 Bq/m³ (2001 survey) | The 275 municipalities before 2007, five classes | PDF and images only | – | Set aside: too coarse | M (the site blocks automated reading) |
| Miljøstyrelsen, noise 2022 for railways and airports | Lden, Lnight | Contours | MiljøGIS, the same place as road noise | As road noise | Extends the noise block | M |
| Energinet, overhead lines | 132–400 kV lines and their attention zones | Lines | WFS (INSPIRE) | Not stated | `power_line` distance | M |
| Livestock: Landbrugsstyrelsen's CHR, and Plandata's large livestock farms | Herds with animal units, 2000–2024 | Points and polygons | WFS (geodata.fvm.dk); Plandata | CHR not stated; Plandata CC BY 4.0 | `animal_units_1km` (smell) | M\* |
| Sundhedsdatastyrelsen, SOR | Every health unit (general practitioners, pharmacies, dentists) with a location | Points | Nightly CSV/XML, no login | "Freely available", no licence text | `minutes_to_gp`; OSM is fine for pharmacies | H |

## Housing and energy

| Source | What | Resolution | Access | Licence or terms | In the app | Conf. |
|---|---|---|---|---|---|---|
| Energistyrelsen, energy labels | The label, building parts, proposed savings, as XML/PDF | Building and address | Lookup (Tjek Energimærke, Excel for several addresses); the EMOData API only on request (emo-info@ens.dk), with area and municipality endpoints | No public licence | `energy_label` per home (M4/M5) | H (terms ?) |
| Digitaliseringsstyrelsen, Tjekditnet | Highest speed down and up per technology (fibre, coax, DSL, fixed wireless, mobile) | Access address (DAR id and coordinates); also a 100 m GeoTIFF | CSV (June 2026, 382 MB, history from 2016) and an API | Not stated; Digitaliseringsstyrelsen claims database rights and forbids scraping | `has_fibre`, `max_mbit` | H\* (licence ?) |
| Plandata.dk, heat | Heat supply areas (6,275, in 97 municipalities); heat plans' areas for district or individual heating (1,354, in 83 municipalities) | Polygons | The WFS the zone map already comes from | CC BY 4.0 | `district_heating_planned` | H\* |
| Forsyningstilsynet | The price of district heating for a standard house, about 400 suppliers, twice a year | Per supplier | CSV | Not stated | Heating cost through the supplier | M |

Energistyrelsen and Energinet seem to have only static maps of heat; the areas are in Plandata.

## Mobility

| Source | What | Resolution | Access | Licence or terms | In the app | Conf. |
|---|---|---|---|---|---|---|
| Rejseplan Labs | GTFS (about every 14 days, archive since 2025-12-15), stops as CSV; NeTEx/SIRI through the national access point | Stop and trip | Free after a request on Labs. The API: 50,000 calls a month free for non-commercial use; commercial from EUR 5,000 a year | CC BY 4.0; the static data may be used commercially, unchanged | `departures_per_hour_500m` | H |
| Vejdirektoratet, Mastra | Daily traffic, share of lorries, speeds, up to 2026 | Count sites on state roads and in 74 municipalities | WFS, CSV, GeoJSON | CC BY 4.0 | `busy_road_nearby` | H\* |
| Vejdirektoratet, road accidents | Accidents with a place | Points in vejman.dk (for road authorities, researchers and the police); public statistics per municipality | Export from the statistics' charts | – | Set aside: only per municipality | H |

## Schools and people

| Source | What | Resolution | Access | Licence or terms | In the app | Conf. |
|---|---|---|---|---|---|---|
| GeoFA | School districts (theme 5710): 1,366 districts in all 98 municipalities, checked live; also facilities, waterworks areas, chargers | Polygons | WFS `geofa.geodanmark.dk/ows/fkg/fkg` | CC BY 4.0, credit "@geodanmark" | `school_district` | H\* |
| Uddannelsesstatistik (STIL) | Grades, well-being, absence per school | School | An API with a free key | Free, also commercially, with "Kilde: Uddannelsesstatistik.dk", unchanged | `school_grade`, `wellbeing`, through the district | H |
| Danmarks Statistik, StatBank | Per parish: age, origin, socio-economic status, education, commuting. Per postcode: age and sex. Urban areas (BY1–4). Income only per municipality | Parish and postcode | The API | As CC BY 4.0, "Kilde: Danmarks Statistik" | `higher_education_share` per parish | H\* |
| Danmarks Statistik, kvadratnet | Population, daytime population, variables such as income | 100 m cells, merged until 50–150 households | Paid: the night population of all Denmark DKK 42,170 a year excl. VAT, plus DKK 54,821 per variable | A contract | Set aside: the price | H |

## Where to start

1. **Danmarks Miljøportal.** Contamination, protected nature and drinking-water protection are CC0,
   precise to the parcel and need no login. The same portal has DCE's 1 km air quality for 2024
   (CC BY).
2. **Flood and coast.** Klimadatastyrelsen's Bluespot and Havvand på Land (CC BY), with Miljøstyrelsen's
   flood and erosion maps. This is the largest risk for a home buyer. The app must say it is screening.
3. **Rejseplan GTFS.** Departures per hour near each cell, for all of Denmark, under CC BY. Much better
   than OSM's stops.
4. **GeoFA school districts with Uddannelsesstatistik.** Which school a home belongs to, and how that
   school does. National and open with credit.
5. **Facts per address for milestones 4 and 5.**
   - Plandata's heat areas, from a source already in use.
   - Tjekditnet's fibre data, once Digitaliseringsstyrelsen has said yes to showing it per address.
   - Energy labels, through a request for EMOData.

## Sources

The pages these were checked against:

- **Klimadatastyrelsen:** [the merger with DMI](https://www.klimadatastyrelsen.dk/om-klimadatastyrelsen/nyheder/nyhedsarkiv/2026/sep/dmi-og-klimadatastyrelsen-sammenlaegges-til-ny-styrelse); [data for flood warnings](https://www.klimadatastyrelsen.dk/groen-omstilling-og-klimasikring/klimasikring/data-til-klimatilpasning/datagrundlag-til-varsling-af-oversvoemmelser); Dataforsyningen datasets 2692, 2695 and 2698.
- **Miljøstyrelsen (formerly Kystdirektoratet):** [flood data](https://oversvommelse.kyst.dk/webgis-og-data/hent-og-vis-data); [high-water statistics](https://mst.dk/erhverv/kyster-og-klimatilpasning/klimatilpasning/vaerktoejer/hoejvandsstatistikker); [Kystatlas](https://kystatlas.kyst.dk/data/index.html).
- **DMI:** [Klimaatlas data](https://www.dmi.dk/klima-atlas/data-og-rapporter-klimaatlas); [using Klimaatlas](https://www.dmi.dk/klima-atlas/saadanbrugerduklimaatlas); [terms for the free data](https://www.dmi.dk/friedata/guides-til-frie-data/vilkar-for-brug-af-data); [the climate data API](https://www.dmi.dk/friedata/dokumentation/apis/climate-data-api-1).
- **GEUS:** [Jupiter access](https://www.geus.dk/produkter-ydelser-og-faciliteter/data-og-kort/national-boringsdatabase-jupiter/adgang-til-data); [GEUS's terms 2023](https://data.geus.dk/ugdata2d3d/terms_20230919.pdf); the soil map on [GEUS Dataverse](https://doi.org/10.22008/FK2/SQI9ZB).
- **Danmarks Miljøportal:** [terms](https://miljoeportal.dk/dataansvar/vilkaar-for-brug); [Arealdata](https://arealdata.miljoeportal.dk) (catalogue API at `arealdata-api.miljoeportal.dk/datasets`).
- **DCE:** [the 2019 air quality map](https://dce.au.dk/aktuelt/nyheder/nyhed/artikel/danmarkskort-over-luftkvaliteten-i-2019-luften-paa-din-vej); [report SR445](https://dce2.au.dk/pub/SR445.pdf).
- **Sundhedsstyrelsen:** [the radon map](https://www.sst.dk/vidensbase/straalebeskyttelse/fakta-om-ioniserende-straaling/radon-i-boliger/kort-over-radon-i-danmark).
- **Sundhedsdatastyrelsen:** [using SOR](https://sundhedsdatastyrelsen.dk/data-og-registre/nationale-sundhedsregistre/sundhedsvaesenets-organisationsregister/brug-sor-data).
- **Energistyrelsen:** [energy label data](https://ens.dk/analyser-og-statistik/energimaerkningsdata).
- **Digitaliseringsstyrelsen:** [broadband mapping](https://digst.dk/tele/bredbaandsudrulning/bredbaandsdaekning/bredbaandskortlaegning/); [Tjekditnet data extracts](https://tjekditnet.dk/dataudtræk).
- **Plandata.dk:** [WFS](https://geoserver.plandata.dk/geoserver/wfs) (layers `pdk:theme_pdk_forsyningomraade_vedtaget_v` and `pdk:theme_pdk_varmeplansomraade_vedtaget_v`).
- **Forsyningstilsynet:** [district heating prices](https://forsyningstilsynet.dk/analyser-og-tal/forbrugerpriser/fjernvarmepriser).
- **Rejseplanen:** [Rejseplan Labs](https://labs.rejseplan.dk).
- **Vejdirektoratet:** [Mastra on OpenData.dk](https://www.opendata.dk/vejdirektoratet/taellinger-nogletal-mastra); [accident statistics](https://www.vejdirektoratet.dk/viden-og-data/trafiksikkerhed/ulykkestatistik).
- **GeoDanmark:** [terms](https://www.geodanmark.dk/home/vejledninger/vilkaar-for-data-anvendelse/); [getting GeoFA](https://www.geodanmark.dk/home/vejledninger/geofa/hent-geofa/).
- **Uddannelsesstatistik:** [API terms](https://api.uddannelsesstatistik.dk/Terms); [getting started](https://api.uddannelsesstatistik.dk/GetStarted).
- **Danmarks Statistik:** [source credit](https://www.dst.dk/da/Statistik/brug-statistikken/kildeangivelse); [kvadratnet prices](https://www.dst.dk/da/TilSalg/produkter/geodata/kvadratnet); [StatBank API](https://api.statbank.dk).
