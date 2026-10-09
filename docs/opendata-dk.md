# OpenData.dk: what it offers Boligmaskinen

Status as of 2026-10-09. A survey of every dataset on [OpenData.dk](https://www.opendata.dk/), the
portal run by Open Data DK, an association of Danish municipalities and regions: which datasets
can be placed on the map, how well they cover Denmark, and what they could add to the blocks.
[Data sources](data-sources.md) lists what the pilot uses today; this file only adds to it.

The raw API dumps and the scripts behind the counts are not in the repository. Every number below
comes from the portal's API or from the services it links to, called on 2026-10-09; the links
show where.

## Summary

- **631 datasets** from **20 publishers** ([`package_search`](https://admin.opendata.dk/api/3/action/package_search?rows=0)).
  - 51 organisations are registered, but 31 of them have no datasets, among them Esbjerg, Herning,
    Gladsaxe and Region Syddanmark ([`organization_list`](https://admin.opendata.dk/api/3/action/organization_list?all_fields=true&include_dataset_count=true)).
  - The publishers are 14 municipalities, 2 regions, GeoDanmark, Vejdirektoratet and Open Data DK
    itself, which also files links to other portals under "Andres data".
  - Three municipalities hold 67 % of everything: København 216, Aarhus 121 and Vejle 87.
- **478 datasets can be placed on a map. 153 cannot.**

| Class | Datasets |
|---|---|
| Native geodata (a file or a service in a geo format) | 353 |
| Geodata only behind a link (a web map or another portal) | 47 |
| Locatable tabular data (coordinates, addresses, WKT, area names or codes) | 78 |
| Not locatable | 153 |
| **Total** | **631** |

- **Coverage is the problem.**
  - A few datasets are national: GeoFA and Mastra (below), a 2015 extract of the health-care
    register SOR, and the GuideDanmark tourism database. "Andres data" also links to national
    registers (Dagtilbudsregisteret, Institutionsregisteret, Plandata.dk, Tjekditnet.dk). Every
    other dataset covers one municipality.
  - Of the 98 municipalities, 14 publish anything at all. Most themes are found in only one to
    five of them.
  - Much of it is old. 346 datasets were added to the catalogue in 2016, and many files were last
    touched in 2015–2018.
  - Most endpoints still answer: 326 of the 353 native datasets returned data. But many of them
    serve a layer that was uploaded once and not touched since. København's harvested datasets
    are the main exception.
- **The portal is mostly useful as a pointer.** The best finds are national sources that are listed
  on it, or that its municipal datasets point to:
  1. **Traffic counts for most of Denmark** (Vejdirektoratet's
     [Trafiktællinger – Nøgletal](https://www.opendata.dk/vejdirektoratet/taellinger-nogletal-mastra)
     and [Trafikstøj](https://www.opendata.dk/vejdirektoratet/stojdata-mastra), from Mastra).
     - 47,488 count points with annual daily traffic, mean speed, speeding share and the share of
       lorries.
     - They cover state roads and 74 municipalities, for 2006–2026.
     - Not in data-sources.md yet. It is the strongest new layer: traffic and heavy-traffic
       exposure per cell.
  2. **GeoFA (Geografiske fagdata i GeoDanmark)** ([dataset](https://www.opendata.dk/geodanmark/geofa)).
     A national database of municipal themes in one uniform model, CC BY 4.0. Measured today:
     - school districts from all 98 municipalities (1,409 polygons);
     - 32,577 outdoor facility points, among them 1,133 playgrounds in 62 municipalities, 2,289
       toilets, 1,837 shelters and 543 bathing sites;
     - 35,621 EV charging points in 37 municipalities;
     - 363,396 SAVE building ratings in 80 municipalities.
     - data-sources.md already plans school districts from GeoFA. The playgrounds, the SAVE
       ratings and the EV charging are new.
  3. **Local plans for all of Denmark** on the Plandata.dk WFS that the pilot already uses for zones.
     - 38,051 adopted local plans and 51,003 municipal plan frames.
     - It also has areas designated for flooding and erosion, and noise-affected areas.
     - The municipal local-plan files on OpenData.dk are older extracts of the same plans.
- **Single-municipality datasets worth knowing about**, mainly for a richer view of København:
  - per-dwelling road noise 2022 (338,023 features, [Vejstøj 2022](https://www.opendata.dk/city-of-copenhagen/vejstoej_2022));
  - 75,033 municipal trees ([Træ basis](https://www.opendata.dk/city-of-copenhagen/trae-basis-kommunale-traeer)) and a
    2024 tree-canopy raster ([Trækronedække 2024](https://www.opendata.dk/city-of-copenhagen/traekronedaekke-2024-for-kobenhavn));
  - street-level air pollution ([Copenhagen Air View](https://www.opendata.dk/city-of-copenhagen/airview), NO2 per ~30 m
    of street);
  - the 100-year storm surge in 2110 ([100 års stormflod](https://www.opendata.dk/city-of-copenhagen/100-ars-stormflod)),
    and the cloudburst plan;
  - the vulnerable urban areas ([Udsatte byområder](https://www.opendata.dk/city-of-copenhagen/udsatte-byomrader)).
- **Elsewhere:**
  - building plots for sale in Vejle ([Parcelhusgrunde til salg](https://www.opendata.dk/city-of-vejle/parcelhusgrunde-til-salg)),
    Silkeborg ([Grundsalg](https://www.opendata.dk/silkeborg-kommune/silkeborg-grundsalg), with price, area and status)
    and Egedal;
  - socio-economic data per statistical district in Aarhus, 2016–2021
    ([2021](https://www.opendata.dk/city-of-aarhus/sociooekonomiaarhus2021)), and per school district in Hedensted
    (2011–2018);
  - Aarhus's address table ([Aarhus adressedimension](https://www.opendata.dk/city-of-aarhus/aarhus-adressedimension),
    56,500 rows with lat/lon). It maps every address to its school district, care district,
    statistical district, parish and polling district.
- **Nothing on radon, crime or contaminated land.** None of the 631 datasets covers them.

## The portal and its API

- **Where it is.**
  - `www.opendata.dk` is a front end (Express). It shows each dataset at
    `https://www.opendata.dk/<organisation>/<dataset name>`, and links to the same datasets with
    `/dataset/<name>` redirect there.
  - The catalogue behind it is **CKAN 2.11.5** at `https://admin.opendata.dk`
    ([`status_show`](https://admin.opendata.dk/api/3/action/status_show)).
  - The address in the portal's own terms, `portal.opendata.dk`, answers `/api/3/action/...` with a
    302 redirect to `admin.opendata.dk`.
  - The API is open without a key. CKAN's `noanonaccess` extension is loaded, but reading the API
    works anonymously.
- **Endpoints used.** All were called sequentially, with a delay between calls:
  - [`package_search?rows=100&start=…&sort=name asc`](https://admin.opendata.dk/api/3/action/package_search?rows=100&start=0&sort=name%20asc):
    7 pages, 631 of 631 datasets.
  - [`package_list`](https://admin.opendata.dk/api/3/action/package_list): 638 names.
    - The 7 extra are harvest sources (`type: harvest`), such as
      [`ringkobing-skjern`](https://admin.opendata.dk/api/3/action/package_show?id=ringkobing-skjern).
      It harvests `https://opendata.rksk.dk/data.json` but has produced no datasets.
    - So the 631 are complete.
  - [`organization_list?all_fields=true`](https://admin.opendata.dk/api/3/action/organization_list?all_fields=true&include_dataset_count=true),
    [`group_list`](https://admin.opendata.dk/api/3/action/group_list?all_fields=true) and
    [`license_list`](https://admin.opendata.dk/api/3/action/license_list).
  - `datastore_search?limit=2&resource_id=…`: 525 resources sit in CKAN's datastore, so their
    columns can be read without a download.
  - `package_show?id=<name>`: each dataset's full record, for any dataset below.
- **Licences.** The portal's terms ask publishers to use CC0, or CC BY where there is reason to
  ([Vilkår og betingelser, 16 March 2023](https://www.opendata.dk/open-data-dk/vilkar-og-betingelser-for-udgivelse-af-abne-data-via-open-data-dk)).
  - Most datasets are CC BY 4.0, but the licence is set per dataset. Of the 631:
    - 559 are CC BY 4.0;
    - 8 are CC0;
    - 1 each is "Other (Open)", CC BY-NC 4.0 and ODC-BY 1.0;
    - **61 state no licence** (42 have none, 19 an empty value). Among them are København's newest
      layers: tree canopy 2024, `Træ basis`, `Trafiktal` and the 100-year storm surge.
  - A dataset without a licence is not clearly open; ask the publisher before relying on it.
  - **Credit under CC BY 4.0:** name the publisher, link the licence, and say that we changed the
    data, like the other CC BY sources in "About the data".
  - GeoFA is CC BY 4.0 with the credit "@geodanmark", linked to
    [GeoDanmark's terms page](https://www.geodanmark.dk/home/vejledninger/vilkaar-for-data-anvendelse/).
  - Vejdirektoratet's Mastra datasets are CC BY 4.0.
- **Traps.**
  - **`metadata_modified` says little.**
    - 329 datasets carry 2023-12-04 and 173 carry 2024-08-01. These are bulk edits to the catalogue,
      not new data.
    - The tables below give the newest resource date instead (`last_modified`, else `created`).
    - That too can be wrong both ways:
      - Aarhus's daycare and pupil tables in the datastore say "Opdateret 2025-08-07" inside the
        data, while their resource dates say 2019–2020.
      - A WFS link is as fresh as the service behind it, whatever the date says.
  - **Uploads redirect to pre-signed Cloudflare R2 URLs that expire after 60 seconds**
    (`/dataset/…/download/…` answers 302).
    - Follow redirects, and never store the final URL.
    - The stable URL is the `admin.opendata.dk` one.
  - **Formats are labels, not facts.**
    - Vejle's and Egedal's "JSON" resources are GeoJSON in EPSG:25832.
    - Aarhus's "XML" supercykelsti is a WFS GetFeature.
    - København's "ZIP" tree canopy and vegetation cover are GeoTIFFs.
    - Randers's wetland "CSV" carries polygons as WKT.
    - Many København "LINK" resources open the kbhkort web map, not data. Several of those layers
      exist in København's WFS
      ([`wfs-kbhkort.kk.dk/k101/ows`](https://wfs-kbhkort.kk.dk/k101/ows?service=WFS&request=GetCapabilities&version=2.0.0),
      477 layers): `fredede_bygninger_save`, `ikoniske_traer_vedtaget`, `partnerskabstraer`,
      `dagpleje_omraader`, `kkorg_plejehjem` and `fortidsminder`.
    - The WFS also has layers that are not on the portal at all, such as `skolegrunddistrikt`.
  - **Coordinate systems are mixed.** Where a check saw one:
    - most of København's, Aarhus's, Vejle's and Vejdirektoratet's GeoJSON is in EPSG:25832;
    - Ballerup's GC2 layers and 16 København WFS links ask for EPSG:4326;
    - the SOR files carry UTM `P_X`/`P_Y`;
    - Aarhus's tables have `lat`/`lng`.
  - **Paging.**
    - The Mastra WFS returns at most 3,000 features per request; page or filter with CQL.
    - GeoFA's SQL API (`https://geofa.geodanmark.dk/api/v2/sql/fkg?q=…`) returns public rows only
      (it adds `off_kode = 1` to queries).
  - **Endpoints die.**
    - One primary resource per dataset with geodata was requested (first 16 KB, then a retry with
      the URL encoded and a longer timeout).
    - Result for the 353 native datasets:
      - 324 answered with data;
      - 2 more (GeoFA) work through their WFS and SQL API, which were queried directly;
      - 10 answered 503;
      - 7 returned a service error;
      - 6 point at layers that are gone;
      - 2 answered 400 and 1 answered 404;
      - 1 has no URL.
    - The failures are marked in the tables:
      - Horsens's GeoServer (`geoservice.horsens.dk`) answered 503 for 9 Horsens datasets.
      - Five København WFS layers are gone ("Feature type unknown"): `Læskærm`, `Pladselementer`,
        both `Stednavne` and `Test af DCAT`.
      - Silkeborg's school districts point at a schema that no longer exists.
      - Vejle's ArcGIS queries for the six BBR extracts and the toilets fail.
      - Two Aarhus WFS layers answer 400, and Randers's parking WFS answers 404.
      - København's contour-line CAD download answers 503.
    - Two København links have broken URLs: `http://http://…`, and the internal host `kkkort`.
      Frederiksberg's school-district resource has an empty URL.
  - **Titles can mislead.** The "Region Midt" SOR datasets (GPs, dentists, specialists,
    physiotherapists, emergency rooms) hold the whole country, as an extract from 11 May 2015
    (file names `sor_*_20150511`). For example, the first row of
    [Lægepraksis i Region Midt](https://www.opendata.dk/region-midtjylland/laegepraksis-i-region-midt1) is a practice in
    Gilleleje. That
    is stale; the notes point to the live SOR at Statens Serum Institut.

## Themes ranked by relevance for home search

Each theme says:

- whether data-sources.md already covers it ("in use", "planned" or "new");
- what exists nationally;
- how it would become a block.

The tables list every locatable dataset in the theme. "Class" is:

- **native**: a file or service in a geo format;
- **link only**: a web map or another portal;
- **tabular**: coordinates, addresses or area names in a table.

"Check" is the endpoint check above. "Sampled" means the columns were read from the datastore or
the file's head.

### High relevance

#### Traffic counts, speeds and road classes — new

- **National:** Mastra on Vejdirektoratet's GeoServer, CC BY 4.0, EPSG:25832.
  - `OPEN_DATA_NOEGLETAL_VIEW`: 47,488 points
    ([hits](https://vmgeoserver.vd.dk/geosmastra/opendata/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=OPEN_DATA_NOEGLETAL_VIEW&resultType=hits)),
    for the years 2006–2026; 24,695 of them were counted in 2023 or later.
    - Fields include `AADT`, `HDT`, `GNS_HASTIGHED`, `HAST_GRAENSE`, `PCT_OVER_HASTGR`, `LBIL_PCT`
      and `TRAFIKTYPE`.
    - Vejdirektoratet's [list](https://vej08.vd.dk/pls/mastra/mastra_gis.opendata_pkg.kommuner_med_trafikdata)
      names 74 municipalities that publish counts.
  - `OPEN_DATA_STOEJDATA_VIEW`: 27,974 points with hourly volumes and speeds by day, evening and
    night, from 59 municipalities
    ([list](https://vej08.vd.dk/pls/mastra/mastra_gis.opendata_pkg.kommuner_med_stoejdata)).
- **Municipal:** København's `Trafiktal` (count points with annual daily traffic, updated March 2026)
  and `Trafikhastigheder` (speed limits per street) add detail for the capital.
- **Block:**
  - snap each count to the road it lies on;
  - give each cell the highest AADT, or the lorry AADT, of the roads within 50–100 m;
  - then a ramp: "quiet street" ↔ "busy road".
  - It measures traffic directly, next to the modelled noise.
  - Speeding share near schools is a possible "safe way to school" input.
  - Counts are points, not a network, so the snapping needs a road network (OSM or GeoDanmark).

**Coverage on the portal:** 28 datasets; 7 municipalities (Aarhus, Horsens, København, Randers, Silkeborg, Syddjurs, Vejle); also "Andres data", Vejdirektoratet.

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [Dataudveksleren](https://www.opendata.dk/andres-data/dataudveksleren) | link only | portal | HTML | 2021-11 | link ok |
| Aarhus | [Hastighedsmålinger - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/hastighedsmalinger-aarhus-kommune) | tabular | road name + location text | ODS, XLSX | 2017-11 | sampled |
| Aarhus | [Trafiktal - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/trafiktal-aarhus-kommune) | tabular | road name + location text | ODS, XLSX | 2017-11 | sampled |
| Horsens | [Trafiktallinger i Horsens Kommune](https://www.opendata.dk/horsens-kommune/trafiktaelling-horsens-kommune) | native | point | CSV, GeoJSON, GML | 2022-01 | ok |
| København | [Ensrettede gader](https://www.opendata.dk/city-of-copenhagen/ensrettede-gader) | native | line/point | CSV, GeoJSON, SHP | 2015-10 | ok |
| København | [Faste cykeltællinger](https://www.opendata.dk/city-of-copenhagen/faste-cykeltaellinger) | tabular | counting-station id | XLSX | 2020-01 |  |
| København | [Historiske trafiktællinger](https://www.opendata.dk/city-of-copenhagen/faste-trafiktaellinger) | tabular | counting-station id | XLSX | 2020-01 |  |
| København | [Trafik, pullert](https://www.opendata.dk/city-of-copenhagen/pullert) | native | line/point | CSV, GeoJSON, SHP | 2015-11 | ok |
| København | [Trafikhastigheder](https://www.opendata.dk/city-of-copenhagen/trafikhastigheder) | native | line/point | CSV, GeoJSON, SHP | 2016-01 | ok |
| København | [Trafiksignaler](https://www.opendata.dk/city-of-copenhagen/trafiksignaler) | native | line/point | CSV, GeoJSON, SHP | 2016-01 | ok |
| København | [Trafikskilte](https://www.opendata.dk/city-of-copenhagen/trafikskilte) | native | line/point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Trafiktal](https://www.opendata.dk/city-of-copenhagen/trafiktal) | native | line/point | CSV, GeoJSON, SHP, XLSX | 2026-03 | ok |
| København | [Transitruter](https://www.opendata.dk/city-of-copenhagen/transitruter) | native | line/point | CSV, GeoJSON, SHP | 2015-04 | ok |
| København | [tryghedszoner_skoler](https://www.opendata.dk/city-of-copenhagen/tryghedszoner_skoler) | native | polygon | GeoJSON | 2025-12 | ok |
| København | [Tællestationer, trafiktællinger](https://www.opendata.dk/city-of-copenhagen/taellestationer) | native | line/point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Tælling løb](https://www.opendata.dk/city-of-copenhagen/taelling-lob) | native | line/point | CSV, GeoJSON, SHP | 2015-09 | ok |
| København | [Tællinger, fodgængere](https://www.opendata.dk/city-of-copenhagen/taelling_fodg) | native | line/point | CSV, GeoJSON, SHP | 2015-09 | ok |
| København | [Tællinger, kryds](https://www.opendata.dk/city-of-copenhagen/taellinger-kryds) | tabular | counting-station id | XLS, XLSX | 2020-01 |  |
| København | [Tællinger, ophold](https://www.opendata.dk/city-of-copenhagen/opholdstaellinger) | native | line/point | CSV, GeoJSON, SHP | 2015-11 | ok |
| København | [Tællinger, snittællinger](https://www.opendata.dk/city-of-copenhagen/taellinger-snittaellinger) | tabular | counting-station id | XLS | 2020-01 |  |
| København | [Vejklasser](https://www.opendata.dk/city-of-copenhagen/vejklasser) | native | line/point | CSV, GeoJSON, SHP | 2015-04 | ok |
| København | [Vesterbrogade tællinger](https://www.opendata.dk/city-of-copenhagen/vesterbrogade-taellinger) | tabular | counting-station id | XLS, XLSX | 2020-01 |  |
| Randers | [Antal krydsende cyklister over Randers Fjord](https://www.opendata.dk/randers-kommune/antal-krydsende-cyklister-over-randers-fjord) | tabular | single counting site | CSV | 2023-02 |  |
| Silkeborg | [Trafiktællinger i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/trafiktaellinger-silkeborg) | native | point/line | CSV, GeoJSON, SHAPE | 2017-11 | ok |
| Silkeborg | [Vejmidte trafikmodel i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/vejmidte-trafikmodel) | native | point/line | GeoJSON, SHAPE, WFS | 2017-05 | ok |
| Syddjurs | [Trafiktællinger](https://www.opendata.dk/syddjurs-kommune/syddjurs-trafiktaellinger) | native | point | WFS | 2016-12 | ok |
| Vejdirektoratet | [Trafiktællinger – Nøgletal](https://www.opendata.dk/vejdirektoratet/taellinger-nogletal-mastra) | native | point (state roads + 74 municipalities) | CSV, GeoJSON, SHAPE, XLSX | 2019-05 | ok |
| Vejle | [Trafiktal](https://www.opendata.dk/city-of-vejle/trafiktal1) | native | point/line | JSON, KMZ, WFS, WMS | 2015-05 | ok |

#### School districts — planned (GeoFA), confirmed

- **National:** GeoFA `fkg.t_5710_born_skole_dis`, 1,409 polygons from all 98 municipalities
  ([Skoledistrikter (98 kommuner)](https://www.opendata.dk/geodanmark/skoledistriktsdata)).
  - Edited continuously (newest edit today):
    [count](https://geofa.geodanmark.dk/api/v2/sql/fkg?q=SELECT%20count(*)%20n%2C%20count(distinct%20cvr_kode)%20k%20FROM%20fkg.t_5710_born_skole_dis).
  - Available as WFS `https://geofa.geodanmark.dk/ows/fkg/fkg` (EPSG:25832) or through the SQL
    API, which can return GeoJSON.
  - Fields: district number and name, district type, first and last grade.
- **Municipal:** the five municipal files below, and København's `skolegrunddistrikt` WFS layer
  (57 features), are older copies of the same thing.
- **Block:** `district_school`, as in [block ideas](block-ideas.md). Each cell or home gets its
  district school, then the school's grades and well-being from uddannelsesstatistik.dk.

**Coverage on the portal:** 7 datasets; 5 municipalities (Aarhus, Frederiksberg, Hedensted, Silkeborg, Vejle); also GeoDanmark.

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Skoledistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/skoledistrikter-i-aarhus) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Frederiksberg | [Skoledistrikter](https://www.opendata.dk/city-of-frederiksberg/skoledistrikter_frederiksberg) | native | polygon | GeoJSON | 2026-02 | no URL |
| GeoDanmark | [Skoledistrikter (98 kommuner)](https://www.opendata.dk/geodanmark/skoledistriktsdata) | native | polygon (national GeoFA) | API, HTML, WFS, WMS, SQL API | 2023-08 | ok (WFS and SQL API queried) |
| Hedensted | [Skoledistrikter i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/skoledistrikter-i-hedensted-kommune) | native | polygon | GeoJSON | 2018-01 | ok |
| Silkeborg | [Børnedistrikter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-bornedistrikter) | native | polygon | CSV, GeoJSON, SHAPE | 2016-10 | ok |
| Silkeborg | [Skoledistrikter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-skoledistrikter) | native | polygon | CSV, GeoJSON, SHAPE | 2016-06 | layer gone |
| Vejle | [Skoledistrikter i Vejle Kommune](https://www.opendata.dk/city-of-vejle/skoledistrikter-i-vejle-kommune) | native | polygon | JSON, KML, WFS, WMS | 2015-11 | ok |

#### Schools, daycare — in use (STIL)

- **National:** the pilot already uses STIL's Institutionsregisteret and Dagtilbudsregisteret
  (both also listed here under "Andres data").
- **What the municipal data adds:** capacity and enrolment.
  - Aarhus's datastore tables give pupils per school (`Elevtal`, 49 rows) and children per
    daycare unit (`Børn i dagtilbud`, 290 rows).
  - Both have coordinates and were refreshed in August 2025.
- **Block:** none new; at most a "large or small school" note in Aarhus.

**Coverage on the portal:** 9 datasets; 6 municipalities (Aarhus, Hedensted, Horsens, København, Randers, Vejle); also "Andres data".

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [Institutionsregistret](https://www.opendata.dk/andres-data/institutionsregistret) | link only | point (national register) | HTML | 2019-10 | link ok |
| Aarhus | [Børn og unge enheder i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/born-og-unge-enheder-i-aarhus-kommune) | tabular | point (lat/lon) | CSV | 2017-11 | sampled |
| Aarhus | [Elevtal på Aarhus Kommunes folkeskoler](https://www.opendata.dk/city-of-aarhus/elevtal) | tabular | point (lat/lon) | CSV, JSON | 2020-03 | sampled |
| Hedensted | [Skoler og daginstitutionsdata](https://www.opendata.dk/hedensted-kommune/skoler-og-daginstitutionsdata) | native | point | GeoJSON, JSON, SHAPE, XLSX | 2016-12 | ok |
| Horsens | [Skoler](https://www.opendata.dk/horsens-kommune/horsens-skoler) | native | point | CSV, GeoJSON | 2017-12 | HTTP 503 |
| København | [Skoler](https://www.opendata.dk/city-of-copenhagen/skoler) | tabular | point (UTM x/y + WKT) | CSV | 2020-01 | sampled |
| Randers | [Skoler](https://www.opendata.dk/randers-kommune/skoler_randers) | native | point | KML, WFS | 2020-06 | ok |
| Vejle | [Elevtalsprognose 2014/15 – 2028/29 fordelt på folkeskoler](https://www.opendata.dk/city-of-vejle/elevtalsprognose-2014-15-2028-29-fordelt-pa-folkeskoler) | tabular | school name | XLSX | 2018-06 |  |
| Vejle | [Skoler](https://www.opendata.dk/city-of-vejle/skoler1) | native | point | JSON, KML, WFS, WMS | 2015-11 | ok |

**Coverage on the portal:** 9 datasets; 6 municipalities (Aarhus, Frederiksberg, Horsens, København, Silkeborg, Vejle); also "Andres data".

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [Dagtilbudsregisteret](https://www.opendata.dk/andres-data/dagtilbudsregisteret) | link only | point (national register) | HTML | 2020-02 | link ok |
| Aarhus | [Børn i dagtilbud](https://www.opendata.dk/city-of-aarhus/born-i-dagtilbud) | tabular | point (lat/lon) | CSV, JSON | 2020-05 | sampled |
| Frederiksberg | [Dagtilbud](https://www.opendata.dk/city-of-frederiksberg/dagtilbud_frederiksberg) | native | point | GeoJSON | 2020-03 | ok |
| Horsens | [Daginstitution](https://www.opendata.dk/horsens-kommune/daginstitution) | native | point | CSV, GeoJSON | 2017-12 | HTTP 503 |
| Horsens | [Fritidsklubber](https://www.opendata.dk/horsens-kommune/horsens-fritidsklub) | native | point | CSV, GeoJSON | 2017-12 | HTTP 503 |
| København | [Daginstitutioner](https://www.opendata.dk/city-of-copenhagen/daginstitutioner) | native | point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Dagplejeområder](https://www.opendata.dk/city-of-copenhagen/dagplejeomrader) | link only | web map | LINK | 2019-01 | link ok |
| Silkeborg | [Daginstitutioner i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-daginstitutioner) | native | point | CSV, GeoJSON, SHAPE | 2016-06 | ok |
| Vejle | [Daginstitutioner i Vejle Kommune](https://www.opendata.dk/city-of-vejle/daginstitutioner-i-vejle-kommune) | native | point | JSON, KML, WFS, WMS | 2015-11 | ok |

#### Playgrounds — new

- **National:** no complete source.
  - GeoFA's outdoor facilities have 1,133 `Legeplads` points in 62 municipalities, 168
    `Naturlegeplads` points in 40, and 9 water playgrounds
    ([types](https://geofa.geodanmark.dk/api/v2/sql/fkg?q=SELECT%20facil_ty%2C%20count(*)%20n%2C%20count(distinct%20kommunekode)%20kom%20FROM%20fkg.t_5800_fac_pkt%20GROUP%20BY%20facil_ty%20ORDER%20BY%20n%20DESC)).
  - The counts per municipality are low: København's own WFS layer `legeplads` alone has 134.
  - So GeoFA mostly holds playgrounds in nature and parks.
  - OpenStreetMap's `leisure=playground` is the other candidate; its coverage was not measured here.
- **Block:** distance to the nearest playground, like supermarkets today. Use GeoFA + OSM together,
  and tell the user that coverage varies.

**Coverage on the portal:** 2 datasets; 2 municipalities (Aarhus, København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Legepladser i Aarhus](https://www.opendata.dk/city-of-aarhus/legepladser) | native | point | GeoJSON, WFS | 2020-04 | ok |
| København | [Legepladser](https://www.opendata.dk/city-of-copenhagen/legepladser1) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |

#### Green areas, parks, allotments, dog areas — partly in use (OSM forests, lakes, coast, beaches)

- **National:**
  - GeoFA's park layers are almost empty: `t_6800_parl_fl` has 0 features, and `t_6802_parl_pkt`
    has 18,185 points, all from one municipality.
  - GeoFA's outdoor-facility polygons have 769 recreational nature areas (18 municipalities) and 376
    dog forests and dog parks (28 municipalities).
  - OSM's parks (`leisure=park`) are the practical national layer.
- **Municipal:** København's `Grønne områder`, Vejle's park polygons and the allotment layers
  (Ballerup, Aarhus, København) are good local detail. København's vegetation cover 2024 is a
  GeoTIFF.
- **Block:** extend the existing "forest nearby" block to parks from OSM. Municipal layers only as
  an optional refinement.

**Coverage on the portal:** 17 datasets; 5 municipalities (Aarhus, Ballerup, København, Syddjurs, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Kolonihaver i Aarhus](https://www.opendata.dk/city-of-aarhus/kolonihaver-i-aarhus) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Ballerup | [Banestyrelsens nyttehaver](https://www.opendata.dk/ballerup-kommune/bcc4e4bf-5ff3-4f65-bfdf-58cbc14dd224) | native | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Kolonihaveforeninger](https://www.opendata.dk/ballerup-kommune/a6587e23-0efc-48d0-87b3-db54414cf784) | native | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Nyttehaver](https://www.opendata.dk/ballerup-kommune/107963d4-6a27-45b5-8e66-58e203d0a24a) | native | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| København | [Blomstrende by bede](https://www.opendata.dk/city-of-copenhagen/blomstrende-by-bede) | native | polygon | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Fredskov flade](https://www.opendata.dk/city-of-copenhagen/fredskov-flade) | link only | web map | LINK | 2019-01 | link ok |
| København | [Grønne områder](https://www.opendata.dk/city-of-copenhagen/gronne-omrader) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Grønne tage](https://www.opendata.dk/city-of-copenhagen/gronne-tage) | native | polygon | CSV, GeoJSON, SHAPE | 2015-12 | ok |
| København | [Gårdhaver](https://www.opendata.dk/city-of-copenhagen/gardhaver) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Hundeområder](https://www.opendata.dk/city-of-copenhagen/hundeomrader) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Storbyhaver](https://www.opendata.dk/city-of-copenhagen/storbyhaver) | native | polygon | CSV, GeoJSON, SHP | 2015-04 | ok |
| København | [Vegetationsdække 2024 for København](https://www.opendata.dk/city-of-copenhagen/vegetationsdaekke-2024-for-kobenhavn) | native | raster/polygon | ZIP | 2025-04 | ok |
| Syddjurs | [Hundeskov](https://www.opendata.dk/syddjurs-kommune/4a2e7e9c-daa1-4798-a4a3-1c7d3b2ad039) | native | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Vejle | [Parkdrift - græsrabatter](https://www.opendata.dk/city-of-vejle/parkdrift-graesrabatter) | native | polygon/line/point | JSON, KMZ, WFS, WMS | 2015-10 | ok |
| Vejle | [Parkdrift - parkpleje (fladedata)](https://www.opendata.dk/city-of-vejle/parkdrift-parkpleje-fladedata) | native | polygon/line/point | JSON, KMZ, WFS, WMS | 2015-10 | ok |
| Vejle | [Parkdrift - parkpleje (linjedata)](https://www.opendata.dk/city-of-vejle/parkdrift-parkpleje-linjedata) | native | polygon/line/point | JSON, KMZ, WFS, WMS | 2015-10 | ok |
| Vejle | [Parkdrift - parkpleje (punktdata)](https://www.opendata.dk/city-of-vejle/parkdrift-parkpleje-punktdata) | native | polygon/line/point | JSON, KMZ, WFS, WMS | 2015-10 | ok |

#### Trees and tree canopy — new, København only

- **Municipal:** København publishes:
  - `Træ basis`: 75,033 municipal trees (WFS `trae_basis`);
  - `Gadetræer`: 20,900 street trees;
  - protected trees;
  - a **tree-canopy raster for 2024**: a 37 MB GeoTIFF with heights, trees defined as vegetation
    above 1.5 m.
- Vejle has a park-tree layer from 2020.
- **National:** no national tree register on the portal.
- **Block:** canopy share within 100 m, for København only. Nationally it needs another source.

**Coverage on the portal:** 7 datasets; 2 municipalities (København, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| København | [Bevaringsværdige træer](https://www.opendata.dk/city-of-copenhagen/bevaringsvaerdige-traeer) | native | point | GeoJSON | 2024-10 | ok |
| København | [Gadetræer](https://www.opendata.dk/city-of-copenhagen/gadetraeer) | native | point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Ikoniske træer vedtaget](https://www.opendata.dk/city-of-copenhagen/ikoniske-traeer-vedtaget) | link only | web map | LINK | 2019-01 | link ok |
| København | [Partnerskabstræer](https://www.opendata.dk/city-of-copenhagen/partnerskabstraeer) | link only | web map | LINK | 2019-01 | link ok |
| København | [Træ basis (Kommunale træer)](https://www.opendata.dk/city-of-copenhagen/trae-basis-kommunale-traeer) | native | point | CSV, GeoJSON | 2019-04 | ok |
| København | [Trækronedække 2024 for København](https://www.opendata.dk/city-of-copenhagen/traekronedaekke-2024-for-kobenhavn) | native | raster/polygon | ZIP | 2025-04 | ok |
| Vejle | [Parkdrift - træer](https://www.opendata.dk/city-of-vejle/parkdrift-traeer) | native | point | GeoJSON, KMZ, WFS, WMS | 2020-05 | ok |

#### Flooding, cloudbursts and climate adaptation — planned (block ideas: Klimadatastyrelsen / DMI)

- **Municipal:**
  - Vejle has 18 flood maps: 100- and 1,000-year events in the climate of 2012, 2050 and 2100,
    from the sea and from streams, with risk areas and damage estimates. The files date from 2018.
  - København has the **100-year storm surge in 2110** (GeoJSON, no licence stated), the
    cloudburst plan (catchments, basins, roads) and climate-adaptation projects.
- **National:** Plandata.dk's `theme_pdk_oversvoemerosion_vedtaget`, areas designated for flooding
  and erosion in municipal plans, 291,845 features. Same WFS as the zone map.
  - It records planning designations, not modelled water depths.
  - Klimadatastyrelsen / DMI remain the source for modelled flood risk (block ideas).
- **Block:** the municipal maps are too patchy for Denmark. Use them only to check a national model.

**Coverage on the portal:** 26 datasets; 2 municipalities (København, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| København | [100 års stormflod](https://www.opendata.dk/city-of-copenhagen/100-ars-stormflod) | native | polygon | GeoJSON | 2024-11 | ok |
| København | [Afsluttede Klimatilpasningsprojekter](https://www.opendata.dk/city-of-copenhagen/afsluttede-klimatilpasningsprojekter) | native | point/polygon | CSV, GeoJSON | 2022-08 | ok |
| København | [Igangsatte Klimatilpasningsprojekter](https://www.opendata.dk/city-of-copenhagen/igangsatte-klimatilpasningsprojekter) | native | point/polygon | CSV, GeoJSON | 2022-08 | ok |
| København | [Lokal Afledning af Regnvand - LAR](https://www.opendata.dk/city-of-copenhagen/lokal-afledning-af-regnvand-lar) | native | point/polygon | CSV, GeoJSON, SHP | 2015-07 | ok |
| København | [Skybrudsdeloplande](https://www.opendata.dk/city-of-copenhagen/skybrudsdeloplande) | native | point/polygon | GeoJSON, SHP | 2015-11 | ok |
| København | [Skybrudsplan - bassiner og pladser](https://www.opendata.dk/city-of-copenhagen/skybrudsplan-bassiner-og-pladser) | native | point/polygon | CSV, GeoJSON | 2022-08 | ok |
| København | [Skybrudsplan - skybrudsoplande](https://www.opendata.dk/city-of-copenhagen/skybrudsplan-skybrudsoplande) | native | point/polygon | CSV, GeoJSON | 2015-11 | ok |
| København | [Skybrudsplan - veje og tunneller](https://www.opendata.dk/city-of-copenhagen/skybrudsplan-veje-og-tunneller) | native | point/polygon | CSV, GeoJSON | 2022-08 | ok |
| Vejle | [Oversvømmelseskort Oversvømmelser 100 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-100-ars-haendelse-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Oversvømmelser 100 års hændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-100-ars-haendelse-2050) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Oversvømmelser 100 års hændelse 2100](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-100-ars-haendelse-2100) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Oversvømmelser 1000 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-1000-ars-haendelse-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Risikokortlægning 100 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-haendelse-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Risikokortlægning 100 års hændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-haendelse-2050) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Risikokortlægning 100 års hændelse 2100](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-haendelse-2100) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Risikokortlægning 100 års vandløbshændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-vandlobshaendelse-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Risikokortlægning 100 års vandløbshændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-vandlobshaendelse-2050) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Risikoområde Vejle](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikoomrade-vejle) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Total økonomisk skade 100 års hændelse i 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-haendelse-i-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Total økonomisk skade 100 års hændelse i 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-haendelse-i-2050) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Total økonomisk skade 100 års hændelse i 2100](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-haendelse-i-2100) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Total økonomisk skade 100 års vandløbshændelse i 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-vandlobshaendelse-i-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Total økonomisk skade 100 års vandløbshændelse i 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-vandlobshaendelse-i-2050) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Total økonomisk skade 1000 års hændelse samt 100 års vandløbshændelse i 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-1000-ars-haendelse-samt-100-ars-vandlobshaendelse-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Vandløbsoversvømmelser 100 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-vandlobsoversvommelser-100-ars-haendelse-2012) | native | polygon | KML, SHP | 2018-06 | ok |
| Vejle | [Oversvømmelseskort Vandløbsoversvømmelser 100 års hændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-vandlobsoversvommelser-100-ars-haendelse-2050) | native | polygon | KML, SHP | 2018-06 | ok |

#### Road noise — in use (Miljøstyrelsen 2022)

- **Municipal:** København's `Vejstøj 2022` is the same mapping round as the national map. It has
  both CNOSSOS and Nord2000 results, and **noise at each dwelling**: `vejstoej_boliger_2022`,
  338,023 features, CC0.
  - That is the `noise_facade` value from [block ideas](block-ideas.md), ready-made for København.
- **Other:** Vejdirektoratet's `Trafikstøj` holds the traffic inputs for noise models (see
  traffic), not noise levels.

**Coverage on the portal:** 3 datasets; 1 municipality (København); also Vejdirektoratet.

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| København | [Vejstøj 2017](https://www.opendata.dk/city-of-copenhagen/vejstoj_2017) | link only | web map | LINK | 2019-01 | link ok |
| København | [Vejstøj 2022](https://www.opendata.dk/city-of-copenhagen/vejstoej_2022) | native | polygon/point | ZIP | 2024-04 | ok |
| Vejdirektoratet | [Trafikstøj](https://www.opendata.dk/vejdirektoratet/stojdata-mastra) | native | point (state roads + 59 municipalities) | CSV, GeoJSON, SHAPE, XLSX | 2019-05 | ok |

#### Air quality and low-emission zones — new

- **Municipal:**
  - **Copenhagen Air View**: NO2, black carbon and ultrafine particles from Google Street View
    cars, Nov 2018 – Mar 2020, averaged per ~30 m street segment over every street in København.
    CC BY 4.0; cite "Utrecht University & Google 2021".
  - Low-emission zones: Aarhus and København as polygons.
  - København's live measurements and forecasts come from Aarhus University's stations (3 points)
    and API.
- **National:** none on the portal.
- **Block:** NO2 on the nearest street, for København only. A national air layer would need another
  source.

**Coverage on the portal:** 5 datasets; 2 municipalities (Aarhus, København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Miljøzone - Aarhus](https://www.opendata.dk/city-of-aarhus/miljozone-aarhus) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| København | [Copenhagen Air View](https://www.opendata.dk/city-of-copenhagen/airview) | native | line (street-level measurements) | GeoJSON, JSON, ZIP | 2021-05 | ok |
| København | [Luftforurening](https://www.opendata.dk/city-of-copenhagen/luftforurening) | tabular | station (4 points) | CSV, HTML | 2019-07 |  |
| København | [luftkvalitet - prognose og varsling](https://www.opendata.dk/city-of-copenhagen/luftkvalitet-prognose-og-varsling) | tabular | API (forecast, stations) | JSON | 2025-03 |  |
| København | [Miljøzoner](https://www.opendata.dk/city-of-copenhagen/miljozoner) | native | polygon | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |

#### Bike paths and cycle routes — new

- **Municipal:** route networks from Aarhus (including supercykelstier and Cykelringen), Vejle,
  Silkeborg, Syddjurs and Ballerup, plus København's cycle-count data.
  - Silkeborg's own dataset says "Data kan hentes fra GeoDanmark", and Favrskov's points to
    udinaturen.dk.
- **National:** OpenStreetMap's cycleways and GeoDanmark's road centrelines are the national
  candidates.
- **Block:** distance to a separated bike path or a supercykelsti, from OSM.

**Coverage on the portal:** 19 datasets; 7 municipalities (Aarhus, Ballerup, Favrskov, København, Silkeborg, Syddjurs, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Cykelringen](https://www.opendata.dk/city-of-aarhus/cykelringen) | native | line | WFS | 2022-09 | ok |
| Aarhus | [Cykelstier i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/cykelstier) | native | line | WFS_SRVC | 2022-09 | HTTP 400 |
| Aarhus | [Rekreative cykelruter](https://www.opendata.dk/city-of-aarhus/rekreative-cykelruter) | native | line | WFS_SRVC | 2022-09 | ok |
| Aarhus | [Supercykelsti i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/supercykelsti) | native | line | XML | 2022-09 | ok |
| Ballerup | [Cykelrute - 6 km ruten](https://www.opendata.dk/ballerup-kommune/4f06eeff-5658-4851-8db1-e6fcfe1b4a2d) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Cykelrute - Børneruten](https://www.opendata.dk/ballerup-kommune/0a5eebfd-294a-42aa-9bc8-f61ea884ea27) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Cykelrute - Kilderuten](https://www.opendata.dk/ballerup-kommune/ec225bef-36e8-4747-afd7-1239b07ab940) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Cykerute - Mountainbikeruten](https://www.opendata.dk/ballerup-kommune/04bd0bba-c537-4d5d-abbb-65222e31bb91) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Favrskov | [Favrskov cykelruter](https://www.opendata.dk/favrskov-kommune/favrskov-cykelruter) | link only | pointer to udinaturen.dk |  | 2017-06 | link ok |
| København | [Cykeldata](https://www.opendata.dk/city-of-copenhagen/cykeldata) | native | line/point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Havneringen](https://www.opendata.dk/city-of-copenhagen/havneringen) | native | line/point | CSV, GeoJSON, SHP | 2016-06 | ok |
| København | [Supercykelstier inspektion](https://www.opendata.dk/city-of-copenhagen/supercykelstier-inspektioner) | native | line/point | CSV, GeoJSON, SHAPE | 2020-09 | ok |
| København | [Vintervedligehold, cykelstier](https://www.opendata.dk/city-of-copenhagen/vintervedligehold-cykelstier) | link only | web map | LINK | 2019-01 | link ok |
| Silkeborg | [Cykelruter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-cykelruter) | native | line | CSV, GeoJSON, SHAPE | 2016-10 | ok |
| Silkeborg | [Cykelstier i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/cykelstier-i-silkeborg-kommune) | link only | pointer to GeoDanmark |  | 2017-05 | error |
| Syddjurs | [Cykelruter](https://www.opendata.dk/syddjurs-kommune/lokale-cykelruter) | native | line | GeoJSON, SHP | 2016-12 | ok |
| Syddjurs | [Cykelstier](https://www.opendata.dk/syddjurs-kommune/lokale-cykelstier) | native | line | GeoJSON, SHP | 2016-12 | ok |
| Vejle | [Cykelruter](https://www.opendata.dk/city-of-vejle/cykelruter) | native | line | JSON, KMZ, WFS, WMS | 2015-05 | ok |
| Vejle | [Overordnet cykelstinet](https://www.opendata.dk/city-of-vejle/overordnet-cykelstinet) | native | line | JSON, KMZ, WFS, WMS | 2015-05 | ok |

#### Public transport (local) — planned (Rejseplanen GTFS)

- **Municipal:** a few local bus routes and stops (Syddjurs 2016, Randers city and school buses),
  København's bus gates, and a link to the metro.
- **National:** superseded by the national GTFS feed in data-sources.md.

**Coverage on the portal:** 6 datasets; 3 municipalities (København, Randers, Syddjurs).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| København | [Bussluse områder](https://www.opendata.dk/city-of-copenhagen/bussluse-omrader) | native | polygon | CSV, GeoJSON, SHP | 2015-05 | ok |
| København | [Metro](https://www.opendata.dk/city-of-copenhagen/metro) | link only | web map | LINK | 2018-12 | link ok |
| Randers | [Bybusruter](https://www.opendata.dk/randers-kommune/dorthe-bak-tofting) | native | line | KML, WFS | 2020-06 | ok |
| Randers | [Skolebusruter](https://www.opendata.dk/randers-kommune/skolebusruter) | native | line | KML, WFS | 2020-06 | ok |
| Syddjurs | [Busruter, lokale](https://www.opendata.dk/syddjurs-kommune/busruter-lokale) | native | line/point | GeoJSON, SHP | 2016-12 | ok |
| Syddjurs | [Busstoppesteder](https://www.opendata.dk/syddjurs-kommune/busstoppesteder) | native | line/point | GeoJSON, SHP | 2016-12 | ok |

#### Local plans, municipal plans, urban renewal — partly in use (Plandata zones)

- **National:** Plandata.dk, the WFS the pilot already uses.
  - `theme_pdk_lokalplan_vedtaget`: 38,051 features.
  - `theme_pdk_kommuneplanramme_vedtaget_v`: 51,003.
  - `theme_pdk_stoejbelastetareal_vedtaget`: 7,353 noise-affected areas.
  - [Capabilities](https://geoserver.plandata.dk/geoserver/wfs?service=WFS&request=GetCapabilities&version=2.0.0)
- **Municipal:** København's local plans (2015 file), plan frames (2015 and 2019), urban renewal
  and area renewal. Vejle's dataset is just a link to the Plandata WFS.
- **Block:** "planned changes nearby", from Plandata's local-plan proposals (`_forslag`) and plan
  frames, for a "will this area change?" note.

**Coverage on the portal:** 17 datasets; 3 municipalities (Aarhus, København, Vejle); also "Andres data".

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [Plandata.dk](https://www.opendata.dk/andres-data/plandata-dk) | link only | polygon (national portal) | HTML | 2020-03 | TLS error |
| Aarhus | [Planinformation - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/planinformation-aarhus-kommune) | link only | web map | HTML | 2013-02 | HTTP 404 |
| København | [Anlægsprojekter](https://www.opendata.dk/city-of-copenhagen/anlaegsprojekter) | link only | web map | LINK | 2018-12 | link ok |
| København | [Byfornyelse](https://www.opendata.dk/city-of-copenhagen/byfornyelse) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Kommuneplan 2019, detailhandelstruktur](https://www.opendata.dk/city-of-copenhagen/kommuneplan-2019-centerstruktur-for-detailhandel) | native | polygon | GeoJSON | 2021-08 | ok |
| København | [Kommuneplan 2019, rammeområder](https://www.opendata.dk/city-of-copenhagen/kommuneplan-2019-rammeomrader) | native | polygon | CSV, GeoJSON | 2021-07 | ok |
| København | [Kommuneplan 2019, Rækkefølge for byudvikling](https://www.opendata.dk/city-of-copenhagen/kommuneplan-2019-raekkefolge-for-byudvikling) | native | polygon | CSV, GeoJSON | 2022-02 | ok |
| København | [KP15 detailhandel](https://www.opendata.dk/city-of-copenhagen/kp15-detailhandel) | native | polygon | CSV, GeoJSON, SHP | 2016-11 | ok |
| København | [KP15 rammeområder](https://www.opendata.dk/city-of-copenhagen/kp15-rammeomrader) | native | polygon | CSV, GeoJSON, SHP | 2016-11 | ok |
| København | [KP15 retningslinjer](https://www.opendata.dk/city-of-copenhagen/kp15-retningslinjer) | native | polygon | CSV, GeoJSON, SHP | 2016-11 | ok |
| København | [Lokalplaner](https://www.opendata.dk/city-of-copenhagen/lokalplaner) | native | polygon | CSV, GeoJSON, SHP | 2015-11 | ok |
| København | [Masterplansområder](https://www.opendata.dk/city-of-copenhagen/masterplansomrader) | native | polygon | CSV, GeoJSON | 2022-08 | ok |
| København | [Områdefornyelse](https://www.opendata.dk/city-of-copenhagen/omradefornyelse) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Områdefornyelse, projekter](https://www.opendata.dk/city-of-copenhagen/omradefornyelse-projekter) | native | polygon | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Reguleringsplaner](https://www.opendata.dk/city-of-copenhagen/reguleringsplaner) | link only | web map | LINK | 2018-12 | error |
| København | [Servitut romertal](https://www.opendata.dk/city-of-copenhagen/servitut-romertal) | native | polygon | CSV, GeoJSON, LINK, SHAPE | 2020-05 | ok |
| Vejle | [Kommunens planer på PlansystemDK](https://www.opendata.dk/city-of-vejle/kommunens-planer-pa-plansystemdk) | native | polygon (Plandata WFS) | WFS, WMS | 2015-07 | ok |

#### Building plots for sale — new

- **Municipal:**
  - Vejle: `Parcelhusgrunde til salg` (WFS) and business plots.
  - Silkeborg: `Grundsalg`. Its documented columns include status (sold or available), price, area
    and address.
  - Egedal: the plots of the new Ny Egedal By (2017).
- **National:** GeoFA has a matching layer, `t_5707_grunds`, but it has 0 features.
- **Block:** for milestone 5 (what is for sale), municipal plots could appear as listings. That is
  three municipalities on this portal; many more sell plots on their own sites.

**Coverage on the portal:** 4 datasets; 3 municipalities (Egedal, Silkeborg, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Egedal | [Ny Egedal By parceller](https://www.opendata.dk/egedal-kommune/ny-egedal-by-parceller-1) | native | polygon | JSON | 2017-04 | ok |
| Silkeborg | [Grundsalg i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-grundsalg) | native | polygon | CSV, GeoJSON | 2016-06 | ok |
| Vejle | [Erhvervsgrunde til salg](https://www.opendata.dk/city-of-vejle/erhvervsgrunde-salg) | native | polygon | JSON, KMZ, WFS, WMS | 2015-05 | ok |
| Vejle | [Parcelhusgrunde til salg](https://www.opendata.dk/city-of-vejle/parcelhusgrunde-til-salg) | native | polygon | JSON, KMZ, WFS | 2018-09 | ok |

### Medium relevance

#### Vulnerable housing areas — new

København's `Udsatte byområder` (CC BY 4.0). Sensitive: any block must be framed with care, and it
covers one municipality.

**Coverage on the portal:** 1 dataset; 1 municipality (København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| København | [Udsatte byområder](https://www.opendata.dk/city-of-copenhagen/udsatte-byomrader) | native | polygon | GeoJSON, LINK, SHAPE | 2019-12 | ok |

#### Social (almene) housing — new

- **Municipal:**
  - København and Vejle map the social-housing associations.
  - København also counts social housing per school district.
  - `Aarhusbolig` (XML, 2017) lists every tenancy of the Aarhus housing associations, with
    address, rooms, area and **net rent**.
- **Block:** the share of social housing nearby, local only.

**Coverage on the portal:** 4 datasets; 3 municipalities (Aarhus, København, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Aarhusbolig](https://www.opendata.dk/city-of-aarhus/aarhusbolig) | tabular | address (rents per tenancy) | XML | 2017-11 | sampled |
| København | [Almene boliger pr. skoledistrikt](https://www.opendata.dk/city-of-copenhagen/almene-boliger-pr-skoledistrikt) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Almene boligforeninger](https://www.opendata.dk/city-of-copenhagen/almene-boligforeninger) | native | polygon | CSV, GeoJSON, SHP | 2016-03 | ok |
| Vejle | [Almene boligforeninger i Vejle kommune](https://www.opendata.dk/city-of-vejle/almene-boligforeninger-i-vejle-kommune) | native | point/polygon | JSON, KMZ, WFS, WMS | 2018-09 | ok |

#### Listed and conservation-worthy buildings, heritage — new

- **National:** GeoFA `t_6205_bygningsvurdering` holds 363,396 SAVE building ratings from 80
  municipalities. København's WFS layer `fredede_bygninger_save` has 63,497.
- **Block:** a home value `save_rating`. A high rating means character, and also restrictions on
  changes.

**Coverage on the portal:** 6 datasets; 3 municipalities (Aarhus, Ikast-Brande, København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Bevaringsværdige bygninger i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/bevaringsvaerdige-bygninger-i-aarhus-kommune) | native | polygon/point | GeoJSON, ODS, PDF, WFS_SRVC | 2020-04 | ok |
| Aarhus | [Kulturhistoriske geodata](https://www.opendata.dk/city-of-aarhus/kulturhistoriske-geodata) | native | point/polygon | GeoJSON, WFS | 2023-09 | ok |
| Ikast-Brande | [Tekstilindustriens Ikast](https://www.opendata.dk/ikast-brande-kommune/tekstilindustriens-ikast) | tabular | point (UTM x/y) + address | CSV | 2017-11 | sampled |
| København | [Fortidsminder](https://www.opendata.dk/city-of-copenhagen/fortidsminder) | link only | web map | LINK | 2019-01 | link ok |
| København | [Fortidsminder beskyttelselinjer](https://www.opendata.dk/city-of-copenhagen/fortidsminder-beskyttelselinjer) | link only | web map | LINK | 2019-01 | link ok |
| København | [Fredede og bevaringsværdige bygninger (SAVE)](https://www.opendata.dk/city-of-copenhagen/fredede-og-bevaringsvaerdige-bygninger-save) | link only | web map | LINK | 2019-01 | link ok |

#### Population and socio-economics by district — partly in use (DST per municipality)

- **Municipal:**
  - Aarhus: socio-economic data per statistical district, 2016–2021. The 2021 table has 89 rows
    and dozens of columns (employment, education, income groups). It joins by district code to
    `Statistikdistrikter i Aarhus`.
  - Hedensted: housing types, tenure, families and employment per school district, 2011–2018.
  - Vejle: population per town and per school district.
  - Horsens: housing stock per area as GeoJSON.
- **Block:** below-municipality detail for 3–4 municipalities only. Not worth a national block.

**Coverage on the portal:** 37 datasets; 5 municipalities (Aarhus, Hedensted, Horsens, København, Vejle); also "Andres data".

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [Den Danske Valgdatabase](https://www.opendata.dk/andres-data/den-danske-valgdatabase) | link only | polling district (portal) | HTML | 2020-02 | link ok |
| Aarhus | [Befolkningsdata i Aarhus kommune](https://www.opendata.dk/city-of-aarhus/befolkningsdata-i-aarhus-kommune) | tabular | school district (name/code) | CSV | 2016-11 | sampled |
| Aarhus | [Befolkningstal i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/befolkningstal-i-aarhus-kommune) | tabular | city district (name) | DOCX, HTML, ODS, XLS | 2017-11 |  |
| Aarhus | [Covid-19 i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/covid-19-aarhus-kommune) | tabular | postcode |  | 2021-04 | sampled |
| Aarhus | [Socioøkonomiske data, Aarhus - 2016](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus) | tabular | statistical district (code) | XLSX | 2017-11 |  |
| Aarhus | [Socioøkonomiske data, Aarhus - 2017](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2017) | tabular | statistical district (code) | XLS | 2018-06 |  |
| Aarhus | [Socioøkonomiske data, Aarhus - 2018](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2018) | tabular | statistical district (code) | XLS | 2019-05 |  |
| Aarhus | [Socioøkonomiske data, Aarhus - 2019](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2019) | tabular | statistical district (code) | XLS | 2019-05 |  |
| Aarhus | [Socioøkonomiske data, Aarhus - 2020](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2020) | tabular | statistical district (code) | XLS | 2020-04 |  |
| Aarhus | [Socioøkonomiske data, Aarhus - 2021](https://www.opendata.dk/city-of-aarhus/sociooekonomiaarhus2021) | tabular | statistical district (code) | XLS | 2021-06 | sampled |
| Hedensted | [Aldersfordeling fordelt på skoledistrikter](https://www.opendata.dk/hedensted-kommune/aldersfordeling-fordelt-pa-skoledistrikter) | tabular | school district (name) | XLSX | 2018-06 |  |
| Hedensted | [Aldersfordeling i Hedensted Kommune 2011-2016](https://www.opendata.dk/hedensted-kommune/aldersfordeling-i-hedensted-kommune-2011-2015) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Befolkningsprognose Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/befolkningsprognose-hedensted-kommune) | tabular | school district (name) | XLSX | 2016-05 |  |
| Hedensted | [Befolkningsprognose Hedensted Kommune 2018](https://www.opendata.dk/hedensted-kommune/befolkningsprognose-hedensted-kommune-2018) | tabular | school district (name) | XLSX | 2018-06 |  |
| Hedensted | [Beskæftgelsesstatus fordelt på skoledistrikt](https://www.opendata.dk/hedensted-kommune/beskaeftgelsesstatus-fordelt-pa-skoledistrikt) | tabular | school district (name) | XLSX | 2018-06 |  |
| Hedensted | [Beskæftigelsesstatus 2011-2016](https://www.opendata.dk/hedensted-kommune/beskaeftigelsesstatus) | tabular | school district (name) | XLSX | 2016-05 |  |
| Hedensted | [Boliger og boligtyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/boliger-og-boligtyper-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2018-06 | sampled |
| Hedensted | [Boligernes areal i Hedensted Kommune 2011-2016](https://www.opendata.dk/hedensted-kommune/boligernes-areal-i-hedensted-kommune-2011-2016) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Boligernes ejerform i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/boligernes-ejerform-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Boligtyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/boligtyper-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Borgerne i Hedensted Kommunes civilstand 2011-2016](https://www.opendata.dk/hedensted-kommune/borgerne-i-hedensted-kommunes-civilstand-2011-2016) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Familietyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/familietyper-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2018-06 |  |
| Hedensted | [Flytninger til og fra Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/flytninger-til-og-fra-hedensted-kommune) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Fordeling af statsborgerskaber i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/fordeling-af-statsborgerskaber-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2018-06 |  |
| Hedensted | [Fordeling af virksomheder og -typer i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/fordeling-af-virksomheder-og-typer-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2018-06 |  |
| Hedensted | [Fordelingen af familietyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/fordelingen-af-familietyper-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Statsborgerskaber i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/statsborgerskaber-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2016-08 |  |
| Hedensted | [Til- og fraflytninger i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/til-og-fraflytninger-i-hedensted-kommune) | tabular | school district (name) | XLSX | 2018-06 |  |
| Horsens | [Boligarealer i Horsens Kommune 2011-2016](https://www.opendata.dk/horsens-kommune/boligarealer-i-horsens-kommune-2011-2016) | native | polygon (housing stock by area) | GeoJSON, MAPINFO | 2016-10 | ok |
| Horsens | [Boligers ejerform i Horsens Kommune 2011-2016](https://www.opendata.dk/horsens-kommune/boligers-ejerform-i-horsens-kommune-2011-2016) | native | polygon (housing stock by area) | GeoJSON, MAPINFO | 2016-10 | ok |
| Horsens | [Boligtyper i Horsens kommune 2011-2016](https://www.opendata.dk/horsens-kommune/boligtyper-i-horsens-kommune-2011-2016) | native | polygon (housing stock by area) | GeoJSON, MAPINFO | 2016-10 | ok |
| København | [Kommunevalget 2013](https://www.opendata.dk/city-of-copenhagen/kommunevalget-2013) | link only | web map | LINK | 2019-01 | link ok |
| Vejle | [Befolkningsprognose 2020-2034 fordelt på byområde](https://www.opendata.dk/city-of-vejle/befolkningsprognose-2018-2033-fordelt-pa-byomrade) | tabular | town / school district / postcode (name) | CSV, XLSX | 2020-06 | sampled |
| Vejle | [Befolkningsprognose 2020-2034 fordelt på skoledistrikt](https://www.opendata.dk/city-of-vejle/befolkningsprognose-2018-2033-fordelt-pa-skoledistrikt) | tabular | town / school district / postcode (name) | CSV, XLSX | 2020-06 |  |
| Vejle | [Folketal fordelt på byområder](https://www.opendata.dk/city-of-vejle/folketal-fordelt-pa-byomrader) | tabular | town / school district / postcode (name) | CSV, XLSX | 2022-02 | sampled |
| Vejle | [Folketal fordelt på postnummer](https://www.opendata.dk/city-of-vejle/folketal-fordelt-pa-postnummer) | tabular | town / school district / postcode (name) | CSV, XLSX | 2022-03 |  |
| Vejle | [Folketal fordelt på skoledistrikter](https://www.opendata.dk/city-of-vejle/folketal-fordelt-pa-skoledistrikter) | tabular | town / school district / postcode (name) | CSV, XLSX | 2022-02 | sampled |

#### Health care and elderly care — new

- **On the portal:** the SOR extracts (GPs, dentists, specialists, physiotherapists, emergency
  rooms) cover all of Denmark with coordinates, but are from 2015.
- **Block:** distance to the nearest GP, from the live SOR, not from these files.

**Coverage on the portal:** 13 datasets; 3 municipalities (Horsens, København, Vejle); also Region Midtjylland.

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Horsens | [Plejeboliger](https://www.opendata.dk/horsens-kommune/plejeboliger) | native | point | CSV, GeoJSON | 2017-12 | HTTP 503 |
| Horsens | [Ældreboliger](https://www.opendata.dk/horsens-kommune/horsens-aeldreboliger) | native | point | CSV, GeoJSON | 2017-12 | HTTP 503 |
| København | [Plejehjem](https://www.opendata.dk/city-of-copenhagen/plejehjem) | link only | web map |  | 2019-01 | link ok |
| København | [RCK behandlingsenheder](https://www.opendata.dk/city-of-copenhagen/rck-behandlingsenheder) | link only | web map | LINK | 2019-01 | link ok |
| København | [SUF centre](https://www.opendata.dk/city-of-copenhagen/suf-centre) | link only | web map | LINK | 2019-01 | link ok |
| Region Midtjylland | [Klinikker for Fysioterapi i Region Midt](https://www.opendata.dk/region-midtjylland/klinikker-for-fysioterapi-i-region-midt) | tabular | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | 2017-11 |  |
| Region Midtjylland | [Lægepraksis i Region Midt](https://www.opendata.dk/region-midtjylland/laegepraksis-i-region-midt1) | tabular | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | 2017-11 | sampled |
| Region Midtjylland | [Skadestuer i Region Midt](https://www.opendata.dk/region-midtjylland/skadestuer-i-region-midt) | tabular | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | 2017-11 |  |
| Region Midtjylland | [Speciallæger i Region Midt](https://www.opendata.dk/region-midtjylland/speciallaeger-i-region-midt) | tabular | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | 2017-11 |  |
| Region Midtjylland | [Tandlæger i Region Midt](https://www.opendata.dk/region-midtjylland/tandlaeger-i-region-midt) | tabular | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | 2017-11 | sampled |
| Vejle | [Kommunale institutioner - handicap og psykiatri](https://www.opendata.dk/city-of-vejle/kommunale-institutioner-handicap-og-psykiatri) | native | point | JSON, KMZ, WFS, WMS | 2015-10 | ok |
| Vejle | [Kommunale institutioner - Plejecentre](https://www.opendata.dk/city-of-vejle/kommunale-institutioner-plejecentre) | native | point | JSON, KMZ, WFS, WMS | 2015-10 | ok |
| Vejle | [Kommunale institutioner - Ældreboliger](https://www.opendata.dk/city-of-vejle/kommunale-institutioner-aeldreboliger) | native | point | JSON, KMZ, WFS, WMS | 2015-10 | ok |

#### Outdoor facilities and routes — new

- **National:** GeoFA's `t_5800_fac_pkt` is national.
  - 32,577 points; all 98 municipalities have some
    ([count](https://geofa.geodanmark.dk/api/v2/sql/fkg?q=SELECT%20count(distinct%20kommunekode)%20FROM%20fkg.t_5800_fac_pkt%20WHERE%20kommunekode%20BETWEEN%20101%20AND%20860)).
  - Shelters (78 municipalities), toilets (76), fire pits (76), bathing sites (55), outdoor fitness
    (52), dog forests (35).
  - Routes in `t_5802_fac_li`: 6,902 lines.
- **Municipal:** Ballerup's walks and Syddjurs's facilities are local point and line layers.
- **Block:** "nature facilities nearby" from GeoFA.

**Coverage on the portal:** 35 datasets; 8 municipalities (Aarhus, Ballerup, Egedal, Frederiksberg, København, Silkeborg, Syddjurs, Vejle); also "Andres data", GeoDanmark.

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [GuideDanmark - oplevelser, overnatning, aktiviteter i hele Danmark](https://www.opendata.dk/andres-data/guidedanmark-oplevelser-overnantning-aktiviteter-i-hele-danmark) | tabular | point (address/coords, national) | JSON, XLSX, XML | 2017-03 | sampled |
| Aarhus | [Friluftsliv Aarhus](https://www.opendata.dk/city-of-aarhus/friluftslivtemaer_aarhus) | native | point/line/polygon | GeoJSON, WFS | 2020-01 | ok |
| Ballerup | [30 min Dyreturen](https://www.opendata.dk/ballerup-kommune/fda6c578-b984-4434-ac98-3a1befe642e8) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [30 min Fugleturen](https://www.opendata.dk/ballerup-kommune/69fb286b-95c7-4789-9031-0367a5ee3e6d) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [30 min Hundeturen](https://www.opendata.dk/ballerup-kommune/22a345a5-ced8-4d39-86c0-db7981461477) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [30 min Kunstruten](https://www.opendata.dk/ballerup-kommune/61e1c010-861a-40f9-9468-6a9316a3d6ed) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [30 min Motionsruten](https://www.opendata.dk/ballerup-kommune/b053e193-bae3-4d6c-80f8-ce45623d4b46) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Damgårdsruten](https://www.opendata.dk/ballerup-kommune/274cfdf6-128b-42a8-b719-63bd54e71ee8) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Harrestrup Ådal 2 km](https://www.opendata.dk/ballerup-kommune/34b3bbf8-e5e3-4085-9b67-531e667481d8) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Harrestrup Ådal 3 km](https://www.opendata.dk/ballerup-kommune/47464335-7425-44ea-ab63-83cca796adb6) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Harrestrup Ådal 5 km](https://www.opendata.dk/ballerup-kommune/1d251ab9-9fff-4331-85a5-dd577998b23c) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Hjortespringsruten](https://www.opendata.dk/ballerup-kommune/8abb65bc-fbc6-4d92-8094-572fc3e0f216) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Lundegårdsruten](https://www.opendata.dk/ballerup-kommune/be9d26bd-7c72-4230-84df-8252ba079064) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Sct. Jacobsruten](https://www.opendata.dk/ballerup-kommune/c539764e-b3c1-4b97-8404-8fac7f26273a) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Skovruten](https://www.opendata.dk/ballerup-kommune/ad244ae6-a58e-4f67-881c-7cfa4500f19d) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Ballerup | [Vængeruten](https://www.opendata.dk/ballerup-kommune/04b30509-9f25-4b54-92f7-d25914a27031) | native | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2017-02 | ok |
| Egedal | [Naturpark Mølleåen](https://www.opendata.dk/egedal-kommune/naturpark-molleaen) | native | polygon | JSON | 2017-04 | ok |
| Frederiksberg | [Friluftstilbud](https://www.opendata.dk/city-of-frederiksberg/friluftstilbud_frederiksberg) | native | point | GeoJSON | 2020-03 | ok |
| GeoDanmark | [Geografiske fagdata i GeoDanmark (GeoFA)](https://www.opendata.dk/geodanmark/geofa) | native | point/line/polygon (national GeoFA) | HTML, WFS, WMS, SQL API | 2021-11 | ok (WFS and SQL API queried) |
| København | [Den Blå Rute (kajak)](https://www.opendata.dk/city-of-copenhagen/den-bla-rute-kajak) | native | line/point | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Den Blå Rute (overbæringssteder)](https://www.opendata.dk/city-of-copenhagen/den-bla-rute-overbaeringssteder) | native | line/point | CSV, GeoJSON, SHP | 2015-12 | ok |
| Silkeborg | [Oplev Gudenåen](https://www.opendata.dk/silkeborg-kommune/oplevgudenaa) | native | point/line (JSON, web-map widget) | JSON | 2019-05 | ok |
| Syddjurs | [Ankerpladser](https://www.opendata.dk/syddjurs-kommune/3c74b512-8766-439e-9900-3694719c106d) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Borde og bænke](https://www.opendata.dk/syddjurs-kommune/5a7209cf-7294-48e8-a4e6-d264dc394cf1) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Bådudsætning](https://www.opendata.dk/syddjurs-kommune/90060cbd-aeb8-45ac-97c0-a8674f50fab3) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Fugletårn](https://www.opendata.dk/syddjurs-kommune/9d7657ea-08a4-4de4-bdd4-2cb4212c44f0) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Kajak overnatning, primitiv](https://www.opendata.dk/syddjurs-kommune/b24a12c4-e4cb-4338-b93c-220baaab8b74) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Kajak overnatning, shelter](https://www.opendata.dk/syddjurs-kommune/0cd7f38a-62f2-4d77-9849-896ef925484a) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Madpakkehus](https://www.opendata.dk/syddjurs-kommune/217f518d-bc19-4f8b-90a6-9c8058359fc0) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Natur- og Besøgscentre](https://www.opendata.dk/syddjurs-kommune/bab4a9e8-2f15-4155-a074-9cbae0ff5229) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Små lejrpladser](https://www.opendata.dk/syddjurs-kommune/50a685ec-d963-4258-b6db-878136f820bf) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Toilettter i naturen](https://www.opendata.dk/syddjurs-kommune/toilettter-i-naturen) | native | point | CSV, GeoJSON, SHP | 2016-12 | ok |
| Syddjurs | [Vandreruter i Syddjurs Kommune](https://www.opendata.dk/syddjurs-kommune/lokale-vandreruter) | native | line | GeoJSON, SHP | 2016-12 | ok |
| Vejle | [Faciliteter og seværdigheder - rekreative ruter](https://www.opendata.dk/city-of-vejle/faciliteter-og-sevaerdigheder-rekreative-ruter) | native | point/line | JSON, KMZ, WFS, WMS | 2015-05 | ok |
| Vejle | [Vandreruter](https://www.opendata.dk/city-of-vejle/vandreruter1) | native | point/line | JSON, KMZ, WFS, WMS | 2015-05 | ok |

#### Other medium themes

- **Bike parking and city bikes:**

**Coverage on the portal:** 10 datasets; 3 municipalities (Aarhus, København, Silkeborg).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Aarhus Bycykel](https://www.opendata.dk/city-of-aarhus/aarhus-bycykel) | tabular | point (lat/lon) | JSON | 2017-03 | sampled |
| Aarhus | [Cykelluftpumper](https://www.opendata.dk/city-of-aarhus/luftpumper_cykel) | native | point | WFS | 2022-09 | ok |
| Aarhus | [Cykelservicestationer](https://www.opendata.dk/city-of-aarhus/cykelservicestationer) | native | point | WFS | 2022-09 | ok |
| Aarhus | [Cykelstativer i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/cykelparkering_aarhus) | native | point | WFS_SRVC | 2022-09 | ok |
| Aarhus | [Cykelterminal](https://www.opendata.dk/city-of-aarhus/cykelterminal) | native | point | WFS_SRVC | 2022-09 | ok |
| København | [Bycykelstationer](https://www.opendata.dk/city-of-copenhagen/bycykelstationer) | native | point | CSV, GeoJSON, SHAPE-ZIP | 2022-04 | ok |
| København | [Cykelparkeringstælling](https://www.opendata.dk/city-of-copenhagen/cykelparkeringstaelling) | native | point | CSV, GeoJSON, SHP | 2018-10 | ok |
| København | [Cykelparkeringstællinger](https://www.opendata.dk/city-of-copenhagen/cykelparkeringstaellinger) | native | point | CSV, JSON, SHAPE | 2018-11 | ok |
| København | [Cykelstativer](https://www.opendata.dk/city-of-copenhagen/cykelstativer) | native | point | CSV, GeoJSON, PDF, SHAPE-ZIP | 2022-04 | ok |
| Silkeborg | [Cykelservice i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-cykelservice) | native | point | CSV, GeoJSON, SHAPE | 2016-10 | ok |

- **Parking zones and spaces.** Residents' parking zones matter to car owners in cities:

**Coverage on the portal:** 25 datasets; 8 municipalities (Aarhus, Frederiksberg, Horsens, København, Randers, Silkeborg, Syddjurs, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Parkering i Aarhus Kommune – Zoner, Tilladelser og Pladser](https://www.opendata.dk/city-of-aarhus/parkering-i-aarhus-kommune) | native | polygon/point | GeoJSON, WFS | 2020-03 | ok |
| Aarhus | [Parkeringsdata fra sensorer](https://www.opendata.dk/city-of-aarhus/parkeringsdata-fra-sensorer) | tabular | API (sensor points) | JSON | 2024-05 |  |
| Aarhus | [Parkeringshuse i Aarhus](https://www.opendata.dk/city-of-aarhus/parkeringshuse-i-aarhus) | tabular | car park names | CSV, PDF | 2017-11 |  |
| Frederiksberg | [Parkeringsautomater](https://www.opendata.dk/city-of-frederiksberg/parkeringsautomater) | native | point/polygon | GeoJSON | 2020-03 | ok |
| Frederiksberg | [Parkeringspladser](https://www.opendata.dk/city-of-frederiksberg/parkering_frederiksberg) | native | point/polygon | GeoJSON | 2025-05 | ok |
| Frederiksberg | [Parkeringszone](https://www.opendata.dk/city-of-frederiksberg/parkeringszone) | native | point/polygon | SHP | 2025-05 | ok |
| Frederiksberg | [Parkeringszoner](https://www.opendata.dk/city-of-frederiksberg/parkeringszoner) | native | point/polygon | GeoJSON, ZIP | 2026-03 | ok |
| Horsens | [Parkering](https://www.opendata.dk/horsens-kommune/horsens-parkering) | native | point/polygon | CSV, GeoJSON | 2017-12 | HTTP 503 |
| København | [Beboerlicensgader](https://www.opendata.dk/city-of-copenhagen/beboerlicensgader) | native | line/polygon/point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Lastbil natparkering](https://www.opendata.dk/city-of-copenhagen/lastbil-natparkering) | native | line/polygon/point | CSV, GeoJSON, SHP | 2015-07 | ok |
| København | [Parkeringshuse](https://www.opendata.dk/city-of-copenhagen/parkeringshuse) | native | line/polygon/point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Parkeringspladser](https://www.opendata.dk/city-of-copenhagen/parkeringspladser) | native | line/polygon/point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Parkeringstælling i zoner](https://www.opendata.dk/city-of-copenhagen/parkeringstaelling-i-zoner) | native | line/polygon/point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Parkeringstællinger](https://www.opendata.dk/city-of-copenhagen/parkeringstaellinger) | native | line/polygon/point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Parkeringszoner information](https://www.opendata.dk/city-of-copenhagen/parkeringszoner-information) | native | line/polygon/point | CSV, GeoJSON | 2020-06 | ok |
| København | [Parkomat transaktioner](https://www.opendata.dk/city-of-copenhagen/parkomat-transaktioner) | tabular | parking-meter id | CSV | 2020-01 |  |
| København | [Parkomater](https://www.opendata.dk/city-of-copenhagen/parkomater) | native | line/polygon/point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| Randers | [Parkering](https://www.opendata.dk/randers-kommune/parkering_randers) | native | point/polygon | WFS_SRVC | 2021-02 | HTTP 404 |
| Silkeborg | [Parkering: Forbudszoner i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/parkering-forbudszoner-i-silkeborg) | native | point/polygon | CSV, GeoJSON, SHAPE | 2017-11 | ok |
| Silkeborg | [Parkeringspladser i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-parkering) | native | point/polygon | CSV, GeoJSON, SHAPE | 2017-11 | ok |
| Silkeborg | [Parkomater i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/parkomater-i-silkeborg) | native | point/polygon | CSV, GeoJSON, SHAPE | 2017-11 | ok |
| Syddjurs | [Parkeringspladser](https://www.opendata.dk/syddjurs-kommune/p-pladser) | native | point | GeoJSON, SHP | 2016-12 | ok |
| Vejle | [Parkeringspladser (kommunal ejede og offentlig tilgængelige)](https://www.opendata.dk/city-of-vejle/parkeringspladser-kommunal-ejede-og-offentlig-tilgaengelige) | native | point/polygon | JSON, KML, WFS, WMS | 2015-05 | ok |
| Vejle | [Parkeringspladser - handicap (kommunal ejede og offentligt tilgængelige)](https://www.opendata.dk/city-of-vejle/parkeringspladser-handicap-kommunal-ejede-og-offentligt-tilgaengelige) | native | point/polygon | JSON, KMZ | 2015-11 | ok |
| Vejle | [Vejle Parkering - Live Data](https://www.opendata.dk/city-of-vejle/vejle-parkering) | tabular | API (car parks) | JSON | 2022-11 |  |

- **EV charging.** GeoFA `t_5607_ladefacilitet` has 35,621 points in 37 municipalities:

**Coverage on the portal:** 2 datasets; 2 municipalities (Frederiksberg, København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Frederiksberg | [Elbil ladestandere](https://www.opendata.dk/city-of-frederiksberg/elbil-ladestandere) | native | point | GeoJSON | 2022-01 | ok |
| København | [elbilladestandere (i drift og kommende) - charging stations](https://www.opendata.dk/city-of-copenhagen/ladestandere-elbil) | native | point | GeoJSON | 2022-05 | ok |

- **Libraries, culture, sport and leisure:**

**Coverage on the portal:** 20 datasets; 7 municipalities (Aarhus, Frederiksberg, Horsens, København, Randers, Silkeborg, Syddjurs).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Arrangementer i Aarhus](https://www.opendata.dk/city-of-aarhus/arrangementer-i-aarhus) | native | point | GeoJSON | 2017-11 | ok |
| Aarhus | [Eventdatabasen](https://www.opendata.dk/city-of-aarhus/eventdatabasen) | tabular | venue (API) | API | 2017-05 |  |
| Aarhus | [Ruter / Arrangementer i Aarhus](https://www.opendata.dk/city-of-aarhus/ruter-arrangementer-i-aarhus) | native | point | GeoJSON | 2017-01 | ok |
| Frederiksberg | [biblioteker](https://www.opendata.dk/city-of-frederiksberg/bibliotek-frb) | native | point | GeoJSON | 2017-05 | ok |
| Horsens | [Biblioteker](https://www.opendata.dk/horsens-kommune/horsens-biblioteker) | native | point | CSV, GeoJSON | 2017-12 | HTTP 503 |
| København | [Biblioteker](https://www.opendata.dk/city-of-copenhagen/biblioteker) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Boldbaner](https://www.opendata.dk/city-of-copenhagen/boldbaner) | native | point | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Idrætsanlæg](https://www.opendata.dk/city-of-copenhagen/idraetsanlaeg) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Kulturhuse](https://www.opendata.dk/city-of-copenhagen/kulturhuse) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Monumenter](https://www.opendata.dk/city-of-copenhagen/monumenter) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Museer](https://www.opendata.dk/city-of-copenhagen/museer) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Stadsarkivet](https://www.opendata.dk/city-of-copenhagen/stadsarkivet) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Svømmehaller og havnebade](https://www.opendata.dk/city-of-copenhagen/svommehaller-mv) | native | point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| Randers | [Haller](https://www.opendata.dk/randers-kommune/haller-i-randers) | native | point | KML, WFS | 2020-06 | ok |
| Silkeborg | [Faciliteter og byrum i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-faciliteter) | native | point | CSV, GeoJSON, SHAPE | 2016-10 | ok |
| Syddjurs | [Biblioteker](https://www.opendata.dk/syddjurs-kommune/1cc90562-f5e8-45ab-a7f0-4fc7d0832784) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Boldbaner](https://www.opendata.dk/syddjurs-kommune/aa1a17a1-e2a6-4cd7-ab7c-b3e115c493bf) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Haller i Syddjurs Kommune](https://www.opendata.dk/syddjurs-kommune/haller-i-syddjurs-kommune) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Kulturhuse](https://www.opendata.dk/syddjurs-kommune/9c547227-f2ad-4e30-a684-d0bc3dcc7acb) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Svømmehaller](https://www.opendata.dk/syddjurs-kommune/1372265a-9c6f-4ffd-b5ed-786523c9d89e) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |

- **Bathing water and beaches:**

**Coverage on the portal:** 8 datasets; 4 municipalities (Aarhus, København, Silkeborg, Syddjurs).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Badevand Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/badevand-aarhus-kommune) | tabular | sensor point | JSON | 2025-05 |  |
| Aarhus | [Havnebadet - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/havnebadet-aarhus-kommune) | tabular | sensor point |  | 2023-06 |  |
| København | [Målesteder for badevandskvalitet](https://www.opendata.dk/city-of-copenhagen/malesteder-for-badevandskvalitet) | native | point | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Prøvetagningsstationer til badevandsanalyser](https://www.opendata.dk/city-of-copenhagen/provetagningsstationer-til-badevandsanalyser) | native | point | CSV, GeoJSON, SHP | 2015-07 | ok |
| Silkeborg | [Badevandstemperaturer i søer](https://www.opendata.dk/silkeborg-kommune/badevandstemperaturer-for-soerne-i-silkeborg-kommune) | tabular | sensor point | JSON | 2021-09 |  |
| Syddjurs | [Badebroer i Syddjurs Kommune](https://www.opendata.dk/syddjurs-kommune/badebroer-i-syddjurs-kommune) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Blå flag havn](https://www.opendata.dk/syddjurs-kommune/28c32821-7a5a-418f-8d31-88644bd0f88c) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |
| Syddjurs | [Blå flag strand](https://www.opendata.dk/syddjurs-kommune/535c4be1-be45-4445-9952-7445a03b3f26) | native | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | 2019-09 | ok |

- **Streams, lakes, nature protection, groundwater:**

**Coverage on the portal:** 18 datasets; 5 municipalities (Aarhus, Egedal, København, Randers, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Lystfiskeri i kommunale ferske vandløb, åer og søer, Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/lystfiskeri-i-kommunale-ferske-vandlob-aer-og-soer-aarhus-kommune) | native | line/polygon | GeoJSON, WFS | 2021-11 | ok |
| Aarhus | [Naturbeskyttede områder med Bilag 4 arter](https://www.opendata.dk/city-of-aarhus/naturbeskyttede-omrader-med-bilag4-arter-2013) | native | line/polygon | GeoJSON, WFS | 2020-03 | ok |
| Aarhus | [Vandløb i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/vandlob-aarhus-kommune) | native | line/polygon | GeoJSON, WFS | 2020-01 | ok |
| Egedal | [Registreret Bjørneklo 2016](https://www.opendata.dk/egedal-kommune/registreret-bjorneklo-2016) | native | point | GeoJSON | 2017-04 | ok |
| Egedal | [Riste, vandløb](https://www.opendata.dk/egedal-kommune/riste-vandlob) | native | point | JSON | 2017-04 | ok |
| Egedal | [Vandløbsjournalisering](https://www.opendata.dk/egedal-kommune/egedal-vandlobsjournalisering-2016) | native | point | JSON | 2017-12 | ok |
| København | [Grundvand - potentialelinjer og pejlinger](https://www.opendata.dk/city-of-copenhagen/grundvand-potentialelinjer-og-pejlinger) | native | line/point | GeoJSON | 2022-04 | ok |
| København | [Grundvandsboringer (KK)](https://www.opendata.dk/city-of-copenhagen/grundvandsboringer-kk) | link only | web map | LINK | 2019-01 | link ok |
| København | [Kysttyper](https://www.opendata.dk/city-of-copenhagen/kysttyper) | native | line/point | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Pejlinger](https://www.opendata.dk/city-of-copenhagen/pejlinger) | link only | web map | LINK | 2019-01 | link ok |
| København | [Strandbeskyttelse, flade](https://www.opendata.dk/city-of-copenhagen/strandbeskyttelse-flade) | link only | web map | LINK | 2019-01 | link ok |
| København | [Strandbeskyttelse, umatrikulerede arealer (DAF)](https://www.opendata.dk/city-of-copenhagen/strandbeskyttelse-daf) | link only | web map | LINK | 2019-01 | link ok |
| København | [Søbeskyttelseslinjer](https://www.opendata.dk/city-of-copenhagen/sobeskyttelseslinjer) | native | line/point | CSV, GeoJSON, SHP | 2015-07 | ok |
| København | [Søer og vandløb](https://www.opendata.dk/city-of-copenhagen/soer-og-vandlob) | native | line/point | CSV, GeoJSON, PDF, SHP | 2020-01 | ok |
| København | [Åbeskyttelseslinjer](https://www.opendata.dk/city-of-copenhagen/abeskyttelseslinjer) | native | line/point | CSV, GeoJSON, SHP | 2015-07 | ok |
| København | [Ålegræs](https://www.opendata.dk/city-of-copenhagen/alegraes) | native | line/point | CSV, GeoJSON, SHP | 2015-12 | ok |
| Randers | [Våd- og lavbundsområder i Randers kommune siden år 2000](https://www.opendata.dk/randers-kommune/vad-og-lavbundsomrader-i-randers-kommune-siden-ar-2000) | tabular | polygon (WKT in CSV) | CSV | 2023-03 | sampled |
| Vejle | [Vandstandsstationer med online målinger](https://www.opendata.dk/city-of-vejle/vandstandsstationer-med-online-malinger) | native | point | JSON, KML, WFS, WMS | 2015-12 | ok |

- **Administrative and statistical areas.** Useful as join keys for the tabular data:

**Coverage on the portal:** 18 datasets; 3 municipalities (Aarhus, Horsens, København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Fællesråd i Aarhus](https://www.opendata.dk/city-of-aarhus/faellesrad-i-aarhus-kommune) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Lokalsamfund i Aarhus](https://www.opendata.dk/city-of-aarhus/lokalsamfund-i-aarhus) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Postdistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/postdistrikt) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Statistikdistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/statistikdistrikter) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Statistikdistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/statistikdistrikter-i-aarhus) | native | polygon | GeoJSON, KML | 2018-03 | ok |
| Aarhus | [Valgdistrikter  (afstemningsområder) og valgsteder i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/valgdistrikter-og-valgsteder-i-aarhus-kommune) | native | polygon | GeoJSON, WFS | 2020-05 | ok |
| Aarhus | [Ældreområder i Aarhus](https://www.opendata.dk/city-of-aarhus/aeldreomrader-i-aarhus) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Horsens | [Kommunegrænse](https://www.opendata.dk/horsens-kommune/kommunegraense) | native | polygon | GeoJSON | 2017-12 | HTTP 503 |
| København | [Afstemningsområder i København](https://www.opendata.dk/city-of-copenhagen/afstemningsomrader-i-kobenhavn) | native | polygon | CSV, GeoJSON, SHP | 2015-07 | ok |
| København | [Bydele](https://www.opendata.dk/city-of-copenhagen/bydele) | native | polygon | CSV, GeoJSON | 2016-03 | ok |
| København | [Driftsområder](https://www.opendata.dk/city-of-copenhagen/driftsomrader) | native | polygon | CSV, GeoJSON, SHP | 2015-11 | ok |
| København | [Ejerlavsgrænse](https://www.opendata.dk/city-of-copenhagen/ejerlavsgraense) | link only | web map | LINK | 2018-12 | link ok |
| København | [KKORG - Københavns Kommunes organisatoriske enhed](https://www.opendata.dk/city-of-copenhagen/kkorg-kobenhavns-kommunes-organisatoriske-enhed) | native | polygon | CSV, GeoJSON, LINK, SHP | 2019-03 | ok |
| København | [Kvarterer](https://www.opendata.dk/city-of-copenhagen/kvarter) | native | polygon | CSV, GeoJSON | 2021-07 | ok |
| København | [Lokaludvalgsgrænser](https://www.opendata.dk/city-of-copenhagen/lokaludvalgsgraenser) | native | polygon | CSV, GeoJSON | 2015-11 | ok |
| København | [Oversigtskort](https://www.opendata.dk/city-of-copenhagen/oversigtskort) | native | polygon | GeoJSON, PDF, SHP | 2019-11 | ok |
| København | [Roder](https://www.opendata.dk/city-of-copenhagen/roder) | native | polygon | CSV, GeoJSON | 2015-11 | ok |
| København | [Sogngrænse](https://www.opendata.dk/city-of-copenhagen/sogngraense) | link only | web map | LINK | 2019-01 | link ok |

### Low relevance

These describe municipal operations, or duplicate national registers, and are not worth a block:

- road works, winter service, street lighting and furniture;
- waste bins and recycling centres;
- toilets;
- BBR extracts (BBR itself is planned through Datafordeleren);
- 3D city models;
- public ownership;
- addresses and place names;
- IoT sensor feeds;
- other.

<details>
<summary>Low-relevance datasets by theme</summary>

**Water supply and sewer catchments**

**Coverage on the portal:** 5 datasets; 4 municipalities (Aarhus, Hedensted, Randers, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Indvindingsoplande i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/indvindingsoplande) | native | polygon | GeoJSON, WFS | 2020-01 | ok |
| Aarhus | [Kloakoplande i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/kloakopland-i-aarhus-kommune-2014) | native | polygon | GeoJSON, WFS | 2019-11 | ok |
| Hedensted | [Vandforsyning - forsyningsområder](https://www.opendata.dk/hedensted-kommune/vandforsyning-forsyningsomrader) | native | polygon | GeoJSON | 2018-02 | ok |
| Randers | [El- og fjernvarmeanlæg i Randers Kommune](https://www.opendata.dk/randers-kommune/el-og-fjernvarmeanlaeg-i-randers-kommune) | tabular | postcode (heat plants) | CSV | 2023-09 | sampled |
| Vejle | [Vandværker forsyningsgrænser](https://www.opendata.dk/city-of-vejle/vandvaerker-forsyningsgraenser) | native | polygon | JSON, KMZ, WFS, WMS | 2018-09 | ok |

**Public toilets and drinking water**

**Coverage on the portal:** 6 datasets; 5 municipalities (Aarhus, Frederiksberg, København, Silkeborg, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Offentlige toiletter i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/toiletter-i-aarhus-kommune) | native | point | GeoJSON, WFS | 2020-01 | ok |
| Frederiksberg | [Offentlige toiletter](https://www.opendata.dk/city-of-frederiksberg/offentlige-toiletter-frederiksberg) | native | point | GeoJSON | 2021-08 | ok |
| København | [Drikkevandsposter og springvand](https://www.opendata.dk/city-of-copenhagen/drikkevandsposter-og-springvand) | native | point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Toiletter TMF](https://www.opendata.dk/city-of-copenhagen/toiletter-tmf) | native | point | CSV, GeoJSON | 2023-06 | ok |
| Silkeborg | [Offentlige toiletter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/toiletter-i-silkeborg) | native | point | CSV, GeoJSON, SHAPE | 2017-11 | ok |
| Vejle | [Toiletter (offentlige) Vejle kommune](https://www.opendata.dk/city-of-vejle/toiletter1) | native | point | JSON, KML | 2016-05 | service error |

**Waste**

**Coverage on the portal:** 8 datasets; 5 municipalities (Aarhus, Frederiksberg, København, Randers, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Affaldsbeholdere i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/affaldsbeholdere-i-aarhus-kommune) | native | point | GeoJSON, WFS_SRVC | 2020-04 | ok |
| Frederiksberg | [Skraldespande](https://www.opendata.dk/city-of-frederiksberg/skraldespande-frb) | native | point | GeoJSON | 2018-02 | ok |
| København | [Affaldskurve](https://www.opendata.dk/city-of-copenhagen/affaldskurve) | native | point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Flaske- og glascontainere](https://www.opendata.dk/city-of-copenhagen/flaske-og-glascontainere) | native | point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Genbrugsstationer](https://www.opendata.dk/city-of-copenhagen/genbrugsstationer) | native | point | CSV, GeoJSON, SHP | 2015-12 | ok |
| Randers | [Genbrugspladser](https://www.opendata.dk/randers-kommune/genbrugspladser) | native | point | KML | 2019-12 | ok |
| Vejle | [Flaskecontainere i Vejle Kommune](https://www.opendata.dk/city-of-vejle/flaskecontainere-i-vejle-kommune) | native | point | JSON, KMZ, WFS, WMS | 2015-05 | ok |
| Vejle | [Genbrugsstationer i Vejle Kommune](https://www.opendata.dk/city-of-vejle/placering-af-genbrugsstationer-i-vejle-kommune) | native | point | JSON, KMZ, WFS, WMS | 2015-05 | ok |

**Buildings and housing stock**

**Coverage on the portal:** 9 datasets; 3 municipalities (Aarhus, København, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [BBR-bygninger Aarhus](https://www.opendata.dk/city-of-aarhus/bbr-ejendomme-og-bbr-bygninger) | native | polygon/point | PDF, WFS | 2020-05 | HTTP 400 |
| København | [Bebyggede områder](https://www.opendata.dk/city-of-copenhagen/bebyggede-omrader) | native | polygon | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Karré](https://www.opendata.dk/city-of-copenhagen/karre) | native | polygon | CSV, GeoJSON | 2016-06 | ok |
| Vejle | [BBR-bygning - fritidsformål](https://www.opendata.dk/city-of-vejle/bbr-bygning-fritidsformal) | native | point | JSON, KML, PDF | 2018-06 | service error |
| Vejle | [BBR-bygning - Kontor, handel og transport](https://www.opendata.dk/city-of-vejle/bbr-bygning-kontor-handel-og-transport) | native | point | JSON, KML, PDF | 2018-06 | service error |
| Vejle | [BBR-bygning - kulturelle/offentlige formål](https://www.opendata.dk/city-of-vejle/bbr-bygning-kulturelle-formal) | native | point | JSON, KML, PDF | 2018-06 | service error |
| Vejle | [BBR-bygning-helårsbeboelse](https://www.opendata.dk/city-of-vejle/bbr-bygning-helarsbeboelse) | native | point | JSON, KML, PDF, WMS | 2022-02 | service error |
| Vejle | [BBR-bygning-industri, håndværk og forsyning](https://www.opendata.dk/city-of-vejle/bbr-bygning-industri-og-handvaerk) | native | point | JSON, KML, PDF | 2018-06 | service error |
| Vejle | [BBR-bygning-landbrug](https://www.opendata.dk/city-of-vejle/bbr-bygning-landbrug) | native | point | JSON, KML, PDF | 2018-06 | service error |

**3D city models and solar potential**

**Coverage on the portal:** 13 datasets; 6 municipalities (Aarhus, Frederiksberg, Horsens, København, Vejle, Viborg).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Aarhus Kommunes 3D-bymodel](https://www.opendata.dk/city-of-aarhus/aarhus-kommunes-3d-bymodel) | native | 3D (DWG) | DWG | 2023-08 | ok |
| Frederiksberg | [3D bymodel](https://www.opendata.dk/city-of-frederiksberg/3d-bymodel) | native | 3D (DWG) | DWG, PDF | 2020-03 | ok |
| Horsens | [3D BYMODEL HORSENS KOMMUNE](https://www.opendata.dk/horsens-kommune/3d-bymodel-horsens-kommune) | native | 3D (SKP/DWG tiles) | .PDF, .ZIP, JPEG | 2023-02 | ok |
| København | [Soldata 3D København](https://www.opendata.dk/city-of-copenhagen/soldata-3d-kobenhavn) | native | raster/3D | ZIP | 2020-01 | ok |
| København | [Grundkort over Københavns Kommune - CAD format](https://www.opendata.dk/city-of-copenhagen/grundkort) | native | CAD (DGN/DWG) | DGN, DWG | 2018-06 | ok |
| København | [Højdekurver](https://www.opendata.dk/city-of-copenhagen/hojdekurver) | native | CAD (DGN/DWG) | DWG | 2014-09 | HTTP 503 |
| København | [København 3D bymodel](https://www.opendata.dk/city-of-copenhagen/kobenhavn-3d-bymodel) | native | CAD (DGN/DWG) | DGN, DWG, DXF | 2020-08 | ok |
| Vejle | [3D bymodel af Jelling](https://www.opendata.dk/city-of-vejle/3d-bymodel-af-jelling) | native | 3D (DWG/DXF) | DWG, DXF | 2018-06 | ok |
| Vejle | [3D bymodel af Vejle midtby](https://www.opendata.dk/city-of-vejle/3d-bymodel-af-vejle-og-centerbyer) | native | 3D (DWG/DXF) | ARCGIS GEODATABASE, DWG, DXF | 2018-06 | ok |
| Vejle | [3D bymodel Børkop](https://www.opendata.dk/city-of-vejle/3d-bymodel-borkop) | native | 3D (DWG/DXF) | DWG, DXF | 2018-06 | ok |
| Vejle | [3D bymodel Give](https://www.opendata.dk/city-of-vejle/3d-bymodel-give) | native | 3D (DWG/DXF) | DWG, DXF | 2018-06 | ok |
| Vejle | [Egtved 3D bymodel](https://www.opendata.dk/city-of-vejle/3d-bymodel-egtved) | native | 3D (DWG/DXF) | DWG, DXF | 2018-06 | ok |
| Viborg | [3D-bymodel af Viborg Kommune](https://www.opendata.dk/viborg-kommune/3d-bymodel-viborg) | native | 3D (GeoJSON) | GeoJSON | 2018-10 | ok |

**Public property ownership**

**Coverage on the portal:** 8 datasets; 3 municipalities (Aarhus, København, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Ejendomme ejet af Aarhus Havn](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-aarhus-havn) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Ejendomme ejet af Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-aarhus-kommune) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Ejendomme ejet af Region Midtjylland i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-region-midtjylland) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Ejendomme ejet af Staten i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-staten) | native | polygon | GeoJSON, WFS | 2020-04 | ok |
| Aarhus | [Ejendomsfortegnelse](https://www.opendata.dk/city-of-aarhus/ejendomsfortegnelse) | tabular | cadastral number | ODS, XLSX | 2017-11 |  |
| København | [TMF administrerede ejendomme](https://www.opendata.dk/city-of-copenhagen/tmf-administrerede-ejendomme) | native | polygon/line | CSV, GeoJSON, SHP | 2016-12 | ok |
| København | [Vejstrækninger ejerforhold](https://www.opendata.dk/city-of-copenhagen/vejstraekninger-ejerforhold) | native | line | CSV, GeoJSON, SHP | 2016-12 | ok |
| Vejle | [Offentlig ejede arealer](https://www.opendata.dk/city-of-vejle/offentlig-ejede-arealer) | native | polygon | JSON, KML, WFS, WMS | 2016-03 | ok |

**Road network, road works, winter service, street furniture**

**Coverage on the portal:** 49 datasets; 7 municipalities (Aarhus, Hedensted, Horsens, København, Silkeborg, Syddjurs, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Belysningsarmaturer Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/belysningsarmaturer-aarhus-kommune) | native | point | GeoJSON, KML | 2017-11 | ok |
| Aarhus | [Gravetilladelser](https://www.opendata.dk/city-of-aarhus/gravetilladelser2) | native | polygon | GeoJSON | 2017-01 | ok |
| Aarhus | [Tilladelse til opstilling af materiel](https://www.opendata.dk/city-of-aarhus/tilladelse-til-opstilling-af-materiel) | native | polygon | GeoJSON | 2017-01 | ok |
| Aarhus | [Vejnavne i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/vejnavne-i-aarhus-kommune) | native | line | GeoJSON, WFS | 2020-05 | ok |
| Hedensted | [Vejstatus i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/vejstatus-i-hedensted-kommune) | native | line | GeoJSON, SHAPE | 2020-02 | ok |
| Hedensted | [Vinterklasser - vintervedligehold](https://www.opendata.dk/hedensted-kommune/vinterklasser-vintervedligehold) | native | line | GeoJSON, SHAPE | 2020-02 | ok |
| Horsens | [Vej](https://www.opendata.dk/horsens-kommune/vej) | native | line | GeoJSON | 2018-01 | HTTP 503 |
| København | [Afmærkning på veje](https://www.opendata.dk/city-of-copenhagen/afmaerkning-pa-veje-samlet) | native | line/point | DGN, DWG | 2020-01 | ok |
| København | [Ansvarsområder for saltning på gangareal](https://www.opendata.dk/city-of-copenhagen/ansvarsomrader-for-saltning-pa-gangareal) | link only | web map | LINK | 2019-01 | link ok |
| København | [Arealer til arrangementer](https://www.opendata.dk/city-of-copenhagen/arealer-til-arrangementer) | link only | web map | LINK | 2019-01 | link ok |
| København | [Belysning, armaturer](https://www.opendata.dk/city-of-copenhagen/belysning-armaturer) | native | line/point | ZIP | 2020-12 | ok |
| København | [Belysning, ledninger](https://www.opendata.dk/city-of-copenhagen/belysning-ledninger) | native | line/point | ZIP | 2020-01 | ok |
| København | [Belysning, master](https://www.opendata.dk/city-of-copenhagen/belysning-master) | native | line/point | ZIP | 2020-12 | ok |
| København | [Belysning, wirer](https://www.opendata.dk/city-of-copenhagen/belysning-wirer) | native | line/point | ZIP | 2020-12 | ok |
| København | [Byinventar](https://www.opendata.dk/city-of-copenhagen/byinventar) | native | line/point | GeoJSON | 2022-07 | ok |
| København | [Byliv - faktureringszoner](https://www.opendata.dk/city-of-copenhagen/byliv-faktureringszoner) | native | line/point | CSV, GeoJSON | 2015-12 | ok |
| København | [Cykeltaxaholdepladser](https://www.opendata.dk/city-of-copenhagen/cykeltaxaholdepladser) | link only | web map | LINK | 2019-01 | link ok |
| København | [Cykeltaxi rødzone](https://www.opendata.dk/city-of-copenhagen/cykeltaxi-rodzone) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Fortovsrenhold, facadelængde](https://www.opendata.dk/city-of-copenhagen/fortovsrenhold-facadelaengde) | link only | web map | LINK | 2019-01 | link ok |
| København | [Giv et praj - privat fællesvej](https://www.opendata.dk/city-of-copenhagen/giv-et-praj-privat-faellesvej) | link only | web map | LINK | 2019-01 | link ok |
| København | [Gravetilladelser](https://www.opendata.dk/city-of-copenhagen/gravetilladelser) | native | polygon | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Kajkant ejerforhold](https://www.opendata.dk/city-of-copenhagen/kajkant-ejerforhold) | native | line | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Kajnumre](https://www.opendata.dk/city-of-copenhagen/kajnumre) | native | line/point | CSV, GeoJSON | 2015-12 | ok |
| København | [Kartoner, indsamling](https://www.opendata.dk/city-of-copenhagen/kartoner-indsamling) | link only | web map | LINK | 2019-01 | link ok |
| København | [Læskærm](https://www.opendata.dk/city-of-copenhagen/laeskaerm) | native | line/point | CSV, GeoJSON, SHP | 2016-03 | layer gone |
| København | [Mobile gadesalgspladser](https://www.opendata.dk/city-of-copenhagen/mobile-gadesalgspladser) | link only | web map |  | 2019-01 | link ok |
| København | [Mobilt gadesalg, zoner](https://www.opendata.dk/city-of-copenhagen/mobilt-gadesalg-zoner) | link only | web map | LINK | 2019-01 | link ok |
| København | [P-forbuds zone indre by](https://www.opendata.dk/city-of-copenhagen/p-forbuds-zone-indre-by) | link only | web map | LINK | 2019-01 | link ok |
| København | [Pladselementer](https://www.opendata.dk/city-of-copenhagen/pladselementer) | native | line/point | CSV, GeoJSON, SHP | 2015-12 | layer gone |
| København | [Private fællesvej klassificering](https://www.opendata.dk/city-of-copenhagen/private-faellesvej-klassificering) | link only | web map |  | 2019-01 | link ok |
| København | [Reklamebærende byudstyr](https://www.opendata.dk/city-of-copenhagen/reklamebaerende-byudstyr) | native | line/point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Råden over vej - historisk](https://www.opendata.dk/city-of-copenhagen/raden-over-vej-historisk) | native | line/point | CSV, GeoJSON | 2016-05 | ok |
| København | [Råden over vej med historik](https://www.opendata.dk/city-of-copenhagen/raden-over-vej-med-historik) | native | line/point | CSV, GeoJSON | 2017-10 | ok |
| København | [Saltnings- og snerydningsniveau på kørebane](https://www.opendata.dk/city-of-copenhagen/saltnings-og-snerydningsniveau-pa-korebane) | link only | web map | LINK | 2019-01 | link ok |
| København | [Samlet afmærkning på veje](https://www.opendata.dk/city-of-copenhagen/afmaerkning_total) | native | line/point | CSV, GeoJSON, SHP | 2019-03 | ok |
| København | [Servicemarkering](https://www.opendata.dk/city-of-copenhagen/servicemarkering) | native | line/point | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Veje](https://www.opendata.dk/city-of-copenhagen/veje) | native | line | CSV, GeoJSON, SHP | 2020-01 | ok |
| København | [Vejmidter](https://www.opendata.dk/city-of-copenhagen/vejmidter) | native | line | CSV, GeoJSON, SHP | 2016-03 | ok |
| København | [Vejovertagelser](https://www.opendata.dk/city-of-copenhagen/vejovertagelser) | link only | web map | LINK | 2019-07 | error |
| København | [Vejregister](https://www.opendata.dk/city-of-copenhagen/vejregister) | native | line | CSV, GeoJSON, SHAPE | 2020-05 | ok |
| København | [Vintersaltningsruter](https://www.opendata.dk/city-of-copenhagen/vintersaltningsruter) | link only | web map | LINK | 2019-01 | link ok |
| Silkeborg | [Vejstatus i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/vejstatus-i-silkeborg-kommune) | native | line | CSV, GeoJSON, SHAPE | 2017-09 | ok |
| Silkeborg | [Vintervedligehold af veje i Silkeborg](https://www.opendata.dk/silkeborg-kommune/vintervedligehold-af-veje-i-silkeborg) | native | line | CSV, GeoJSON, SHAPE | 2017-11 | ok |
| Syddjurs | [Vejstatus](https://www.opendata.dk/syddjurs-kommune/syddjurs-vejstatus) | native | line | GeoJSON, SHP | 2016-12 | ok |
| Syddjurs | [Vintervedligeholdelse](https://www.opendata.dk/syddjurs-kommune/vintervedligeholdelse) | native | line | GeoJSON, SHP | 2016-12 | ok |
| Vejle | [Gravetilladelser](https://www.opendata.dk/city-of-vejle/gravetilladelser1) | native | polygon/point | JSON, KML | 2016-06 | ok |
| Vejle | [Igangværende anlægsprojekter](https://www.opendata.dk/city-of-vejle/igangvaerende-anlaegsprojekter) | native | polygon/point | JSON, KML, WFS, WMS | 2016-06 | ok |
| Vejle | [Snerydning (vintertjeneste)](https://www.opendata.dk/city-of-vejle/snerydning-vintertjeneste) | native | polygon/point | JSON, KML, WFS, WMS | 2015-05 | ok |
| Vejle | [Vejstatus](https://www.opendata.dk/city-of-vejle/vejstatus) | native | polygon/point | JSON, KMZ, WFS, WMS | 2015-05 | ok |

**Addresses and place names**

**Coverage on the portal:** 6 datasets; 2 municipalities (Aarhus, København).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Aarhus adressedimension](https://www.opendata.dk/city-of-aarhus/aarhus-adressedimension) | tabular | address point (lat/lon) + district codes | CSV | 2017-11 | sampled |
| Aarhus | [Koordinatsatte adresser i Aarhus](https://www.opendata.dk/city-of-aarhus/koordinatsatte-adresser-i-aarhus) | link only | pointer to DAWA | PDF | 2017-11 | link ok |
| Aarhus | [OpenStreetMap for Aarhus Kommune [Data Sæt 1]](https://www.opendata.dk/city-of-aarhus/openstreetmap-for-aarhus-kommune-data-saet-1) | native | OSM extract | OSM | 2017-11 | ok |
| København | [København adresser](https://www.opendata.dk/city-of-copenhagen/kobenhavn-adresser) | native | point | CSV, GeoJSON | 2022-08 | ok |
| København | [Stednavne knyttet til punkter](https://www.opendata.dk/city-of-copenhagen/stednavne-knyttet-til-punkter) | native | point | CSV, GeoJSON, SHP | 2016-03 | layer gone |
| København | [Stednavne, arealer](https://www.opendata.dk/city-of-copenhagen/stednavne-arealer) | native | point | CSV, GeoJSON, SHP | 2016-03 | layer gone |

**IoT sensors and live feeds**

**Coverage on the portal:** 6 datasets; 4 municipalities (Aarhus, Frederiksberg, Silkeborg, Vejle).

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| Aarhus | [Lufttemperatur & luftfugtighed ved Havnebadet i Aarhus](https://www.opendata.dk/city-of-aarhus/lufttemperatur-luftfugtighed-ved-havnebadet-i-aarhus) | tabular | sensor point | JSON_LD | 2025-01 |  |
| Aarhus | [Vandtemperatur - Havnebadet i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/vandtemperatur-havnebadet-i-aarhus) | tabular | sensor point | JSON_LD | 2025-01 |  |
| Aarhus | [Vejrstation - Vestre Kirkegård](https://www.opendata.dk/city-of-aarhus/vejrstation-vestre-kirkegard) | tabular | sensor point | JSON_LD | 2025-09 |  |
| Frederiksberg | [Vejrstationer Frederiksberg](https://www.opendata.dk/city-of-frederiksberg/vejrstationer-frederiksberg) | tabular | sensor point | JSON | 2025-03 |  |
| Silkeborg | [Persontællinger](https://www.opendata.dk/silkeborg-kommune/silkeborg-persontaellinger) | tabular | counting sites | JSON | 2022-07 |  |
| Vejle | [Smartbænke Vejle midtby - sensormålinger](https://www.opendata.dk/city-of-vejle/smartbaenke-vejle-midtby-sensormalinger) | tabular | 2 points | XLS | 2018-10 |  |

**Other**

**Coverage on the portal:** 12 datasets; 3 municipalities (Aarhus, København, Vejle); also "Andres data".

| Publisher | Dataset | Class | Geometry | Formats | Data date | Check |
|---|---|---|---|---|---|---|
| "Andres data" | [Tjekditnet.dk - Kortlægning af fastnetbredbånds- og mobildækning](https://www.opendata.dk/andres-data/tjekditnet-dk-kortlaegning-af-fastnetbredbands-og-mobildaekning) | link only | address (national portal, broadband) | HTML | 2020-02 | link ok |
| Aarhus | [CVR produktionsenheder i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/cvr-produktionsenheder) | tabular | address (CVR production units) | ODS, PDF, XLSX, XML | 2017-11 |  |
| Aarhus | [Kiosker i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/kiosker) | native | point | GeoJSON, KML | 2017-11 | ok |
| Aarhus | [Solcelleanlæg](https://www.opendata.dk/city-of-aarhus/solcelleanlaeg) | tabular | building (solar plants on schools) | CSV | 2020-07 |  |
| Aarhus | [Wifi i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/wifi-i-aarhus-kommune) | native | point (wifi) | APPLICATION/JAVASCRIPT, CSV, KML | 2017-11 | ok |
| København | [Byrum](https://www.opendata.dk/city-of-copenhagen/byrum) | native | polygon | GeoJSON | 2024-11 | ok |
| København | [Københavns erhvervshus](https://www.opendata.dk/city-of-copenhagen/kobenhavns-erhvervshus) | link only | web map | LINK | 2019-01 | link ok |
| København | [Miljøtilsynspligtige virksomheder](https://www.opendata.dk/city-of-copenhagen/miljotilsynspligtige-virksomheder) | link only | web map | LINK | 2019-01 | link ok |
| København | [Pladser](https://www.opendata.dk/city-of-copenhagen/pladser) | native | polygon | CSV, GeoJSON, SHP | 2015-12 | ok |
| København | [Skråfotos](https://www.opendata.dk/city-of-copenhagen/skrafotos) | tabular | point (photo centre) | CSV | 2020-01 |  |
| København | [Test af DCAT](https://www.opendata.dk/city-of-copenhagen/tast-af-dcat) | native | test | GeoJSON | 2025-12 | layer gone |
| Vejle | [Persontællinger i Vejle midtby](https://www.opendata.dk/city-of-vejle/persontaellinger-i-vejle-midtby) | tabular | single location (wifi counts) | CSV, PDF | 2018-06 |  |

</details>

## Datasets per publisher

| Publisher | Native | Link only | Tabular | Not locatable | Total |
|---|---|---|---|---|---|
| [København](https://www.opendata.dk/city-of-copenhagen) | 135 | 37 | 10 | 34 | 216 |
| [Aarhus](https://www.opendata.dk/city-of-aarhus) | 45 | 2 | 28 | 46 | 121 |
| [Vejle](https://www.opendata.dk/city-of-vejle) | 61 | 0 | 9 | 17 | 87 |
| [Hedensted](https://www.opendata.dk/hedensted-kommune) | 5 | 0 | 18 | 6 | 29 |
| [Syddjurs](https://www.opendata.dk/syddjurs-kommune) | 28 | 0 | 0 | 1 | 29 |
| [Randers](https://www.opendata.dk/randers-kommune) | 6 | 0 | 3 | 17 | 26 |
| [Ballerup](https://www.opendata.dk/ballerup-kommune) | 21 | 0 | 0 | 0 | 21 |
| [Open Data DK](https://www.opendata.dk/open-data-dk) | 0 | 0 | 0 | 20 | 20 |
| [Silkeborg](https://www.opendata.dk/silkeborg-kommune) | 16 | 1 | 2 | 0 | 19 |
| ["Andres data"](https://www.opendata.dk/andres-data) | 0 | 6 | 1 | 7 | 14 |
| [Frederiksberg](https://www.opendata.dk/city-of-frederiksberg) | 12 | 0 | 1 | 1 | 14 |
| [Horsens](https://www.opendata.dk/horsens-kommune) | 14 | 0 | 0 | 0 | 14 |
| [Region Midtjylland](https://www.opendata.dk/region-midtjylland) | 0 | 0 | 5 | 2 | 7 |
| [Egedal](https://www.opendata.dk/egedal-kommune) | 5 | 0 | 0 | 0 | 5 |
| [GeoDanmark](https://www.opendata.dk/geodanmark) | 2 | 0 | 0 | 0 | 2 |
| [Region Hovedstaden](https://www.opendata.dk/region-hovedstaden) | 0 | 0 | 0 | 2 | 2 |
| [Vejdirektoratet](https://www.opendata.dk/vejdirektoratet) | 2 | 0 | 0 | 0 | 2 |
| [Favrskov](https://www.opendata.dk/favrskov-kommune) | 0 | 1 | 0 | 0 | 1 |
| [Ikast-Brande](https://www.opendata.dk/ikast-brande-kommune) | 0 | 0 | 1 | 0 | 1 |
| [Viborg](https://www.opendata.dk/viborg-kommune) | 1 | 0 | 0 | 0 | 1 |

## Appendix: every locatable dataset

"CRS seen" is the coordinate system the endpoint check found in the first 16 KB, where it named
one. "Data date" is the newest resource date (see the traps above).

<details>
<summary>478 datasets</summary>

| # | Dataset | Publisher | Class | Theme | Geometry | Formats | Licence | Data date | CRS seen | Check |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [Dagtilbudsregisteret](https://www.opendata.dk/andres-data/dagtilbudsregisteret) | "Andres data" | link only | Daycare and after-school clubs | point (national register) | HTML | CC BY 4.0 | 2020-02 |  | link ok |
| 2 | [Dataudveksleren](https://www.opendata.dk/andres-data/dataudveksleren) | "Andres data" | link only | Traffic counts, speeds and road classes | portal | HTML | CC BY 4.0 | 2021-11 |  | link ok |
| 3 | [Den Danske Valgdatabase](https://www.opendata.dk/andres-data/den-danske-valgdatabase) | "Andres data" | link only | Population and socio-economics by district | polling district (portal) | HTML | CC BY 4.0 | 2020-02 |  | link ok |
| 4 | [GuideDanmark - oplevelser, overnatning, aktiviteter i hele Danmark](https://www.opendata.dk/andres-data/guidedanmark-oplevelser-overnantning-aktiviteter-i-hele-danmark) | "Andres data" | tabular | Outdoor facilities and routes (shelters, trails, beaches) | point (address/coords, national) | JSON, XLSX, XML | CC BY 4.0 | 2017-03 |  | sampled |
| 5 | [Institutionsregistret](https://www.opendata.dk/andres-data/institutionsregistret) | "Andres data" | link only | Schools | point (national register) | HTML | CC BY 4.0 | 2019-10 |  | link ok |
| 6 | [Plandata.dk](https://www.opendata.dk/andres-data/plandata-dk) | "Andres data" | link only | Local plans, municipal plans, urban renewal | polygon (national portal) | HTML | CC BY 4.0 | 2020-03 |  | TLS error |
| 7 | [Tjekditnet.dk - Kortlægning af fastnetbredbånds- og mobildækning](https://www.opendata.dk/andres-data/tjekditnet-dk-kortlaegning-af-fastnetbredbands-og-mobildaekning) | "Andres data" | link only | Other | address (national portal, broadband) | HTML | CC BY 4.0 | 2020-02 |  | link ok |
| 8 | [Offentlige toiletter i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/toiletter-i-aarhus-kommune) | Aarhus | native | Public toilets and drinking water | point | GeoJSON, WFS | CC BY 4.0 | 2020-01 | EPSG:25832 | ok |
| 9 | [Aarhus adressedimension](https://www.opendata.dk/city-of-aarhus/aarhus-adressedimension) | Aarhus | tabular | Addresses and place names | address point (lat/lon) + district codes | CSV | CC BY 4.0 | 2017-11 |  | sampled |
| 10 | [Aarhus Bycykel](https://www.opendata.dk/city-of-aarhus/aarhus-bycykel) | Aarhus | tabular | Bike parking, pumps, city bikes | point (lat/lon) | JSON | CC BY 4.0 | 2017-03 |  | sampled |
| 11 | [Aarhus Kommunes 3D-bymodel](https://www.opendata.dk/city-of-aarhus/aarhus-kommunes-3d-bymodel) | Aarhus | native | 3D city models and solar potential | 3D (DWG) | DWG | none stated | 2023-08 |  | ok |
| 12 | [Aarhusbolig](https://www.opendata.dk/city-of-aarhus/aarhusbolig) | Aarhus | tabular | Social (almene) housing | address (rents per tenancy) | XML | CC BY 4.0 | 2017-11 |  | sampled |
| 13 | [Affaldsbeholdere i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/affaldsbeholdere-i-aarhus-kommune) | Aarhus | native | Waste: bins, bottle banks, recycling centres | point | GeoJSON, WFS_SRVC | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 14 | [Arrangementer i Aarhus](https://www.opendata.dk/city-of-aarhus/arrangementer-i-aarhus) | Aarhus | native | Libraries, culture, sport and leisure facilities | point | GeoJSON | CC BY 4.0 | 2017-11 |  | ok |
| 15 | [Badevand Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/badevand-aarhus-kommune) | Aarhus | tabular | Bathing water and beaches | sensor point | JSON | CC0 | 2025-05 |  |  |
| 16 | [BBR-bygninger Aarhus](https://www.opendata.dk/city-of-aarhus/bbr-ejendomme-og-bbr-bygninger) | Aarhus | native | Buildings (BBR extracts) and housing stock | polygon/point | PDF, WFS | CC BY 4.0 | 2020-05 |  | HTTP 400 |
| 17 | [Befolkningsdata i Aarhus kommune](https://www.opendata.dk/city-of-aarhus/befolkningsdata-i-aarhus-kommune) | Aarhus | tabular | Population and socio-economics by district | school district (name/code) | CSV | CC BY 4.0 | 2016-11 |  | sampled |
| 18 | [Befolkningstal i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/befolkningstal-i-aarhus-kommune) | Aarhus | tabular | Population and socio-economics by district | city district (name) | DOCX, HTML, ODS, XLS | CC BY 4.0 | 2017-11 |  |  |
| 19 | [Belysningsarmaturer Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/belysningsarmaturer-aarhus-kommune) | Aarhus | native | Road network, road works, winter service, street furniture | point | GeoJSON, KML | CC BY 4.0 | 2017-11 |  | ok |
| 20 | [Bevaringsværdige bygninger i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/bevaringsvaerdige-bygninger-i-aarhus-kommune) | Aarhus | native | Listed and conservation-worthy buildings, heritage | polygon/point | GeoJSON, ODS, PDF, WFS_SRVC | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 21 | [Børn i dagtilbud](https://www.opendata.dk/city-of-aarhus/born-i-dagtilbud) | Aarhus | tabular | Daycare and after-school clubs | point (lat/lon) | CSV, JSON | CC BY 4.0 | 2020-05 |  | sampled |
| 22 | [Børn og unge enheder i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/born-og-unge-enheder-i-aarhus-kommune) | Aarhus | tabular | Schools | point (lat/lon) | CSV | CC BY 4.0 | 2017-11 |  | sampled |
| 23 | [Covid-19 i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/covid-19-aarhus-kommune) | Aarhus | tabular | Population and socio-economics by district | postcode |  | CC BY 4.0 | 2021-04 |  | sampled |
| 24 | [CVR produktionsenheder i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/cvr-produktionsenheder) | Aarhus | tabular | Other | address (CVR production units) | ODS, PDF, XLSX, XML | CC BY 4.0 | 2017-11 |  |  |
| 25 | [Cykelluftpumper](https://www.opendata.dk/city-of-aarhus/luftpumper_cykel) | Aarhus | native | Bike parking, pumps, city bikes | point | WFS | CC BY 4.0 | 2022-09 |  | ok |
| 26 | [Cykelringen](https://www.opendata.dk/city-of-aarhus/cykelringen) | Aarhus | native | Bike paths and cycle routes | line | WFS | CC BY 4.0 | 2022-09 |  | ok |
| 27 | [Cykelservicestationer](https://www.opendata.dk/city-of-aarhus/cykelservicestationer) | Aarhus | native | Bike parking, pumps, city bikes | point | WFS | CC BY 4.0 | 2022-09 |  | ok |
| 28 | [Cykelstativer i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/cykelparkering_aarhus) | Aarhus | native | Bike parking, pumps, city bikes | point | WFS_SRVC | CC BY 4.0 | 2022-09 |  | ok |
| 29 | [Cykelstier i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/cykelstier) | Aarhus | native | Bike paths and cycle routes | line | WFS_SRVC | CC BY 4.0 | 2022-09 |  | HTTP 400 |
| 30 | [Cykelterminal](https://www.opendata.dk/city-of-aarhus/cykelterminal) | Aarhus | native | Bike parking, pumps, city bikes | point | WFS_SRVC | CC BY 4.0 | 2022-09 |  | ok |
| 31 | [Ejendomme ejet af Aarhus Havn](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-aarhus-havn) | Aarhus | native | Public property ownership | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 32 | [Ejendomme ejet af Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-aarhus-kommune) | Aarhus | native | Public property ownership | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 33 | [Ejendomme ejet af Region Midtjylland i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-region-midtjylland) | Aarhus | native | Public property ownership | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 34 | [Ejendomme ejet af Staten i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/ejendomme-ejet-af-staten) | Aarhus | native | Public property ownership | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 35 | [Ejendomsfortegnelse](https://www.opendata.dk/city-of-aarhus/ejendomsfortegnelse) | Aarhus | tabular | Public property ownership | cadastral number | ODS, XLSX | CC BY 4.0 | 2017-11 |  |  |
| 36 | [Elevtal på Aarhus Kommunes folkeskoler](https://www.opendata.dk/city-of-aarhus/elevtal) | Aarhus | tabular | Schools | point (lat/lon) | CSV, JSON | CC BY 4.0 | 2020-03 |  | sampled |
| 37 | [Eventdatabasen](https://www.opendata.dk/city-of-aarhus/eventdatabasen) | Aarhus | tabular | Libraries, culture, sport and leisure facilities | venue (API) | API | CC BY 4.0 | 2017-05 |  |  |
| 38 | [Friluftsliv Aarhus](https://www.opendata.dk/city-of-aarhus/friluftslivtemaer_aarhus) | Aarhus | native | Outdoor facilities and routes (shelters, trails, beaches) | point/line/polygon | GeoJSON, WFS | CC BY 4.0 | 2020-01 | EPSG:25832 | ok |
| 39 | [Fællesråd i Aarhus](https://www.opendata.dk/city-of-aarhus/faellesrad-i-aarhus-kommune) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 40 | [Gravetilladelser](https://www.opendata.dk/city-of-aarhus/gravetilladelser2) | Aarhus | native | Road network, road works, winter service, street furniture | polygon | GeoJSON | CC BY 4.0 | 2017-01 |  | ok |
| 41 | [Hastighedsmålinger - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/hastighedsmalinger-aarhus-kommune) | Aarhus | tabular | Traffic counts, speeds and road classes | road name + location text | ODS, XLSX | CC BY 4.0 | 2017-11 |  | sampled |
| 42 | [Havnebadet - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/havnebadet-aarhus-kommune) | Aarhus | tabular | Bathing water and beaches | sensor point |  | none stated | 2023-06 |  |  |
| 43 | [Indvindingsoplande i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/indvindingsoplande) | Aarhus | native | Water supply and sewer catchments | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-01 | EPSG:25832 | ok |
| 44 | [Kiosker i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/kiosker) | Aarhus | native | Other | point | GeoJSON, KML | CC BY 4.0 | 2017-11 |  | ok |
| 45 | [Kloakoplande i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/kloakopland-i-aarhus-kommune-2014) | Aarhus | native | Water supply and sewer catchments | polygon | GeoJSON, WFS | CC BY 4.0 | 2019-11 | EPSG:25832 | ok |
| 46 | [Kolonihaver i Aarhus](https://www.opendata.dk/city-of-aarhus/kolonihaver-i-aarhus) | Aarhus | native | Green areas, parks, allotments, dog areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 47 | [Koordinatsatte adresser i Aarhus](https://www.opendata.dk/city-of-aarhus/koordinatsatte-adresser-i-aarhus) | Aarhus | link only | Addresses and place names | pointer to DAWA | PDF | CC BY 4.0 | 2017-11 |  | link ok |
| 48 | [Kulturhistoriske geodata](https://www.opendata.dk/city-of-aarhus/kulturhistoriske-geodata) | Aarhus | native | Listed and conservation-worthy buildings, heritage | point/polygon | GeoJSON, WFS | CC BY 4.0 | 2023-09 | EPSG:25832 | ok |
| 49 | [Legepladser i Aarhus](https://www.opendata.dk/city-of-aarhus/legepladser) | Aarhus | native | Playgrounds | point | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 50 | [Lokalsamfund i Aarhus](https://www.opendata.dk/city-of-aarhus/lokalsamfund-i-aarhus) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 51 | [Lufttemperatur & luftfugtighed ved Havnebadet i Aarhus](https://www.opendata.dk/city-of-aarhus/lufttemperatur-luftfugtighed-ved-havnebadet-i-aarhus) | Aarhus | tabular | IoT sensors and live feeds | sensor point | JSON_LD | none stated | 2025-01 |  |  |
| 52 | [Lystfiskeri i kommunale ferske vandløb, åer og søer, Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/lystfiskeri-i-kommunale-ferske-vandlob-aer-og-soer-aarhus-kommune) | Aarhus | native | Streams, lakes, nature protection, groundwater | line/polygon | GeoJSON, WFS | CC BY 4.0 | 2021-11 | EPSG:25832 | ok |
| 53 | [Miljøzone - Aarhus](https://www.opendata.dk/city-of-aarhus/miljozone-aarhus) | Aarhus | native | Air quality and low-emission zones | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 54 | [Naturbeskyttede områder med Bilag 4 arter](https://www.opendata.dk/city-of-aarhus/naturbeskyttede-omrader-med-bilag4-arter-2013) | Aarhus | native | Streams, lakes, nature protection, groundwater | line/polygon | GeoJSON, WFS | CC BY 4.0 | 2020-03 | EPSG:25832 | ok |
| 55 | [OpenStreetMap for Aarhus Kommune [Data Sæt 1]](https://www.opendata.dk/city-of-aarhus/openstreetmap-for-aarhus-kommune-data-saet-1) | Aarhus | native | Addresses and place names | OSM extract | OSM | CC BY 4.0 | 2017-11 |  | ok |
| 56 | [Parkering i Aarhus Kommune – Zoner, Tilladelser og Pladser](https://www.opendata.dk/city-of-aarhus/parkering-i-aarhus-kommune) | Aarhus | native | Parking zones, spaces, meters | polygon/point | GeoJSON, WFS | CC BY 4.0 | 2020-03 | EPSG:25832 | ok |
| 57 | [Parkeringsdata fra sensorer](https://www.opendata.dk/city-of-aarhus/parkeringsdata-fra-sensorer) | Aarhus | tabular | Parking zones, spaces, meters | API (sensor points) | JSON | CC0 | 2024-05 |  |  |
| 58 | [Parkeringshuse i Aarhus](https://www.opendata.dk/city-of-aarhus/parkeringshuse-i-aarhus) | Aarhus | tabular | Parking zones, spaces, meters | car park names | CSV, PDF | CC BY 4.0 | 2017-11 |  |  |
| 59 | [Planinformation - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/planinformation-aarhus-kommune) | Aarhus | link only | Local plans, municipal plans, urban renewal | web map | HTML | CC BY 4.0 | 2013-02 |  | HTTP 404 |
| 60 | [Postdistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/postdistrikt) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 61 | [Rekreative cykelruter](https://www.opendata.dk/city-of-aarhus/rekreative-cykelruter) | Aarhus | native | Bike paths and cycle routes | line | WFS_SRVC | CC BY 4.0 | 2022-09 |  | ok |
| 62 | [Ruter / Arrangementer i Aarhus](https://www.opendata.dk/city-of-aarhus/ruter-arrangementer-i-aarhus) | Aarhus | native | Libraries, culture, sport and leisure facilities | point | GeoJSON | CC BY 4.0 | 2017-01 |  | ok |
| 63 | [Skoledistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/skoledistrikter-i-aarhus) | Aarhus | native | School districts | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 64 | [Socioøkonomiske data, Aarhus - 2016](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus) | Aarhus | tabular | Population and socio-economics by district | statistical district (code) | XLSX | CC BY 4.0 | 2017-11 |  |  |
| 65 | [Socioøkonomiske data, Aarhus - 2017](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2017) | Aarhus | tabular | Population and socio-economics by district | statistical district (code) | XLS | CC BY 4.0 | 2018-06 |  |  |
| 66 | [Socioøkonomiske data, Aarhus - 2018](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2018) | Aarhus | tabular | Population and socio-economics by district | statistical district (code) | XLS | CC BY 4.0 | 2019-05 |  |  |
| 67 | [Socioøkonomiske data, Aarhus - 2019](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2019) | Aarhus | tabular | Population and socio-economics by district | statistical district (code) | XLS | CC BY 4.0 | 2019-05 |  |  |
| 68 | [Socioøkonomiske data, Aarhus - 2020](https://www.opendata.dk/city-of-aarhus/sociookonomiske-data-aarhus-2020) | Aarhus | tabular | Population and socio-economics by district | statistical district (code) | XLS | CC BY 4.0 | 2020-04 |  |  |
| 69 | [Socioøkonomiske data, Aarhus - 2021](https://www.opendata.dk/city-of-aarhus/sociooekonomiaarhus2021) | Aarhus | tabular | Population and socio-economics by district | statistical district (code) | XLS | CC BY 4.0 | 2021-06 |  | sampled |
| 70 | [Solcelleanlæg](https://www.opendata.dk/city-of-aarhus/solcelleanlaeg) | Aarhus | tabular | Other | building (solar plants on schools) | CSV | CC BY 4.0 | 2020-07 |  |  |
| 71 | [Statistikdistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/statistikdistrikter) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 72 | [Statistikdistrikter i Aarhus](https://www.opendata.dk/city-of-aarhus/statistikdistrikter-i-aarhus) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, KML | CC BY 4.0 | 2018-03 | EPSG:25832 | ok |
| 73 | [Supercykelsti i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/supercykelsti) | Aarhus | native | Bike paths and cycle routes | line | XML | CC BY 4.0 | 2022-09 |  | ok |
| 74 | [Tilladelse til opstilling af materiel](https://www.opendata.dk/city-of-aarhus/tilladelse-til-opstilling-af-materiel) | Aarhus | native | Road network, road works, winter service, street furniture | polygon | GeoJSON | CC BY 4.0 | 2017-01 |  | ok |
| 75 | [Trafiktal - Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/trafiktal-aarhus-kommune) | Aarhus | tabular | Traffic counts, speeds and road classes | road name + location text | ODS, XLSX | CC BY 4.0 | 2017-11 |  | sampled |
| 76 | [Valgdistrikter  (afstemningsområder) og valgsteder i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/valgdistrikter-og-valgsteder-i-aarhus-kommune) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-05 | EPSG:25832 | ok |
| 77 | [Vandløb i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/vandlob-aarhus-kommune) | Aarhus | native | Streams, lakes, nature protection, groundwater | line/polygon | GeoJSON, WFS | CC BY 4.0 | 2020-01 | EPSG:25832 | ok |
| 78 | [Vandtemperatur - Havnebadet i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/vandtemperatur-havnebadet-i-aarhus) | Aarhus | tabular | IoT sensors and live feeds | sensor point | JSON_LD | none stated | 2025-01 |  |  |
| 79 | [Vejnavne i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/vejnavne-i-aarhus-kommune) | Aarhus | native | Road network, road works, winter service, street furniture | line | GeoJSON, WFS | CC BY 4.0 | 2020-05 | EPSG:25832 | ok |
| 80 | [Vejrstation - Vestre Kirkegård](https://www.opendata.dk/city-of-aarhus/vejrstation-vestre-kirkegard) | Aarhus | tabular | IoT sensors and live feeds | sensor point | JSON_LD | none stated | 2025-09 |  |  |
| 81 | [Wifi i Aarhus Kommune](https://www.opendata.dk/city-of-aarhus/wifi-i-aarhus-kommune) | Aarhus | native | Other | point (wifi) | APPLICATION/JAVASCRIPT, CSV, KML | CC BY 4.0 | 2017-11 |  | ok |
| 82 | [Ældreområder i Aarhus](https://www.opendata.dk/city-of-aarhus/aeldreomrader-i-aarhus) | Aarhus | native | Administrative and statistical areas | polygon | GeoJSON, WFS | CC BY 4.0 | 2020-04 | EPSG:25832 | ok |
| 83 | [30 min Dyreturen](https://www.opendata.dk/ballerup-kommune/fda6c578-b984-4434-ac98-3a1befe642e8) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 84 | [30 min Fugleturen](https://www.opendata.dk/ballerup-kommune/69fb286b-95c7-4789-9031-0367a5ee3e6d) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 85 | [30 min Hundeturen](https://www.opendata.dk/ballerup-kommune/22a345a5-ced8-4d39-86c0-db7981461477) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 86 | [30 min Kunstruten](https://www.opendata.dk/ballerup-kommune/61e1c010-861a-40f9-9468-6a9316a3d6ed) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 87 | [30 min Motionsruten](https://www.opendata.dk/ballerup-kommune/b053e193-bae3-4d6c-80f8-ce45623d4b46) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 88 | [Banestyrelsens nyttehaver](https://www.opendata.dk/ballerup-kommune/bcc4e4bf-5ff3-4f65-bfdf-58cbc14dd224) | Ballerup | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 89 | [Cykelrute - 6 km ruten](https://www.opendata.dk/ballerup-kommune/4f06eeff-5658-4851-8db1-e6fcfe1b4a2d) | Ballerup | native | Bike paths and cycle routes | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 90 | [Cykelrute - Børneruten](https://www.opendata.dk/ballerup-kommune/0a5eebfd-294a-42aa-9bc8-f61ea884ea27) | Ballerup | native | Bike paths and cycle routes | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 91 | [Cykelrute - Kilderuten](https://www.opendata.dk/ballerup-kommune/ec225bef-36e8-4747-afd7-1239b07ab940) | Ballerup | native | Bike paths and cycle routes | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 92 | [Cykerute - Mountainbikeruten](https://www.opendata.dk/ballerup-kommune/04bd0bba-c537-4d5d-abbb-65222e31bb91) | Ballerup | native | Bike paths and cycle routes | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 93 | [Damgårdsruten](https://www.opendata.dk/ballerup-kommune/274cfdf6-128b-42a8-b719-63bd54e71ee8) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 94 | [Harrestrup Ådal 2 km](https://www.opendata.dk/ballerup-kommune/34b3bbf8-e5e3-4085-9b67-531e667481d8) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 95 | [Harrestrup Ådal 3 km](https://www.opendata.dk/ballerup-kommune/47464335-7425-44ea-ab63-83cca796adb6) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 96 | [Harrestrup Ådal 5 km](https://www.opendata.dk/ballerup-kommune/1d251ab9-9fff-4331-85a5-dd577998b23c) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 97 | [Hjortespringsruten](https://www.opendata.dk/ballerup-kommune/8abb65bc-fbc6-4d92-8094-572fc3e0f216) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 98 | [Kolonihaveforeninger](https://www.opendata.dk/ballerup-kommune/a6587e23-0efc-48d0-87b3-db54414cf784) | Ballerup | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 99 | [Lundegårdsruten](https://www.opendata.dk/ballerup-kommune/be9d26bd-7c72-4230-84df-8252ba079064) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 100 | [Nyttehaver](https://www.opendata.dk/ballerup-kommune/107963d4-6a27-45b5-8e66-58e203d0a24a) | Ballerup | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 101 | [Sct. Jacobsruten](https://www.opendata.dk/ballerup-kommune/c539764e-b3c1-4b97-8404-8fac7f26273a) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 102 | [Skovruten](https://www.opendata.dk/ballerup-kommune/ad244ae6-a58e-4f67-881c-7cfa4500f19d) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 | EPSG:4326 | ok |
| 103 | [Vængeruten](https://www.opendata.dk/ballerup-kommune/04b30509-9f25-4b54-92f7-d25914a27031) | Ballerup | native | Outdoor facilities and routes (shelters, trails, beaches) | line | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2017-02 |  | ok |
| 104 | [Naturpark Mølleåen](https://www.opendata.dk/egedal-kommune/naturpark-molleaen) | Egedal | native | Outdoor facilities and routes (shelters, trails, beaches) | polygon | JSON | CC BY 4.0 | 2017-04 | EPSG:25832 | ok |
| 105 | [Ny Egedal By parceller](https://www.opendata.dk/egedal-kommune/ny-egedal-by-parceller-1) | Egedal | native | Building plots for sale | polygon | JSON | CC BY 4.0 | 2017-04 | EPSG:25832 | ok |
| 106 | [Registreret Bjørneklo 2016](https://www.opendata.dk/egedal-kommune/registreret-bjorneklo-2016) | Egedal | native | Streams, lakes, nature protection, groundwater | point | GeoJSON | CC BY 4.0 | 2017-04 | EPSG:25832 | ok |
| 107 | [Riste, vandløb](https://www.opendata.dk/egedal-kommune/riste-vandlob) | Egedal | native | Streams, lakes, nature protection, groundwater | point | JSON | CC BY 4.0 | 2017-04 | EPSG:25832 | ok |
| 108 | [Vandløbsjournalisering](https://www.opendata.dk/egedal-kommune/egedal-vandlobsjournalisering-2016) | Egedal | native | Streams, lakes, nature protection, groundwater | point | JSON | CC BY 4.0 | 2017-12 | EPSG:25832 | ok |
| 109 | [Favrskov cykelruter](https://www.opendata.dk/favrskov-kommune/favrskov-cykelruter) | Favrskov | link only | Bike paths and cycle routes | pointer to udinaturen.dk |  | CC BY 4.0 | 2017-06 |  | link ok |
| 110 | [3D bymodel](https://www.opendata.dk/city-of-frederiksberg/3d-bymodel) | Frederiksberg | native | 3D city models and solar potential | 3D (DWG) | DWG, PDF | CC BY 4.0 | 2020-03 |  | ok |
| 111 | [biblioteker](https://www.opendata.dk/city-of-frederiksberg/bibliotek-frb) | Frederiksberg | native | Libraries, culture, sport and leisure facilities | point | GeoJSON | CC BY 4.0 | 2017-05 | EPSG:25832 | ok |
| 112 | [Dagtilbud](https://www.opendata.dk/city-of-frederiksberg/dagtilbud_frederiksberg) | Frederiksberg | native | Daycare and after-school clubs | point | GeoJSON | CC BY 4.0 | 2020-03 |  | ok |
| 113 | [Elbil ladestandere](https://www.opendata.dk/city-of-frederiksberg/elbil-ladestandere) | Frederiksberg | native | EV charging | point | GeoJSON | CC BY 4.0 | 2022-01 |  | ok |
| 114 | [Friluftstilbud](https://www.opendata.dk/city-of-frederiksberg/friluftstilbud_frederiksberg) | Frederiksberg | native | Outdoor facilities and routes (shelters, trails, beaches) | point | GeoJSON | CC BY 4.0 | 2020-03 |  | ok |
| 115 | [Offentlige toiletter](https://www.opendata.dk/city-of-frederiksberg/offentlige-toiletter-frederiksberg) | Frederiksberg | native | Public toilets and drinking water | point | GeoJSON | CC BY 4.0 | 2021-08 |  | ok |
| 116 | [Parkeringsautomater](https://www.opendata.dk/city-of-frederiksberg/parkeringsautomater) | Frederiksberg | native | Parking zones, spaces, meters | point/polygon | GeoJSON | CC BY 4.0 | 2020-03 |  | ok |
| 117 | [Parkeringspladser](https://www.opendata.dk/city-of-frederiksberg/parkering_frederiksberg) | Frederiksberg | native | Parking zones, spaces, meters | point/polygon | GeoJSON | CC BY 4.0 | 2025-05 |  | ok |
| 118 | [Parkeringszone](https://www.opendata.dk/city-of-frederiksberg/parkeringszone) | Frederiksberg | native | Parking zones, spaces, meters | point/polygon | SHP | CC BY 4.0 | 2025-05 |  | ok |
| 119 | [Parkeringszoner](https://www.opendata.dk/city-of-frederiksberg/parkeringszoner) | Frederiksberg | native | Parking zones, spaces, meters | point/polygon | GeoJSON, ZIP | none stated | 2026-03 | EPSG:25832 | ok |
| 120 | [Skoledistrikter](https://www.opendata.dk/city-of-frederiksberg/skoledistrikter_frederiksberg) | Frederiksberg | native | School districts | polygon | GeoJSON | CC BY 4.0 | 2026-02 |  | no URL |
| 121 | [Skraldespande](https://www.opendata.dk/city-of-frederiksberg/skraldespande-frb) | Frederiksberg | native | Waste: bins, bottle banks, recycling centres | point | GeoJSON | CC BY 4.0 | 2018-02 | EPSG:25832 | ok |
| 122 | [Vejrstationer Frederiksberg](https://www.opendata.dk/city-of-frederiksberg/vejrstationer-frederiksberg) | Frederiksberg | tabular | IoT sensors and live feeds | sensor point | JSON | none stated | 2025-03 |  |  |
| 123 | [Geografiske fagdata i GeoDanmark (GeoFA)](https://www.opendata.dk/geodanmark/geofa) | GeoDanmark | native | Outdoor facilities and routes (shelters, trails, beaches) | point/line/polygon (national GeoFA) | HTML, WFS, WMS, SQL API | CC BY 4.0 | 2021-11 |  | ok (WFS and SQL API queried) |
| 124 | [Skoledistrikter (98 kommuner)](https://www.opendata.dk/geodanmark/skoledistriktsdata) | GeoDanmark | native | School districts | polygon (national GeoFA) | API, HTML, WFS, WMS, SQL API | CC BY 4.0 | 2023-08 |  | ok (WFS and SQL API queried) |
| 125 | [Aldersfordeling fordelt på skoledistrikter](https://www.opendata.dk/hedensted-kommune/aldersfordeling-fordelt-pa-skoledistrikter) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 126 | [Aldersfordeling i Hedensted Kommune 2011-2016](https://www.opendata.dk/hedensted-kommune/aldersfordeling-i-hedensted-kommune-2011-2015) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 127 | [Befolkningsprognose Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/befolkningsprognose-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-05 |  |  |
| 128 | [Befolkningsprognose Hedensted Kommune 2018](https://www.opendata.dk/hedensted-kommune/befolkningsprognose-hedensted-kommune-2018) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 129 | [Beskæftgelsesstatus fordelt på skoledistrikt](https://www.opendata.dk/hedensted-kommune/beskaeftgelsesstatus-fordelt-pa-skoledistrikt) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 130 | [Beskæftigelsesstatus 2011-2016](https://www.opendata.dk/hedensted-kommune/beskaeftigelsesstatus) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-05 |  |  |
| 131 | [Boliger og boligtyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/boliger-og-boligtyper-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  | sampled |
| 132 | [Boligernes areal i Hedensted Kommune 2011-2016](https://www.opendata.dk/hedensted-kommune/boligernes-areal-i-hedensted-kommune-2011-2016) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 133 | [Boligernes ejerform i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/boligernes-ejerform-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 134 | [Boligtyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/boligtyper-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 135 | [Borgerne i Hedensted Kommunes civilstand 2011-2016](https://www.opendata.dk/hedensted-kommune/borgerne-i-hedensted-kommunes-civilstand-2011-2016) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 136 | [Familietyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/familietyper-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 137 | [Flytninger til og fra Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/flytninger-til-og-fra-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 138 | [Fordeling af statsborgerskaber i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/fordeling-af-statsborgerskaber-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 139 | [Fordeling af virksomheder og -typer i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/fordeling-af-virksomheder-og-typer-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 140 | [Fordelingen af familietyper i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/fordelingen-af-familietyper-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 141 | [Skoledistrikter i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/skoledistrikter-i-hedensted-kommune) | Hedensted | native | School districts | polygon | GeoJSON | CC BY 4.0 | 2018-01 | EPSG:25832 | ok |
| 142 | [Skoler og daginstitutionsdata](https://www.opendata.dk/hedensted-kommune/skoler-og-daginstitutionsdata) | Hedensted | native | Schools | point | GeoJSON, JSON, SHAPE, XLSX | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 143 | [Statsborgerskaber i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/statsborgerskaber-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2016-08 |  |  |
| 144 | [Til- og fraflytninger i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/til-og-fraflytninger-i-hedensted-kommune) | Hedensted | tabular | Population and socio-economics by district | school district (name) | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 145 | [Vandforsyning - forsyningsområder](https://www.opendata.dk/hedensted-kommune/vandforsyning-forsyningsomrader) | Hedensted | native | Water supply and sewer catchments | polygon | GeoJSON | CC BY 4.0 | 2018-02 | EPSG:25832 | ok |
| 146 | [Vejstatus i Hedensted Kommune](https://www.opendata.dk/hedensted-kommune/vejstatus-i-hedensted-kommune) | Hedensted | native | Road network, road works, winter service, street furniture | line | GeoJSON, SHAPE | CC BY 4.0 | 2020-02 | EPSG:25832 | ok |
| 147 | [Vinterklasser - vintervedligehold](https://www.opendata.dk/hedensted-kommune/vinterklasser-vintervedligehold) | Hedensted | native | Road network, road works, winter service, street furniture | line | GeoJSON, SHAPE | CC BY 4.0 | 2020-02 | EPSG:25832 | ok |
| 148 | [3D BYMODEL HORSENS KOMMUNE](https://www.opendata.dk/horsens-kommune/3d-bymodel-horsens-kommune) | Horsens | native | 3D city models and solar potential | 3D (SKP/DWG tiles) | .PDF, .ZIP, JPEG | CC BY 4.0 | 2023-02 |  | ok |
| 149 | [Biblioteker](https://www.opendata.dk/horsens-kommune/horsens-biblioteker) | Horsens | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 150 | [Boligarealer i Horsens Kommune 2011-2016](https://www.opendata.dk/horsens-kommune/boligarealer-i-horsens-kommune-2011-2016) | Horsens | native | Population and socio-economics by district | polygon (housing stock by area) | GeoJSON, MAPINFO | CC BY 4.0 | 2016-10 | EPSG:25832 | ok |
| 151 | [Boligers ejerform i Horsens Kommune 2011-2016](https://www.opendata.dk/horsens-kommune/boligers-ejerform-i-horsens-kommune-2011-2016) | Horsens | native | Population and socio-economics by district | polygon (housing stock by area) | GeoJSON, MAPINFO | CC BY 4.0 | 2016-10 | EPSG:25832 | ok |
| 152 | [Boligtyper i Horsens kommune 2011-2016](https://www.opendata.dk/horsens-kommune/boligtyper-i-horsens-kommune-2011-2016) | Horsens | native | Population and socio-economics by district | polygon (housing stock by area) | GeoJSON, MAPINFO | CC BY 4.0 | 2016-10 | EPSG:25832 | ok |
| 153 | [Daginstitution](https://www.opendata.dk/horsens-kommune/daginstitution) | Horsens | native | Daycare and after-school clubs | point | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 154 | [Fritidsklubber](https://www.opendata.dk/horsens-kommune/horsens-fritidsklub) | Horsens | native | Daycare and after-school clubs | point | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 155 | [Kommunegrænse](https://www.opendata.dk/horsens-kommune/kommunegraense) | Horsens | native | Administrative and statistical areas | polygon | GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 156 | [Parkering](https://www.opendata.dk/horsens-kommune/horsens-parkering) | Horsens | native | Parking zones, spaces, meters | point/polygon | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 157 | [Plejeboliger](https://www.opendata.dk/horsens-kommune/plejeboliger) | Horsens | native | Health care and elderly care | point | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 158 | [Skoler](https://www.opendata.dk/horsens-kommune/horsens-skoler) | Horsens | native | Schools | point | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 159 | [Trafiktallinger i Horsens Kommune](https://www.opendata.dk/horsens-kommune/trafiktaelling-horsens-kommune) | Horsens | native | Traffic counts, speeds and road classes | point | CSV, GeoJSON, GML | CC BY 4.0 | 2022-01 |  | ok |
| 160 | [Vej](https://www.opendata.dk/horsens-kommune/vej) | Horsens | native | Road network, road works, winter service, street furniture | line | GeoJSON | CC BY 4.0 | 2018-01 |  | HTTP 503 |
| 161 | [Ældreboliger](https://www.opendata.dk/horsens-kommune/horsens-aeldreboliger) | Horsens | native | Health care and elderly care | point | CSV, GeoJSON | CC BY 4.0 | 2017-12 |  | HTTP 503 |
| 162 | [Tekstilindustriens Ikast](https://www.opendata.dk/ikast-brande-kommune/tekstilindustriens-ikast) | Ikast-Brande | tabular | Listed and conservation-worthy buildings, heritage | point (UTM x/y) + address | CSV | CC BY 4.0 | 2017-11 |  | sampled |
| 163 | [Soldata 3D København](https://www.opendata.dk/city-of-copenhagen/soldata-3d-kobenhavn) | København | native | 3D city models and solar potential | raster/3D | ZIP | CC BY 4.0 | 2020-01 |  | ok |
| 164 | [100 års stormflod](https://www.opendata.dk/city-of-copenhagen/100-ars-stormflod) | København | native | Flooding, cloudbursts and climate adaptation | polygon | GeoJSON | none stated | 2024-11 |  | ok |
| 165 | [Affaldskurve](https://www.opendata.dk/city-of-copenhagen/affaldskurve) | København | native | Waste: bins, bottle banks, recycling centres | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 166 | [Afmærkning på veje](https://www.opendata.dk/city-of-copenhagen/afmaerkning-pa-veje-samlet) | København | native | Road network, road works, winter service, street furniture | line/point | DGN, DWG | CC BY 4.0 | 2020-01 |  | ok |
| 167 | [Afsluttede Klimatilpasningsprojekter](https://www.opendata.dk/city-of-copenhagen/afsluttede-klimatilpasningsprojekter) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | CSV, GeoJSON | CC BY 4.0 | 2022-08 |  | ok |
| 168 | [Afstemningsområder i København](https://www.opendata.dk/city-of-copenhagen/afstemningsomrader-i-kobenhavn) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-07 |  | ok |
| 169 | [Almene boliger pr. skoledistrikt](https://www.opendata.dk/city-of-copenhagen/almene-boliger-pr-skoledistrikt) | København | native | Social (almene) housing | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 170 | [Almene boligforeninger](https://www.opendata.dk/city-of-copenhagen/almene-boligforeninger) | København | native | Social (almene) housing | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 171 | [Anlægsprojekter](https://www.opendata.dk/city-of-copenhagen/anlaegsprojekter) | København | link only | Local plans, municipal plans, urban renewal | web map | LINK | CC BY 4.0 | 2018-12 |  | link ok |
| 172 | [Ansvarsområder for saltning på gangareal](https://www.opendata.dk/city-of-copenhagen/ansvarsomrader-for-saltning-pa-gangareal) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 173 | [Arealer til arrangementer](https://www.opendata.dk/city-of-copenhagen/arealer-til-arrangementer) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 174 | [Beboerlicensgader](https://www.opendata.dk/city-of-copenhagen/beboerlicensgader) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 175 | [Bebyggede områder](https://www.opendata.dk/city-of-copenhagen/bebyggede-omrader) | København | native | Buildings (BBR extracts) and housing stock | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 176 | [Belysning, armaturer](https://www.opendata.dk/city-of-copenhagen/belysning-armaturer) | København | native | Road network, road works, winter service, street furniture | line/point | ZIP | CC BY 4.0 | 2020-12 |  | ok |
| 177 | [Belysning, ledninger](https://www.opendata.dk/city-of-copenhagen/belysning-ledninger) | København | native | Road network, road works, winter service, street furniture | line/point | ZIP | CC BY 4.0 | 2020-01 |  | ok |
| 178 | [Belysning, master](https://www.opendata.dk/city-of-copenhagen/belysning-master) | København | native | Road network, road works, winter service, street furniture | line/point | ZIP | CC BY 4.0 | 2020-12 |  | ok |
| 179 | [Belysning, wirer](https://www.opendata.dk/city-of-copenhagen/belysning-wirer) | København | native | Road network, road works, winter service, street furniture | line/point | ZIP | CC BY 4.0 | 2020-12 |  | ok |
| 180 | [Bevaringsværdige træer](https://www.opendata.dk/city-of-copenhagen/bevaringsvaerdige-traeer) | København | native | Trees and tree canopy | point | GeoJSON | CC BY 4.0 | 2024-10 |  | ok |
| 181 | [Biblioteker](https://www.opendata.dk/city-of-copenhagen/biblioteker) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 | EPSG:4326 | ok |
| 182 | [Blomstrende by bede](https://www.opendata.dk/city-of-copenhagen/blomstrende-by-bede) | København | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 183 | [Boldbaner](https://www.opendata.dk/city-of-copenhagen/boldbaner) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 | EPSG:4326 | ok |
| 184 | [Bussluse områder](https://www.opendata.dk/city-of-copenhagen/bussluse-omrader) | København | native | Public transport (local) | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-05 | EPSG:4326 | ok |
| 185 | [Bycykelstationer](https://www.opendata.dk/city-of-copenhagen/bycykelstationer) | København | native | Bike parking, pumps, city bikes | point | CSV, GeoJSON, SHAPE-ZIP | CC BY 4.0 | 2022-04 |  | ok |
| 186 | [Bydele](https://www.opendata.dk/city-of-copenhagen/bydele) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON | none stated | 2016-03 |  | ok |
| 187 | [Byfornyelse](https://www.opendata.dk/city-of-copenhagen/byfornyelse) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 188 | [Byinventar](https://www.opendata.dk/city-of-copenhagen/byinventar) | København | native | Road network, road works, winter service, street furniture | line/point | GeoJSON | none stated | 2022-07 |  | ok |
| 189 | [Byliv - faktureringszoner](https://www.opendata.dk/city-of-copenhagen/byliv-faktureringszoner) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON | CC BY 4.0 | 2015-12 |  | ok |
| 190 | [Byrum](https://www.opendata.dk/city-of-copenhagen/byrum) | København | native | Other | polygon | GeoJSON | none stated | 2024-11 |  | ok |
| 191 | [Copenhagen Air View](https://www.opendata.dk/city-of-copenhagen/airview) | København | native | Air quality and low-emission zones | line (street-level measurements) | GeoJSON, JSON, ZIP | CC BY 4.0 | 2021-05 |  | ok |
| 192 | [Cykeldata](https://www.opendata.dk/city-of-copenhagen/cykeldata) | København | native | Bike paths and cycle routes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 193 | [Cykelparkeringstælling](https://www.opendata.dk/city-of-copenhagen/cykelparkeringstaelling) | København | native | Bike parking, pumps, city bikes | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2018-10 |  | ok |
| 194 | [Cykelparkeringstællinger](https://www.opendata.dk/city-of-copenhagen/cykelparkeringstaellinger) | København | native | Bike parking, pumps, city bikes | point | CSV, JSON, SHAPE | CC BY 4.0 | 2018-11 |  | ok |
| 195 | [Cykelstativer](https://www.opendata.dk/city-of-copenhagen/cykelstativer) | København | native | Bike parking, pumps, city bikes | point | CSV, GeoJSON, PDF, SHAPE-ZIP | CC BY 4.0 | 2022-04 |  | ok |
| 196 | [Cykeltaxaholdepladser](https://www.opendata.dk/city-of-copenhagen/cykeltaxaholdepladser) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 197 | [Cykeltaxi rødzone](https://www.opendata.dk/city-of-copenhagen/cykeltaxi-rodzone) | København | native | Road network, road works, winter service, street furniture | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 198 | [Daginstitutioner](https://www.opendata.dk/city-of-copenhagen/daginstitutioner) | København | native | Daycare and after-school clubs | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 199 | [Dagplejeområder](https://www.opendata.dk/city-of-copenhagen/dagplejeomrader) | København | link only | Daycare and after-school clubs | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 200 | [Den Blå Rute (kajak)](https://www.opendata.dk/city-of-copenhagen/den-bla-rute-kajak) | København | native | Outdoor facilities and routes (shelters, trails, beaches) | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 | EPSG:4326 | ok |
| 201 | [Den Blå Rute (overbæringssteder)](https://www.opendata.dk/city-of-copenhagen/den-bla-rute-overbaeringssteder) | København | native | Outdoor facilities and routes (shelters, trails, beaches) | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 | EPSG:4326 | ok |
| 202 | [Driftsområder](https://www.opendata.dk/city-of-copenhagen/driftsomrader) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-11 |  | ok |
| 203 | [Drikkevandsposter og springvand](https://www.opendata.dk/city-of-copenhagen/drikkevandsposter-og-springvand) | København | native | Public toilets and drinking water | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 204 | [Ejerlavsgrænse](https://www.opendata.dk/city-of-copenhagen/ejerlavsgraense) | København | link only | Administrative and statistical areas | web map | LINK | CC BY 4.0 | 2018-12 |  | link ok |
| 205 | [elbilladestandere (i drift og kommende) - charging stations](https://www.opendata.dk/city-of-copenhagen/ladestandere-elbil) | København | native | EV charging | point | GeoJSON | CC BY 4.0 | 2022-05 |  | ok |
| 206 | [Ensrettede gader](https://www.opendata.dk/city-of-copenhagen/ensrettede-gader) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-10 |  | ok |
| 207 | [Faste cykeltællinger](https://www.opendata.dk/city-of-copenhagen/faste-cykeltaellinger) | København | tabular | Traffic counts, speeds and road classes | counting-station id | XLSX | CC BY 4.0 | 2020-01 |  |  |
| 208 | [Flaske- og glascontainere](https://www.opendata.dk/city-of-copenhagen/flaske-og-glascontainere) | København | native | Waste: bins, bottle banks, recycling centres | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 209 | [Fortidsminder](https://www.opendata.dk/city-of-copenhagen/fortidsminder) | København | link only | Listed and conservation-worthy buildings, heritage | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 210 | [Fortidsminder beskyttelselinjer](https://www.opendata.dk/city-of-copenhagen/fortidsminder-beskyttelselinjer) | København | link only | Listed and conservation-worthy buildings, heritage | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 211 | [Fortovsrenhold, facadelængde](https://www.opendata.dk/city-of-copenhagen/fortovsrenhold-facadelaengde) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 212 | [Fredede og bevaringsværdige bygninger (SAVE)](https://www.opendata.dk/city-of-copenhagen/fredede-og-bevaringsvaerdige-bygninger-save) | København | link only | Listed and conservation-worthy buildings, heritage | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 213 | [Fredskov flade](https://www.opendata.dk/city-of-copenhagen/fredskov-flade) | København | link only | Green areas, parks, allotments, dog areas | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 214 | [Gadetræer](https://www.opendata.dk/city-of-copenhagen/gadetraeer) | København | native | Trees and tree canopy | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 215 | [Genbrugsstationer](https://www.opendata.dk/city-of-copenhagen/genbrugsstationer) | København | native | Waste: bins, bottle banks, recycling centres | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 216 | [Giv et praj - privat fællesvej](https://www.opendata.dk/city-of-copenhagen/giv-et-praj-privat-faellesvej) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 217 | [Gravetilladelser](https://www.opendata.dk/city-of-copenhagen/gravetilladelser) | København | native | Road network, road works, winter service, street furniture | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 218 | [Grundkort over Københavns Kommune - CAD format](https://www.opendata.dk/city-of-copenhagen/grundkort) | København | native | 3D city models and solar potential | CAD (DGN/DWG) | DGN, DWG | none stated | 2018-06 |  | ok |
| 219 | [Grundvand - potentialelinjer og pejlinger](https://www.opendata.dk/city-of-copenhagen/grundvand-potentialelinjer-og-pejlinger) | København | native | Streams, lakes, nature protection, groundwater | line/point | GeoJSON | CC BY 4.0 | 2022-04 |  | ok |
| 220 | [Grundvandsboringer (KK)](https://www.opendata.dk/city-of-copenhagen/grundvandsboringer-kk) | København | link only | Streams, lakes, nature protection, groundwater | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 221 | [Grønne områder](https://www.opendata.dk/city-of-copenhagen/gronne-omrader) | København | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 222 | [Grønne tage](https://www.opendata.dk/city-of-copenhagen/gronne-tage) | København | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2015-12 |  | ok |
| 223 | [Gårdhaver](https://www.opendata.dk/city-of-copenhagen/gardhaver) | København | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 224 | [Havneringen](https://www.opendata.dk/city-of-copenhagen/havneringen) | København | native | Bike paths and cycle routes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-06 |  | ok |
| 225 | [Historiske trafiktællinger](https://www.opendata.dk/city-of-copenhagen/faste-trafiktaellinger) | København | tabular | Traffic counts, speeds and road classes | counting-station id | XLSX | CC BY 4.0 | 2020-01 |  |  |
| 226 | [Hundeområder](https://www.opendata.dk/city-of-copenhagen/hundeomrader) | København | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 | EPSG:4326 | ok |
| 227 | [Højdekurver](https://www.opendata.dk/city-of-copenhagen/hojdekurver) | København | native | 3D city models and solar potential | CAD (DGN/DWG) | DWG | CC BY 4.0 | 2014-09 |  | HTTP 503 |
| 228 | [Idrætsanlæg](https://www.opendata.dk/city-of-copenhagen/idraetsanlaeg) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 | EPSG:4326 | ok |
| 229 | [Igangsatte Klimatilpasningsprojekter](https://www.opendata.dk/city-of-copenhagen/igangsatte-klimatilpasningsprojekter) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | CSV, GeoJSON | CC BY 4.0 | 2022-08 |  | ok |
| 230 | [Ikoniske træer vedtaget](https://www.opendata.dk/city-of-copenhagen/ikoniske-traeer-vedtaget) | København | link only | Trees and tree canopy | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 231 | [Kajkant ejerforhold](https://www.opendata.dk/city-of-copenhagen/kajkant-ejerforhold) | København | native | Road network, road works, winter service, street furniture | line | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 232 | [Kajnumre](https://www.opendata.dk/city-of-copenhagen/kajnumre) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON | CC BY 4.0 | 2015-12 |  | ok |
| 233 | [Karré](https://www.opendata.dk/city-of-copenhagen/karre) | København | native | Buildings (BBR extracts) and housing stock | polygon | CSV, GeoJSON | none stated | 2016-06 |  | ok |
| 234 | [Kartoner, indsamling](https://www.opendata.dk/city-of-copenhagen/kartoner-indsamling) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 235 | [KKORG - Københavns Kommunes organisatoriske enhed](https://www.opendata.dk/city-of-copenhagen/kkorg-kobenhavns-kommunes-organisatoriske-enhed) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON, LINK, SHP | CC BY 4.0 | 2019-03 |  | ok |
| 236 | [Kommuneplan 2019, detailhandelstruktur](https://www.opendata.dk/city-of-copenhagen/kommuneplan-2019-centerstruktur-for-detailhandel) | København | native | Local plans, municipal plans, urban renewal | polygon | GeoJSON | CC BY 4.0 | 2021-08 |  | ok |
| 237 | [Kommuneplan 2019, rammeområder](https://www.opendata.dk/city-of-copenhagen/kommuneplan-2019-rammeomrader) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON | CC BY 4.0 | 2021-07 |  | ok |
| 238 | [Kommuneplan 2019, Rækkefølge for byudvikling](https://www.opendata.dk/city-of-copenhagen/kommuneplan-2019-raekkefolge-for-byudvikling) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON | CC BY 4.0 | 2022-02 |  | ok |
| 239 | [Kommunevalget 2013](https://www.opendata.dk/city-of-copenhagen/kommunevalget-2013) | København | link only | Population and socio-economics by district | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 240 | [KP15 detailhandel](https://www.opendata.dk/city-of-copenhagen/kp15-detailhandel) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-11 |  | ok |
| 241 | [KP15 rammeområder](https://www.opendata.dk/city-of-copenhagen/kp15-rammeomrader) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-11 |  | ok |
| 242 | [KP15 retningslinjer](https://www.opendata.dk/city-of-copenhagen/kp15-retningslinjer) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-11 |  | ok |
| 243 | [Kulturhuse](https://www.opendata.dk/city-of-copenhagen/kulturhuse) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 | EPSG:4326 | ok |
| 244 | [Kvarterer](https://www.opendata.dk/city-of-copenhagen/kvarter) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON | CC BY 4.0 | 2021-07 |  | ok |
| 245 | [Kysttyper](https://www.opendata.dk/city-of-copenhagen/kysttyper) | København | native | Streams, lakes, nature protection, groundwater | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 246 | [København 3D bymodel](https://www.opendata.dk/city-of-copenhagen/kobenhavn-3d-bymodel) | København | native | 3D city models and solar potential | CAD (DGN/DWG) | DGN, DWG, DXF | none stated | 2020-08 |  | ok |
| 247 | [København adresser](https://www.opendata.dk/city-of-copenhagen/kobenhavn-adresser) | København | native | Addresses and place names | point | CSV, GeoJSON | CC BY 4.0 | 2022-08 |  | ok |
| 248 | [Københavns erhvervshus](https://www.opendata.dk/city-of-copenhagen/kobenhavns-erhvervshus) | København | link only | Other | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 249 | [Lastbil natparkering](https://www.opendata.dk/city-of-copenhagen/lastbil-natparkering) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-07 | EPSG:4326 | ok |
| 250 | [Legepladser](https://www.opendata.dk/city-of-copenhagen/legepladser1) | København | native | Playgrounds | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 251 | [Lokal Afledning af Regnvand - LAR](https://www.opendata.dk/city-of-copenhagen/lokal-afledning-af-regnvand-lar) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-07 |  | ok |
| 252 | [Lokalplaner](https://www.opendata.dk/city-of-copenhagen/lokalplaner) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-11 |  | ok |
| 253 | [Lokaludvalgsgrænser](https://www.opendata.dk/city-of-copenhagen/lokaludvalgsgraenser) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON | none stated | 2015-11 |  | ok |
| 254 | [Luftforurening](https://www.opendata.dk/city-of-copenhagen/luftforurening) | København | tabular | Air quality and low-emission zones | station (4 points) | CSV, HTML | CC BY 4.0 | 2019-07 |  |  |
| 255 | [luftkvalitet - prognose og varsling](https://www.opendata.dk/city-of-copenhagen/luftkvalitet-prognose-og-varsling) | København | tabular | Air quality and low-emission zones | API (forecast, stations) | JSON | none stated | 2025-03 |  |  |
| 256 | [Læskærm](https://www.opendata.dk/city-of-copenhagen/laeskaerm) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | layer gone |
| 257 | [Masterplansområder](https://www.opendata.dk/city-of-copenhagen/masterplansomrader) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON | CC BY 4.0 | 2022-08 |  | ok |
| 258 | [Metro](https://www.opendata.dk/city-of-copenhagen/metro) | København | link only | Public transport (local) | web map | LINK | CC BY 4.0 | 2018-12 |  | link ok |
| 259 | [Miljøtilsynspligtige virksomheder](https://www.opendata.dk/city-of-copenhagen/miljotilsynspligtige-virksomheder) | København | link only | Other | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 260 | [Miljøzoner](https://www.opendata.dk/city-of-copenhagen/miljozoner) | København | native | Air quality and low-emission zones | polygon | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 261 | [Mobile gadesalgspladser](https://www.opendata.dk/city-of-copenhagen/mobile-gadesalgspladser) | København | link only | Road network, road works, winter service, street furniture | web map |  | CC BY 4.0 | 2019-01 |  | link ok |
| 262 | [Mobilt gadesalg, zoner](https://www.opendata.dk/city-of-copenhagen/mobilt-gadesalg-zoner) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 263 | [Monumenter](https://www.opendata.dk/city-of-copenhagen/monumenter) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 264 | [Museer](https://www.opendata.dk/city-of-copenhagen/museer) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 | EPSG:4326 | ok |
| 265 | [Målesteder for badevandskvalitet](https://www.opendata.dk/city-of-copenhagen/malesteder-for-badevandskvalitet) | København | native | Bathing water and beaches | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 | EPSG:4326 | ok |
| 266 | [Områdefornyelse](https://www.opendata.dk/city-of-copenhagen/omradefornyelse) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 267 | [Områdefornyelse, projekter](https://www.opendata.dk/city-of-copenhagen/omradefornyelse-projekter) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 268 | [Oversigtskort](https://www.opendata.dk/city-of-copenhagen/oversigtskort) | København | native | Administrative and statistical areas | polygon | GeoJSON, PDF, SHP | CC BY 4.0 | 2019-11 |  | ok |
| 269 | [P-forbuds zone indre by](https://www.opendata.dk/city-of-copenhagen/p-forbuds-zone-indre-by) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 270 | [Parkeringshuse](https://www.opendata.dk/city-of-copenhagen/parkeringshuse) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 | EPSG:4326 | ok |
| 271 | [Parkeringspladser](https://www.opendata.dk/city-of-copenhagen/parkeringspladser) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 272 | [Parkeringstælling i zoner](https://www.opendata.dk/city-of-copenhagen/parkeringstaelling-i-zoner) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 273 | [Parkeringstællinger](https://www.opendata.dk/city-of-copenhagen/parkeringstaellinger) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, SHP | none stated | 2016-03 |  | ok |
| 274 | [Parkeringszoner information](https://www.opendata.dk/city-of-copenhagen/parkeringszoner-information) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON | CC BY 4.0 | 2020-06 |  | ok |
| 275 | [Parkomat transaktioner](https://www.opendata.dk/city-of-copenhagen/parkomat-transaktioner) | København | tabular | Parking zones, spaces, meters | parking-meter id | CSV | CC BY 4.0 | 2020-01 |  |  |
| 276 | [Parkomater](https://www.opendata.dk/city-of-copenhagen/parkomater) | København | native | Parking zones, spaces, meters | line/polygon/point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 277 | [Partnerskabstræer](https://www.opendata.dk/city-of-copenhagen/partnerskabstraeer) | København | link only | Trees and tree canopy | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 278 | [Pejlinger](https://www.opendata.dk/city-of-copenhagen/pejlinger) | København | link only | Streams, lakes, nature protection, groundwater | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 279 | [Pladselementer](https://www.opendata.dk/city-of-copenhagen/pladselementer) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | layer gone |
| 280 | [Pladser](https://www.opendata.dk/city-of-copenhagen/pladser) | København | native | Other | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 281 | [Plejehjem](https://www.opendata.dk/city-of-copenhagen/plejehjem) | København | link only | Health care and elderly care | web map |  | CC BY 4.0 | 2019-01 |  | link ok |
| 282 | [Private fællesvej klassificering](https://www.opendata.dk/city-of-copenhagen/private-faellesvej-klassificering) | København | link only | Road network, road works, winter service, street furniture | web map |  | CC BY 4.0 | 2019-01 |  | link ok |
| 283 | [Prøvetagningsstationer til badevandsanalyser](https://www.opendata.dk/city-of-copenhagen/provetagningsstationer-til-badevandsanalyser) | København | native | Bathing water and beaches | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-07 | EPSG:4326 | ok |
| 284 | [RCK behandlingsenheder](https://www.opendata.dk/city-of-copenhagen/rck-behandlingsenheder) | København | link only | Health care and elderly care | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 285 | [Reguleringsplaner](https://www.opendata.dk/city-of-copenhagen/reguleringsplaner) | København | link only | Local plans, municipal plans, urban renewal | web map | LINK | CC BY 4.0 | 2018-12 |  | error |
| 286 | [Reklamebærende byudstyr](https://www.opendata.dk/city-of-copenhagen/reklamebaerende-byudstyr) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 287 | [Roder](https://www.opendata.dk/city-of-copenhagen/roder) | København | native | Administrative and statistical areas | polygon | CSV, GeoJSON | none stated | 2015-11 |  | ok |
| 288 | [Råden over vej - historisk](https://www.opendata.dk/city-of-copenhagen/raden-over-vej-historisk) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON | CC BY 4.0 | 2016-05 |  | ok |
| 289 | [Råden over vej med historik](https://www.opendata.dk/city-of-copenhagen/raden-over-vej-med-historik) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON | CC BY 4.0 | 2017-10 |  | ok |
| 290 | [Saltnings- og snerydningsniveau på kørebane](https://www.opendata.dk/city-of-copenhagen/saltnings-og-snerydningsniveau-pa-korebane) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 291 | [Samlet afmærkning på veje](https://www.opendata.dk/city-of-copenhagen/afmaerkning_total) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2019-03 |  | ok |
| 292 | [Servicemarkering](https://www.opendata.dk/city-of-copenhagen/servicemarkering) | København | native | Road network, road works, winter service, street furniture | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 293 | [Servitut romertal](https://www.opendata.dk/city-of-copenhagen/servitut-romertal) | København | native | Local plans, municipal plans, urban renewal | polygon | CSV, GeoJSON, LINK, SHAPE | CC BY 4.0 | 2020-05 |  | ok |
| 294 | [Skoler](https://www.opendata.dk/city-of-copenhagen/skoler) | København | tabular | Schools | point (UTM x/y + WKT) | CSV | CC BY 4.0 | 2020-01 |  | sampled |
| 295 | [Skråfotos](https://www.opendata.dk/city-of-copenhagen/skrafotos) | København | tabular | Other | point (photo centre) | CSV | CC BY 4.0 | 2020-01 |  |  |
| 296 | [Skybrudsdeloplande](https://www.opendata.dk/city-of-copenhagen/skybrudsdeloplande) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | GeoJSON, SHP | CC BY 4.0 | 2015-11 |  | ok |
| 297 | [Skybrudsplan - bassiner og pladser](https://www.opendata.dk/city-of-copenhagen/skybrudsplan-bassiner-og-pladser) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | CSV, GeoJSON | CC BY 4.0 | 2022-08 |  | ok |
| 298 | [Skybrudsplan - skybrudsoplande](https://www.opendata.dk/city-of-copenhagen/skybrudsplan-skybrudsoplande) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | CSV, GeoJSON | CC BY 4.0 | 2015-11 |  | ok |
| 299 | [Skybrudsplan - veje og tunneller](https://www.opendata.dk/city-of-copenhagen/skybrudsplan-veje-og-tunneller) | København | native | Flooding, cloudbursts and climate adaptation | point/polygon | CSV, GeoJSON | CC BY 4.0 | 2022-08 |  | ok |
| 300 | [Sogngrænse](https://www.opendata.dk/city-of-copenhagen/sogngraense) | København | link only | Administrative and statistical areas | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 301 | [Stadsarkivet](https://www.opendata.dk/city-of-copenhagen/stadsarkivet) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 | EPSG:4326 | ok |
| 302 | [Stednavne knyttet til punkter](https://www.opendata.dk/city-of-copenhagen/stednavne-knyttet-til-punkter) | København | native | Addresses and place names | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | layer gone |
| 303 | [Stednavne, arealer](https://www.opendata.dk/city-of-copenhagen/stednavne-arealer) | København | native | Addresses and place names | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | layer gone |
| 304 | [Storbyhaver](https://www.opendata.dk/city-of-copenhagen/storbyhaver) | København | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-04 | EPSG:4326 | ok |
| 305 | [Strandbeskyttelse, flade](https://www.opendata.dk/city-of-copenhagen/strandbeskyttelse-flade) | København | link only | Streams, lakes, nature protection, groundwater | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 306 | [Strandbeskyttelse, umatrikulerede arealer (DAF)](https://www.opendata.dk/city-of-copenhagen/strandbeskyttelse-daf) | København | link only | Streams, lakes, nature protection, groundwater | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 307 | [SUF centre](https://www.opendata.dk/city-of-copenhagen/suf-centre) | København | link only | Health care and elderly care | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 308 | [Supercykelstier inspektion](https://www.opendata.dk/city-of-copenhagen/supercykelstier-inspektioner) | København | native | Bike paths and cycle routes | line/point | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2020-09 |  | ok |
| 309 | [Svømmehaller og havnebade](https://www.opendata.dk/city-of-copenhagen/svommehaller-mv) | København | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 310 | [Søbeskyttelseslinjer](https://www.opendata.dk/city-of-copenhagen/sobeskyttelseslinjer) | København | native | Streams, lakes, nature protection, groundwater | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-07 |  | ok |
| 311 | [Søer og vandløb](https://www.opendata.dk/city-of-copenhagen/soer-og-vandlob) | København | native | Streams, lakes, nature protection, groundwater | line/point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 312 | [Test af DCAT](https://www.opendata.dk/city-of-copenhagen/tast-af-dcat) | København | native | Other | test | GeoJSON | none stated | 2025-12 |  | layer gone |
| 313 | [TMF administrerede ejendomme](https://www.opendata.dk/city-of-copenhagen/tmf-administrerede-ejendomme) | København | native | Public property ownership | polygon/line | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-12 |  | ok |
| 314 | [Toiletter TMF](https://www.opendata.dk/city-of-copenhagen/toiletter-tmf) | København | native | Public toilets and drinking water | point | CSV, GeoJSON | CC0 | 2023-06 |  | ok |
| 315 | [Trafik, pullert](https://www.opendata.dk/city-of-copenhagen/pullert) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-11 |  | ok |
| 316 | [Trafikhastigheder](https://www.opendata.dk/city-of-copenhagen/trafikhastigheder) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-01 |  | ok |
| 317 | [Trafiksignaler](https://www.opendata.dk/city-of-copenhagen/trafiksignaler) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-01 |  | ok |
| 318 | [Trafikskilte](https://www.opendata.dk/city-of-copenhagen/trafikskilte) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, PDF, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 319 | [Trafiktal](https://www.opendata.dk/city-of-copenhagen/trafiktal) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP, XLSX | none stated | 2026-03 |  | ok |
| 320 | [Transitruter](https://www.opendata.dk/city-of-copenhagen/transitruter) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-04 | EPSG:4326 | ok |
| 321 | [tryghedszoner_skoler](https://www.opendata.dk/city-of-copenhagen/tryghedszoner_skoler) | København | native | Traffic counts, speeds and road classes | polygon | GeoJSON | none stated | 2025-12 |  | ok |
| 322 | [Træ basis (Kommunale træer)](https://www.opendata.dk/city-of-copenhagen/trae-basis-kommunale-traeer) | København | native | Trees and tree canopy | point | CSV, GeoJSON | none stated | 2019-04 |  | ok |
| 323 | [Trækronedække 2024 for København](https://www.opendata.dk/city-of-copenhagen/traekronedaekke-2024-for-kobenhavn) | København | native | Trees and tree canopy | raster/polygon | ZIP | none stated | 2025-04 |  | ok |
| 324 | [Tællestationer, trafiktællinger](https://www.opendata.dk/city-of-copenhagen/taellestationer) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 325 | [Tælling løb](https://www.opendata.dk/city-of-copenhagen/taelling-lob) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-09 |  | ok |
| 326 | [Tællinger, fodgængere](https://www.opendata.dk/city-of-copenhagen/taelling_fodg) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-09 |  | ok |
| 327 | [Tællinger, kryds](https://www.opendata.dk/city-of-copenhagen/taellinger-kryds) | København | tabular | Traffic counts, speeds and road classes | counting-station id | XLS, XLSX | CC BY 4.0 | 2020-01 |  |  |
| 328 | [Tællinger, ophold](https://www.opendata.dk/city-of-copenhagen/opholdstaellinger) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-11 |  | ok |
| 329 | [Tællinger, snittællinger](https://www.opendata.dk/city-of-copenhagen/taellinger-snittaellinger) | København | tabular | Traffic counts, speeds and road classes | counting-station id | XLS | CC BY 4.0 | 2020-01 |  |  |
| 330 | [Udsatte byområder](https://www.opendata.dk/city-of-copenhagen/udsatte-byomrader) | København | native | Vulnerable housing areas | polygon | GeoJSON, LINK, SHAPE | CC BY 4.0 | 2019-12 |  | ok |
| 331 | [Vegetationsdække 2024 for København](https://www.opendata.dk/city-of-copenhagen/vegetationsdaekke-2024-for-kobenhavn) | København | native | Green areas, parks, allotments, dog areas | raster/polygon | ZIP | none stated | 2025-04 |  | ok |
| 332 | [Veje](https://www.opendata.dk/city-of-copenhagen/veje) | København | native | Road network, road works, winter service, street furniture | line | CSV, GeoJSON, SHP | CC BY 4.0 | 2020-01 |  | ok |
| 333 | [Vejklasser](https://www.opendata.dk/city-of-copenhagen/vejklasser) | København | native | Traffic counts, speeds and road classes | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-04 |  | ok |
| 334 | [Vejmidter](https://www.opendata.dk/city-of-copenhagen/vejmidter) | København | native | Road network, road works, winter service, street furniture | line | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-03 |  | ok |
| 335 | [Vejovertagelser](https://www.opendata.dk/city-of-copenhagen/vejovertagelser) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-07 |  | error |
| 336 | [Vejregister](https://www.opendata.dk/city-of-copenhagen/vejregister) | København | native | Road network, road works, winter service, street furniture | line | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2020-05 |  | ok |
| 337 | [Vejstrækninger ejerforhold](https://www.opendata.dk/city-of-copenhagen/vejstraekninger-ejerforhold) | København | native | Public property ownership | line | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-12 |  | ok |
| 338 | [Vejstøj 2017](https://www.opendata.dk/city-of-copenhagen/vejstoj_2017) | København | link only | Road noise | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 339 | [Vejstøj 2022](https://www.opendata.dk/city-of-copenhagen/vejstoej_2022) | København | native | Road noise | polygon/point | ZIP | CC0 | 2024-04 |  | ok |
| 340 | [Vesterbrogade tællinger](https://www.opendata.dk/city-of-copenhagen/vesterbrogade-taellinger) | København | tabular | Traffic counts, speeds and road classes | counting-station id | XLS, XLSX | CC BY 4.0 | 2020-01 |  |  |
| 341 | [Vintersaltningsruter](https://www.opendata.dk/city-of-copenhagen/vintersaltningsruter) | København | link only | Road network, road works, winter service, street furniture | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 342 | [Vintervedligehold, cykelstier](https://www.opendata.dk/city-of-copenhagen/vintervedligehold-cykelstier) | København | link only | Bike paths and cycle routes | web map | LINK | CC BY 4.0 | 2019-01 |  | link ok |
| 343 | [Åbeskyttelseslinjer](https://www.opendata.dk/city-of-copenhagen/abeskyttelseslinjer) | København | native | Streams, lakes, nature protection, groundwater | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-07 |  | ok |
| 344 | [Ålegræs](https://www.opendata.dk/city-of-copenhagen/alegraes) | København | native | Streams, lakes, nature protection, groundwater | line/point | CSV, GeoJSON, SHP | CC BY 4.0 | 2015-12 |  | ok |
| 345 | [Antal krydsende cyklister over Randers Fjord](https://www.opendata.dk/randers-kommune/antal-krydsende-cyklister-over-randers-fjord) | Randers | tabular | Traffic counts, speeds and road classes | single counting site | CSV | CC BY 4.0 | 2023-02 |  |  |
| 346 | [Bybusruter](https://www.opendata.dk/randers-kommune/dorthe-bak-tofting) | Randers | native | Public transport (local) | line | KML, WFS | CC BY 4.0 | 2020-06 |  | ok |
| 347 | [El- og fjernvarmeanlæg i Randers Kommune](https://www.opendata.dk/randers-kommune/el-og-fjernvarmeanlaeg-i-randers-kommune) | Randers | tabular | Water supply and sewer catchments | postcode (heat plants) | CSV | none stated | 2023-09 |  | sampled |
| 348 | [Genbrugspladser](https://www.opendata.dk/randers-kommune/genbrugspladser) | Randers | native | Waste: bins, bottle banks, recycling centres | point | KML | CC BY 4.0 | 2019-12 |  | ok |
| 349 | [Haller](https://www.opendata.dk/randers-kommune/haller-i-randers) | Randers | native | Libraries, culture, sport and leisure facilities | point | KML, WFS | CC BY 4.0 | 2020-06 |  | ok |
| 350 | [Parkering](https://www.opendata.dk/randers-kommune/parkering_randers) | Randers | native | Parking zones, spaces, meters | point/polygon | WFS_SRVC | CC BY 4.0 | 2021-02 |  | HTTP 404 |
| 351 | [Skolebusruter](https://www.opendata.dk/randers-kommune/skolebusruter) | Randers | native | Public transport (local) | line | KML, WFS | CC BY 4.0 | 2020-06 |  | ok |
| 352 | [Skoler](https://www.opendata.dk/randers-kommune/skoler_randers) | Randers | native | Schools | point | KML, WFS | CC BY 4.0 | 2020-06 |  | ok |
| 353 | [Våd- og lavbundsområder i Randers kommune siden år 2000](https://www.opendata.dk/randers-kommune/vad-og-lavbundsomrader-i-randers-kommune-siden-ar-2000) | Randers | tabular | Streams, lakes, nature protection, groundwater | polygon (WKT in CSV) | CSV | CC BY 4.0 | 2023-03 |  | sampled |
| 354 | [Klinikker for Fysioterapi i Region Midt](https://www.opendata.dk/region-midtjylland/klinikker-for-fysioterapi-i-region-midt) | Region Midtjylland | tabular | Health care and elderly care | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | CC BY 4.0 | 2017-11 |  |  |
| 355 | [Lægepraksis i Region Midt](https://www.opendata.dk/region-midtjylland/laegepraksis-i-region-midt1) | Region Midtjylland | tabular | Health care and elderly care | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | CC BY 4.0 | 2017-11 |  | sampled |
| 356 | [Skadestuer i Region Midt](https://www.opendata.dk/region-midtjylland/skadestuer-i-region-midt) | Region Midtjylland | tabular | Health care and elderly care | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | CC BY 4.0 | 2017-11 |  |  |
| 357 | [Speciallæger i Region Midt](https://www.opendata.dk/region-midtjylland/speciallaeger-i-region-midt) | Region Midtjylland | tabular | Health care and elderly care | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | CC BY 4.0 | 2017-11 |  |  |
| 358 | [Tandlæger i Region Midt](https://www.opendata.dk/region-midtjylland/tandlaeger-i-region-midt) | Region Midtjylland | tabular | Health care and elderly care | point (UTM x/y), national 2015 SOR extract | CSV, PDF, ZIP | CC BY 4.0 | 2017-11 |  | sampled |
| 359 | [Badevandstemperaturer i søer](https://www.opendata.dk/silkeborg-kommune/badevandstemperaturer-for-soerne-i-silkeborg-kommune) | Silkeborg | tabular | Bathing water and beaches | sensor point | JSON | CC BY 4.0 | 2021-09 |  |  |
| 360 | [Børnedistrikter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-bornedistrikter) | Silkeborg | native | School districts | polygon | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2016-10 |  | ok |
| 361 | [Cykelruter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-cykelruter) | Silkeborg | native | Bike paths and cycle routes | line | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2016-10 |  | ok |
| 362 | [Cykelservice i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-cykelservice) | Silkeborg | native | Bike parking, pumps, city bikes | point | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2016-10 | EPSG:25832 | ok |
| 363 | [Cykelstier i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/cykelstier-i-silkeborg-kommune) | Silkeborg | link only | Bike paths and cycle routes | pointer to GeoDanmark |  | CC BY 4.0 | 2017-05 |  | error |
| 364 | [Daginstitutioner i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-daginstitutioner) | Silkeborg | native | Daycare and after-school clubs | point | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2016-06 |  | ok |
| 365 | [Faciliteter og byrum i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-faciliteter) | Silkeborg | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2016-10 |  | ok |
| 366 | [Grundsalg i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-grundsalg) | Silkeborg | native | Building plots for sale | polygon | CSV, GeoJSON | CC BY 4.0 | 2016-06 |  | ok |
| 367 | [Offentlige toiletter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/toiletter-i-silkeborg) | Silkeborg | native | Public toilets and drinking water | point | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-11 | EPSG:25832 | ok |
| 368 | [Oplev Gudenåen](https://www.opendata.dk/silkeborg-kommune/oplevgudenaa) | Silkeborg | native | Outdoor facilities and routes (shelters, trails, beaches) | point/line (JSON, web-map widget) | JSON | CC BY 4.0 | 2019-05 |  | ok |
| 369 | [Parkering: Forbudszoner i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/parkering-forbudszoner-i-silkeborg) | Silkeborg | native | Parking zones, spaces, meters | point/polygon | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-11 | EPSG:25832 | ok |
| 370 | [Parkeringspladser i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-parkering) | Silkeborg | native | Parking zones, spaces, meters | point/polygon | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-11 |  | ok |
| 371 | [Parkomater i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/parkomater-i-silkeborg) | Silkeborg | native | Parking zones, spaces, meters | point/polygon | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-11 | EPSG:25832 | ok |
| 372 | [Persontællinger](https://www.opendata.dk/silkeborg-kommune/silkeborg-persontaellinger) | Silkeborg | tabular | IoT sensors and live feeds | counting sites | JSON | CC BY 4.0 | 2022-07 |  |  |
| 373 | [Skoledistrikter i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/silkeborg-skoledistrikter) | Silkeborg | native | School districts | polygon | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2016-06 |  | layer gone |
| 374 | [Trafiktællinger i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/trafiktaellinger-silkeborg) | Silkeborg | native | Traffic counts, speeds and road classes | point/line | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-11 |  | ok |
| 375 | [Vejmidte trafikmodel i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/vejmidte-trafikmodel) | Silkeborg | native | Traffic counts, speeds and road classes | point/line | GeoJSON, SHAPE, WFS | CC BY 4.0 | 2017-05 |  | ok |
| 376 | [Vejstatus i Silkeborg Kommune](https://www.opendata.dk/silkeborg-kommune/vejstatus-i-silkeborg-kommune) | Silkeborg | native | Road network, road works, winter service, street furniture | line | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-09 |  | ok |
| 377 | [Vintervedligehold af veje i Silkeborg](https://www.opendata.dk/silkeborg-kommune/vintervedligehold-af-veje-i-silkeborg) | Silkeborg | native | Road network, road works, winter service, street furniture | line | CSV, GeoJSON, SHAPE | CC BY 4.0 | 2017-11 |  | ok |
| 378 | [Ankerpladser](https://www.opendata.dk/syddjurs-kommune/3c74b512-8766-439e-9900-3694719c106d) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 379 | [Badebroer i Syddjurs Kommune](https://www.opendata.dk/syddjurs-kommune/badebroer-i-syddjurs-kommune) | Syddjurs | native | Bathing water and beaches | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 380 | [Biblioteker](https://www.opendata.dk/syddjurs-kommune/1cc90562-f5e8-45ab-a7f0-4fc7d0832784) | Syddjurs | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 381 | [Blå flag havn](https://www.opendata.dk/syddjurs-kommune/28c32821-7a5a-418f-8d31-88644bd0f88c) | Syddjurs | native | Bathing water and beaches | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 382 | [Blå flag strand](https://www.opendata.dk/syddjurs-kommune/535c4be1-be45-4445-9952-7445a03b3f26) | Syddjurs | native | Bathing water and beaches | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 383 | [Boldbaner](https://www.opendata.dk/syddjurs-kommune/aa1a17a1-e2a6-4cd7-ab7c-b3e115c493bf) | Syddjurs | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 384 | [Borde og bænke](https://www.opendata.dk/syddjurs-kommune/5a7209cf-7294-48e8-a4e6-d264dc394cf1) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 385 | [Busruter, lokale](https://www.opendata.dk/syddjurs-kommune/busruter-lokale) | Syddjurs | native | Public transport (local) | line/point | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 386 | [Busstoppesteder](https://www.opendata.dk/syddjurs-kommune/busstoppesteder) | Syddjurs | native | Public transport (local) | line/point | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 387 | [Bådudsætning](https://www.opendata.dk/syddjurs-kommune/90060cbd-aeb8-45ac-97c0-a8674f50fab3) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 388 | [Cykelruter](https://www.opendata.dk/syddjurs-kommune/lokale-cykelruter) | Syddjurs | native | Bike paths and cycle routes | line | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 389 | [Cykelstier](https://www.opendata.dk/syddjurs-kommune/lokale-cykelstier) | Syddjurs | native | Bike paths and cycle routes | line | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 390 | [Fugletårn](https://www.opendata.dk/syddjurs-kommune/9d7657ea-08a4-4de4-bdd4-2cb4212c44f0) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 391 | [Haller i Syddjurs Kommune](https://www.opendata.dk/syddjurs-kommune/haller-i-syddjurs-kommune) | Syddjurs | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 392 | [Hundeskov](https://www.opendata.dk/syddjurs-kommune/4a2e7e9c-daa1-4798-a4a3-1c7d3b2ad039) | Syddjurs | native | Green areas, parks, allotments, dog areas | polygon | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 393 | [Kajak overnatning, primitiv](https://www.opendata.dk/syddjurs-kommune/b24a12c4-e4cb-4338-b93c-220baaab8b74) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 394 | [Kajak overnatning, shelter](https://www.opendata.dk/syddjurs-kommune/0cd7f38a-62f2-4d77-9849-896ef925484a) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 395 | [Kulturhuse](https://www.opendata.dk/syddjurs-kommune/9c547227-f2ad-4e30-a684-d0bc3dcc7acb) | Syddjurs | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 396 | [Madpakkehus](https://www.opendata.dk/syddjurs-kommune/217f518d-bc19-4f8b-90a6-9c8058359fc0) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 397 | [Natur- og Besøgscentre](https://www.opendata.dk/syddjurs-kommune/bab4a9e8-2f15-4155-a074-9cbae0ff5229) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 398 | [Parkeringspladser](https://www.opendata.dk/syddjurs-kommune/p-pladser) | Syddjurs | native | Parking zones, spaces, meters | point | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 399 | [Små lejrpladser](https://www.opendata.dk/syddjurs-kommune/50a685ec-d963-4258-b6db-878136f820bf) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 400 | [Svømmehaller](https://www.opendata.dk/syddjurs-kommune/1372265a-9c6f-4ffd-b5ed-786523c9d89e) | Syddjurs | native | Libraries, culture, sport and leisure facilities | point | CSV, GeoJSON, HTML, WFS, WMS, WMTS, XLSX, XYZ | CC BY 4.0 | 2019-09 |  | ok |
| 401 | [Toilettter i naturen](https://www.opendata.dk/syddjurs-kommune/toilettter-i-naturen) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | point | CSV, GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 402 | [Trafiktællinger](https://www.opendata.dk/syddjurs-kommune/syddjurs-trafiktaellinger) | Syddjurs | native | Traffic counts, speeds and road classes | point | WFS | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 403 | [Vandreruter i Syddjurs Kommune](https://www.opendata.dk/syddjurs-kommune/lokale-vandreruter) | Syddjurs | native | Outdoor facilities and routes (shelters, trails, beaches) | line | GeoJSON, SHP | none stated | 2016-12 | EPSG:25832 | ok |
| 404 | [Vejstatus](https://www.opendata.dk/syddjurs-kommune/syddjurs-vejstatus) | Syddjurs | native | Road network, road works, winter service, street furniture | line | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 405 | [Vintervedligeholdelse](https://www.opendata.dk/syddjurs-kommune/vintervedligeholdelse) | Syddjurs | native | Road network, road works, winter service, street furniture | line | GeoJSON, SHP | CC BY 4.0 | 2016-12 | EPSG:25832 | ok |
| 406 | [Trafikstøj](https://www.opendata.dk/vejdirektoratet/stojdata-mastra) | Vejdirektoratet | native | Road noise | point (state roads + 59 municipalities) | CSV, GeoJSON, SHAPE, XLSX | CC BY 4.0 | 2019-05 |  | ok |
| 407 | [Trafiktællinger – Nøgletal](https://www.opendata.dk/vejdirektoratet/taellinger-nogletal-mastra) | Vejdirektoratet | native | Traffic counts, speeds and road classes | point (state roads + 74 municipalities) | CSV, GeoJSON, SHAPE, XLSX | CC BY 4.0 | 2019-05 |  | ok |
| 408 | [3D bymodel af Jelling](https://www.opendata.dk/city-of-vejle/3d-bymodel-af-jelling) | Vejle | native | 3D city models and solar potential | 3D (DWG/DXF) | DWG, DXF | CC BY 4.0 | 2018-06 |  | ok |
| 409 | [3D bymodel af Vejle midtby](https://www.opendata.dk/city-of-vejle/3d-bymodel-af-vejle-og-centerbyer) | Vejle | native | 3D city models and solar potential | 3D (DWG/DXF) | ARCGIS GEODATABASE, DWG, DXF | CC BY 4.0 | 2018-06 |  | ok |
| 410 | [3D bymodel Børkop](https://www.opendata.dk/city-of-vejle/3d-bymodel-borkop) | Vejle | native | 3D city models and solar potential | 3D (DWG/DXF) | DWG, DXF | CC BY 4.0 | 2018-06 |  | ok |
| 411 | [3D bymodel Give](https://www.opendata.dk/city-of-vejle/3d-bymodel-give) | Vejle | native | 3D city models and solar potential | 3D (DWG/DXF) | DWG, DXF | CC BY 4.0 | 2018-06 |  | ok |
| 412 | [Almene boligforeninger i Vejle kommune](https://www.opendata.dk/city-of-vejle/almene-boligforeninger-i-vejle-kommune) | Vejle | native | Social (almene) housing | point/polygon | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2018-09 | EPSG:25832 | ok |
| 413 | [BBR-bygning - fritidsformål](https://www.opendata.dk/city-of-vejle/bbr-bygning-fritidsformal) | Vejle | native | Buildings (BBR extracts) and housing stock | point | JSON, KML, PDF | CC BY 4.0 | 2018-06 |  | service error |
| 414 | [BBR-bygning - Kontor, handel og transport](https://www.opendata.dk/city-of-vejle/bbr-bygning-kontor-handel-og-transport) | Vejle | native | Buildings (BBR extracts) and housing stock | point | JSON, KML, PDF | CC BY 4.0 | 2018-06 |  | service error |
| 415 | [BBR-bygning - kulturelle/offentlige formål](https://www.opendata.dk/city-of-vejle/bbr-bygning-kulturelle-formal) | Vejle | native | Buildings (BBR extracts) and housing stock | point | JSON, KML, PDF | CC BY 4.0 | 2018-06 |  | service error |
| 416 | [BBR-bygning-helårsbeboelse](https://www.opendata.dk/city-of-vejle/bbr-bygning-helarsbeboelse) | Vejle | native | Buildings (BBR extracts) and housing stock | point | JSON, KML, PDF, WMS | CC BY 4.0 | 2022-02 |  | service error |
| 417 | [BBR-bygning-industri, håndværk og forsyning](https://www.opendata.dk/city-of-vejle/bbr-bygning-industri-og-handvaerk) | Vejle | native | Buildings (BBR extracts) and housing stock | point | JSON, KML, PDF | CC BY 4.0 | 2018-06 |  | service error |
| 418 | [BBR-bygning-landbrug](https://www.opendata.dk/city-of-vejle/bbr-bygning-landbrug) | Vejle | native | Buildings (BBR extracts) and housing stock | point | JSON, KML, PDF | CC BY 4.0 | 2018-06 |  | service error |
| 419 | [Befolkningsprognose 2020-2034 fordelt på byområde](https://www.opendata.dk/city-of-vejle/befolkningsprognose-2018-2033-fordelt-pa-byomrade) | Vejle | tabular | Population and socio-economics by district | town / school district / postcode (name) | CSV, XLSX | CC BY 4.0 | 2020-06 |  | sampled |
| 420 | [Befolkningsprognose 2020-2034 fordelt på skoledistrikt](https://www.opendata.dk/city-of-vejle/befolkningsprognose-2018-2033-fordelt-pa-skoledistrikt) | Vejle | tabular | Population and socio-economics by district | town / school district / postcode (name) | CSV, XLSX | CC BY 4.0 | 2020-06 |  |  |
| 421 | [Cykelruter](https://www.opendata.dk/city-of-vejle/cykelruter) | Vejle | native | Bike paths and cycle routes | line | JSON, KMZ, WFS, WMS | none stated | 2015-05 | EPSG:25832 | ok |
| 422 | [Daginstitutioner i Vejle Kommune](https://www.opendata.dk/city-of-vejle/daginstitutioner-i-vejle-kommune) | Vejle | native | Daycare and after-school clubs | point | JSON, KML, WFS, WMS | CC BY 4.0 | 2015-11 | EPSG:25832 | ok |
| 423 | [Egtved 3D bymodel](https://www.opendata.dk/city-of-vejle/3d-bymodel-egtved) | Vejle | native | 3D city models and solar potential | 3D (DWG/DXF) | DWG, DXF | CC BY 4.0 | 2018-06 |  | ok |
| 424 | [Elevtalsprognose 2014/15 – 2028/29 fordelt på folkeskoler](https://www.opendata.dk/city-of-vejle/elevtalsprognose-2014-15-2028-29-fordelt-pa-folkeskoler) | Vejle | tabular | Schools | school name | XLSX | CC BY 4.0 | 2018-06 |  |  |
| 425 | [Erhvervsgrunde til salg](https://www.opendata.dk/city-of-vejle/erhvervsgrunde-salg) | Vejle | native | Building plots for sale | polygon | JSON, KMZ, WFS, WMS | none stated | 2015-05 | EPSG:25832 | ok |
| 426 | [Faciliteter og seværdigheder - rekreative ruter](https://www.opendata.dk/city-of-vejle/faciliteter-og-sevaerdigheder-rekreative-ruter) | Vejle | native | Outdoor facilities and routes (shelters, trails, beaches) | point/line | JSON, KMZ, WFS, WMS | none stated | 2015-05 | EPSG:25832 | ok |
| 427 | [Flaskecontainere i Vejle Kommune](https://www.opendata.dk/city-of-vejle/flaskecontainere-i-vejle-kommune) | Vejle | native | Waste: bins, bottle banks, recycling centres | point | JSON, KMZ, WFS, WMS | none stated | 2015-05 | EPSG:25832 | ok |
| 428 | [Folketal fordelt på byområder](https://www.opendata.dk/city-of-vejle/folketal-fordelt-pa-byomrader) | Vejle | tabular | Population and socio-economics by district | town / school district / postcode (name) | CSV, XLSX | CC BY 4.0 | 2022-02 |  | sampled |
| 429 | [Folketal fordelt på postnummer](https://www.opendata.dk/city-of-vejle/folketal-fordelt-pa-postnummer) | Vejle | tabular | Population and socio-economics by district | town / school district / postcode (name) | CSV, XLSX | CC BY 4.0 | 2022-03 |  |  |
| 430 | [Folketal fordelt på skoledistrikter](https://www.opendata.dk/city-of-vejle/folketal-fordelt-pa-skoledistrikter) | Vejle | tabular | Population and socio-economics by district | town / school district / postcode (name) | CSV, XLSX | CC BY 4.0 | 2022-02 |  | sampled |
| 431 | [Genbrugsstationer i Vejle Kommune](https://www.opendata.dk/city-of-vejle/placering-af-genbrugsstationer-i-vejle-kommune) | Vejle | native | Waste: bins, bottle banks, recycling centres | point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-05 | EPSG:25832 | ok |
| 432 | [Gravetilladelser](https://www.opendata.dk/city-of-vejle/gravetilladelser1) | Vejle | native | Road network, road works, winter service, street furniture | polygon/point | JSON, KML | CC BY 4.0 | 2016-06 |  | ok |
| 433 | [Igangværende anlægsprojekter](https://www.opendata.dk/city-of-vejle/igangvaerende-anlaegsprojekter) | Vejle | native | Road network, road works, winter service, street furniture | polygon/point | JSON, KML, WFS, WMS | CC BY 4.0 | 2016-06 | EPSG:25832 | ok |
| 434 | [Kommunale institutioner - handicap og psykiatri](https://www.opendata.dk/city-of-vejle/kommunale-institutioner-handicap-og-psykiatri) | Vejle | native | Health care and elderly care | point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 435 | [Kommunale institutioner - Plejecentre](https://www.opendata.dk/city-of-vejle/kommunale-institutioner-plejecentre) | Vejle | native | Health care and elderly care | point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 436 | [Kommunale institutioner - Ældreboliger](https://www.opendata.dk/city-of-vejle/kommunale-institutioner-aeldreboliger) | Vejle | native | Health care and elderly care | point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 437 | [Kommunens planer på PlansystemDK](https://www.opendata.dk/city-of-vejle/kommunens-planer-pa-plansystemdk) | Vejle | native | Local plans, municipal plans, urban renewal | polygon (Plandata WFS) | WFS, WMS | CC BY 4.0 | 2015-07 | EPSG:25832 | ok |
| 438 | [Offentlig ejede arealer](https://www.opendata.dk/city-of-vejle/offentlig-ejede-arealer) | Vejle | native | Public property ownership | polygon | JSON, KML, WFS, WMS | CC BY 4.0 | 2016-03 | EPSG:25832 | ok |
| 439 | [Overordnet cykelstinet](https://www.opendata.dk/city-of-vejle/overordnet-cykelstinet) | Vejle | native | Bike paths and cycle routes | line | JSON, KMZ, WFS, WMS | none stated | 2015-05 | EPSG:25832 | ok |
| 440 | [Oversvømmelseskort Oversvømmelser 100 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-100-ars-haendelse-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 441 | [Oversvømmelseskort Oversvømmelser 100 års hændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-100-ars-haendelse-2050) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 442 | [Oversvømmelseskort Oversvømmelser 100 års hændelse 2100](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-100-ars-haendelse-2100) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 443 | [Oversvømmelseskort Oversvømmelser 1000 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-oversvommelser-1000-ars-haendelse-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 444 | [Oversvømmelseskort Risikokortlægning 100 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-haendelse-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 445 | [Oversvømmelseskort Risikokortlægning 100 års hændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-haendelse-2050) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 446 | [Oversvømmelseskort Risikokortlægning 100 års hændelse 2100](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-haendelse-2100) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 447 | [Oversvømmelseskort Risikokortlægning 100 års vandløbshændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-vandlobshaendelse-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 448 | [Oversvømmelseskort Risikokortlægning 100 års vandløbshændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikokortlaegning-100-ars-vandlobshaendelse-2050) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 449 | [Oversvømmelseskort Risikoområde Vejle](https://www.opendata.dk/city-of-vejle/oversvommelseskort-risikoomrade-vejle) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 450 | [Oversvømmelseskort Total økonomisk skade 100 års hændelse i 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-haendelse-i-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 451 | [Oversvømmelseskort Total økonomisk skade 100 års hændelse i 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-haendelse-i-2050) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 452 | [Oversvømmelseskort Total økonomisk skade 100 års hændelse i 2100](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-haendelse-i-2100) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 453 | [Oversvømmelseskort Total økonomisk skade 100 års vandløbshændelse i 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-vandlobshaendelse-i-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 454 | [Oversvømmelseskort Total økonomisk skade 100 års vandløbshændelse i 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-100-ars-vandlobshaendelse-i-2050) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 455 | [Oversvømmelseskort Total økonomisk skade 1000 års hændelse samt 100 års vandløbshændelse i 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-total-okonomisk-skade-1000-ars-haendelse-samt-100-ars-vandlobshaendelse-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 456 | [Oversvømmelseskort Vandløbsoversvømmelser 100 års hændelse 2012](https://www.opendata.dk/city-of-vejle/oversvommelseskort-vandlobsoversvommelser-100-ars-haendelse-2012) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 457 | [Oversvømmelseskort Vandløbsoversvømmelser 100 års hændelse 2050](https://www.opendata.dk/city-of-vejle/oversvommelseskort-vandlobsoversvommelser-100-ars-haendelse-2050) | Vejle | native | Flooding, cloudbursts and climate adaptation | polygon | KML, SHP | CC BY 4.0 | 2018-06 |  | ok |
| 458 | [Parcelhusgrunde til salg](https://www.opendata.dk/city-of-vejle/parcelhusgrunde-til-salg) | Vejle | native | Building plots for sale | polygon | JSON, KMZ, WFS | CC BY 4.0 | 2018-09 | EPSG:25832 | ok |
| 459 | [Parkdrift - græsrabatter](https://www.opendata.dk/city-of-vejle/parkdrift-graesrabatter) | Vejle | native | Green areas, parks, allotments, dog areas | polygon/line/point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 460 | [Parkdrift - parkpleje (fladedata)](https://www.opendata.dk/city-of-vejle/parkdrift-parkpleje-fladedata) | Vejle | native | Green areas, parks, allotments, dog areas | polygon/line/point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 461 | [Parkdrift - parkpleje (linjedata)](https://www.opendata.dk/city-of-vejle/parkdrift-parkpleje-linjedata) | Vejle | native | Green areas, parks, allotments, dog areas | polygon/line/point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 462 | [Parkdrift - parkpleje (punktdata)](https://www.opendata.dk/city-of-vejle/parkdrift-parkpleje-punktdata) | Vejle | native | Green areas, parks, allotments, dog areas | polygon/line/point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-10 | EPSG:25832 | ok |
| 463 | [Parkdrift - træer](https://www.opendata.dk/city-of-vejle/parkdrift-traeer) | Vejle | native | Trees and tree canopy | point | GeoJSON, KMZ, WFS, WMS | CC BY 4.0 | 2020-05 |  | ok |
| 464 | [Parkeringspladser (kommunal ejede og offentlig tilgængelige)](https://www.opendata.dk/city-of-vejle/parkeringspladser-kommunal-ejede-og-offentlig-tilgaengelige) | Vejle | native | Parking zones, spaces, meters | point/polygon | JSON, KML, WFS, WMS | CC BY 4.0 | 2015-05 | EPSG:25832 | ok |
| 465 | [Parkeringspladser - handicap (kommunal ejede og offentligt tilgængelige)](https://www.opendata.dk/city-of-vejle/parkeringspladser-handicap-kommunal-ejede-og-offentligt-tilgaengelige) | Vejle | native | Parking zones, spaces, meters | point/polygon | JSON, KMZ | CC BY 4.0 | 2015-11 |  | ok |
| 466 | [Persontællinger i Vejle midtby](https://www.opendata.dk/city-of-vejle/persontaellinger-i-vejle-midtby) | Vejle | tabular | Other | single location (wifi counts) | CSV, PDF | CC BY 4.0 | 2018-06 |  |  |
| 467 | [Skoledistrikter i Vejle Kommune](https://www.opendata.dk/city-of-vejle/skoledistrikter-i-vejle-kommune) | Vejle | native | School districts | polygon | JSON, KML, WFS, WMS | CC BY 4.0 | 2015-11 |  | ok |
| 468 | [Skoler](https://www.opendata.dk/city-of-vejle/skoler1) | Vejle | native | Schools | point | JSON, KML, WFS, WMS | CC BY 4.0 | 2015-11 | EPSG:25832 | ok |
| 469 | [Smartbænke Vejle midtby - sensormålinger](https://www.opendata.dk/city-of-vejle/smartbaenke-vejle-midtby-sensormalinger) | Vejle | tabular | IoT sensors and live feeds | 2 points | XLS | CC BY 4.0 | 2018-10 |  |  |
| 470 | [Snerydning (vintertjeneste)](https://www.opendata.dk/city-of-vejle/snerydning-vintertjeneste) | Vejle | native | Road network, road works, winter service, street furniture | polygon/point | JSON, KML, WFS, WMS | CC BY 4.0 | 2015-05 | EPSG:25832 | ok |
| 471 | [Toiletter (offentlige) Vejle kommune](https://www.opendata.dk/city-of-vejle/toiletter1) | Vejle | native | Public toilets and drinking water | point | JSON, KML | none stated | 2016-05 |  | service error |
| 472 | [Trafiktal](https://www.opendata.dk/city-of-vejle/trafiktal1) | Vejle | native | Traffic counts, speeds and road classes | point/line | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-05 | EPSG:25832 | ok |
| 473 | [Vandreruter](https://www.opendata.dk/city-of-vejle/vandreruter1) | Vejle | native | Outdoor facilities and routes (shelters, trails, beaches) | point/line | JSON, KMZ, WFS, WMS | none stated | 2015-05 | EPSG:25832 | ok |
| 474 | [Vandstandsstationer med online målinger](https://www.opendata.dk/city-of-vejle/vandstandsstationer-med-online-malinger) | Vejle | native | Streams, lakes, nature protection, groundwater | point | JSON, KML, WFS, WMS | CC BY 4.0 | 2015-12 | EPSG:25832 | ok |
| 475 | [Vandværker forsyningsgrænser](https://www.opendata.dk/city-of-vejle/vandvaerker-forsyningsgraenser) | Vejle | native | Water supply and sewer catchments | polygon | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2018-09 | EPSG:25832 | ok |
| 476 | [Vejle Parkering - Live Data](https://www.opendata.dk/city-of-vejle/vejle-parkering) | Vejle | tabular | Parking zones, spaces, meters | API (car parks) | JSON | CC0 | 2022-11 |  |  |
| 477 | [Vejstatus](https://www.opendata.dk/city-of-vejle/vejstatus) | Vejle | native | Road network, road works, winter service, street furniture | polygon/point | JSON, KMZ, WFS, WMS | CC BY 4.0 | 2015-05 | EPSG:25832 | ok |
| 478 | [3D-bymodel af Viborg Kommune](https://www.opendata.dk/viborg-kommune/3d-bymodel-viborg) | Viborg | native | 3D city models and solar potential | 3D (GeoJSON) | GeoJSON | none stated | 2018-10 |  | ok |

</details>

## Not locatable

153 datasets cannot be placed on a map. They are:

- municipal statistics for the whole municipality: energy accounts, staff, budgets, library loans;
- documents and minutes;
- surveys;
- sensor feeds inside buildings;
- links to other statistics portals (StatBank, noegletal.dk, eSundhed).

Two datasets have no resources at all: København's `Skybrudsgrene` and Frederiksberg's
`Klimaveje`.

| Publisher | Datasets | Examples |
|---|---|---|
| Aarhus | 46 | Aarhus Byrådsarkiv; Aarhus Kommunes areal og afgrøder.; Aarhus Sognerådsarkiv; Aarhus i tal; … |
| København | 34 | Affald; Belysning; Belægningsgrad for midlertidige ophold; Besøgstællerdata; … |
| Open Data DK | 20 | Open Data DK Nyhedsbreve; Open Data DK ekstraordinær generalforsamling 2021; Open Data DK ekstraordinær generalforsamling februar 2023; Open Data DK ekstraordinær generalforsamling oktober 2023; … |
| Vejle | 17 | Aktivitetsmedlemstilskud 2015 til FOU; Andel elever, der har fuldført ungdomsuddannelse årgang 2006, 2007 og 2008; Ansatte på særlige vilkår; Arbejdsulykker; … |
| Randers | 17 | Biogas; Brændstofforbrug; Drivmidler for busser 6by-Nøgletal; El- og fjernvarmeproduktion og forbrug i Randers Kommune; … |
| "Andres data" | 7 | Data fra Dansk BiblioteksCenter; Fritvalgsdatabasen; Geotags data; Kommunale nøgletal; … |
| Hedensted | 6 | Arbejdspladser i Hedensted Kommune; Fraflytninger fra Hedensted Kommune; Regnskab 2012-2015 for Hedensted Kommune; Tilflytninger til Hedensted Kommune; … |
| Region Hovedstaden | 2 | Klima- og miljøregnskab for Region Hovedstaden; Regionalt cykelregnskab for Region Hovedstaden |
| Region Midtjylland | 2 | Energiregnskaber i Region Midtjylland 2013; Gongen |
| Frederiksberg | 1 | Klimaveje |
| Syddjurs | 1 | Indeklima: administrationsbygningen i Hornslet |
