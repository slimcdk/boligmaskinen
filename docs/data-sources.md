# Data sources and how they are fetched

Status as of 2026-10-07. This covers what the pilot uses today, what is gated behind an
application or a licence, and the practical side of fetching each source: endpoints,
sizes, cadence, licences and the traps found along the way.

The pilot covers all of Denmark. `pilot/pipeline/` fetches and processes everything;
`pilot/README.md` lists the commands.

## Principles

- **Only sources we may use.** Each source is open, licensed, or the user brings their own
  key or access. Nothing is scraped from sites whose terms forbid it.
- **Keep the raw download.** Every fetch should land unchanged in a raw archive with the
  date, URL, size and hash, and a `source_run` log row in the database. Processing always
  starts from the archive. A source that disappears or changes format then does not
  break what we already have, and we can re-run old versions.
- **Prefer bulk files over APIs** where both exist. They are faster, easier to cache and
  easier to diff between runs.
- **One coordinate system internally**: EPSG:25832 (ETRS89 / UTM 32N), the Danish standard.
  Every source in this list either uses it or converts cleanly.
- **Attribution travels with the data.** OSM (ODbL) and Rejseplanen (CC BY 4.0) require it.
  The map shows the attributions for what it draws.
- **Personal data.** Datatilsynet's 2024 decision on Boliglag means no owner names and no
  search by owner name. Sale prices are tied to addresses, so they need a GDPR legal basis
  (see EJF below).

## Sources in use

| Data | Source and access | Licence | Size and cadence | How we fetch it |
|---|---|---|---|---|
| Forests, lakes, coast, beaches, supermarkets, stations, main roads, address points, municipalities, national boundary | OpenStreetMap, Geofabrik extract `europe/denmark-latest.osm.pbf` | ODbL, attribution required | 0.5 GB, updated daily | One HTTPS download. `extract_osm.py` filters it with pyosmium (about 1.5 minutes for the whole country) |
| Road noise (Lden) | Miljøstyrelsen, strategic noise maps 2022: `files-miljoegis.mim.dk/noise2022/2022_noise_shp.zip` | Open public data | 2 GB zip; mapped every 5 years (next round 2027) | `remote_zip.py` reads the zip's directory with HTTP range requests and pulls only the 131 MB layer `eu_2022_vej_4m` |
| Planning zones (byzone, landzone, sommerhusområde) | Plandata.dk WFS `geoserver.plandata.dk/geoserver/wfs`, layer `pdk:theme_pdk_zonekort_v` | Open | 6,250 polygons, 19 MB GeoJSON for the whole country; updated continuously as plans change | One WFS GetFeature request with `count=20000` in EPSG:25832. Landzone is everything on land that is not byzone or sommerhusområde |
| Schools | STIL Institutionsregisteret, the JSON behind the public data-extract page (`institutionsregisteret.stil.dk/frontend-api/Institutions`) | Open | All institutions, a few MB; changes continuously | One GET with `Accept: application/json`. Active folkeskoler, friskoler and private schools (type 1012 and 1013) with coordinates |
| Daycare | STIL Dagtilbudsregisteret, CSV export on `dagtilbudsregister.stil.dk/Eksport.aspx` | Open | About 5,000 active units | ASP.NET page. Get the form, then post its `__VIEWSTATE` back with the "anvisningsenhed" export button. That level has coordinates |
| Wind turbines | Energistyrelsen, "Vinddata" master data register (xlsx) | Open | About 4,900 turbines in operation; uploaded monthly | Download the xlsx. The media id in the link changes with every upload, so the link is looked up on ens.dk's data overview page |
| Income tax, land tax, population, home burglaries | Danmarks Statistik StatBank API `api.statbank.dk/v1/data`, tables PSKAT, FOLK1A, STRAF22 | Open, no key | Tiny; yearly (tax, crime) and quarterly (population) | POST a JSON query, get JSON-stat. `"values": ["*"]` returns every area, including the whole country, the regions and Christiansø (code 411), so filter to the 98 municipality codes |
| Basemap | Protomaps daily planet build `build.protomaps.com/YYYYMMDD.pmtiles` (OpenStreetMap data) | ODbL (data), BSD (style) | The planet is well over 100 GB. Denmark up to zoom 12 is 75 MB (3,070 tiles), fetched in under a minute | `go-pmtiles extract` with the outline of Denmark (`basemap.sh`) fetches only those tiles by HTTP range requests |
| Basemap style, fonts, icons | `@protomaps/basemaps` (npm) and `protomaps.github.io/basemaps-assets` | BSD / OFL | Small | npm install and plain downloads |
| World map outside Denmark | Natural Earth 1:50m (`naciscdn.org/naturalearth/50m/...`) | Public domain | 2 MB after processing; rarely changes | Five zip downloads, converted by `build_world.py` |

## Sources not used yet, and what they need

| Data | Source | What it takes | Notes |
|---|---|---|---|
| Addresses, buildings, dwellings, cadastre, ownership type, property valuations | Datafordeleren: DAR, BBR, MAT, EBR, VUR, GeoDanmark | A free user and API key at datafordeler.dk | Build only against the GraphQL API and the file downloads: the old REST and WFS services close on **15 January 2027**. Signing up has been troublesome (login failing), so this is still waiting. Klimadatastyrelsen merges into DMI on **1 December 2026**, so URLs and contacts may move |
| **Sale prices (købesum)** | EJF (Ejerfortegnelsen) via Datafordeleren | An application to Geodatastyrelsen (GST). Requires MitID Erhverv, OAuth, a whitelisted IP, a stated purpose and a GDPR legal basis | The only official source of prices. Råd til Bolig documents that it gets EJF this way, so a small company can be granted access |
| Mortgages, servitudes, deeds | Tinglysning (tinglysning.dk) | System access needs "storkunde" status and a systembruger | Bulk access is effectively closed. The OCES-only HTTP API closes on **6 November 2026**. Domstol.dk's ETL page sits behind a Cloudflare challenge, which we do not try to bypass |
| Homes for sale (listings) | Boligsiden datasalg, Geomatic Udbudsdata, or an aggregator with the user's own key | A licence, or the user's own access | Boligsiden and Boliga forbid scraping. A legal stop-gap is to parse the user's own search-alert e-mails |
| School results and well-being | uddannelsesstatistik.dk API (Børne- og Undervisningsministeriet) | A free key | Grades, well-being and transition rates per school: a natural input for a school block |
| School districts | GeoFA (skoledistrikter) | Open | Which school a home belongs to, rather than the nearest school |
| Public transport | Rejseplanen GTFS feed | CC BY 4.0 via Rejseplanen Labs (sign-up) | Needed for real travel times by bus and train together with OpenTripPlanner. The pilot only estimates from straight-line distance |
| Road and bike routing | OSM through Valhalla or OSRM (self-hosted) | ODbL | Replaces the straight-line travel-time estimate |
| Reviews of daycare and schools | Google Places and similar | Their terms forbid storing the data or using it for filtering | Not usable. Official quality data (above) is the alternative |
| Municipal open data | OpenData.dk | Varies per municipality | Patchy and inconsistent between municipalities; check per dataset |

## Practical aspects of fetching

- **Range requests save a lot.** The noise archive (2 GB) and the Protomaps planet (120 GB)
  are only read in part. Both servers support HTTP range requests. This should become a reusable
  "remote archive" adapter in the ETL.
- **Links that move.** ENS changes the xlsx media id every month. The Dagtilbud export
  depends on ASP.NET form state. Both need a scraper of the landing page that finds the
  current link, and a check that fails loudly when the page changes.
- **Check before downloading.** Use `ETag` and `If-Modified-Since` where the server
  supports them (Geofabrik, Natural Earth, Protomaps). Otherwise compare the hash of the
  new file with the archived one before processing.
- **Schedules follow the source.**
  - Nightly: OSM, Plandata, STIL, and later DAR and BBR.
  - Monthly: ENS.
  - Yearly: tax and crime from DST, and the valuations.
  - Every 5 years: noise maps.
  - Weekly: the basemap.
  - These map directly to pg-boss cron jobs.
- **Sizes for the whole country.**
  - The OSM extract is 0.5 GB and the filtered features 45 MB.
  - The 100 m grid is 17.6 million cells. Building every layer takes about 2.5 minutes
    and 3.7 GB of memory.
  - The browser gets a 200 m grid: 4.3 million cells, of which 1.05 million are land and
    460,000 have homes. That is 7 MB of layers, plus 75 MB of basemap fetched in 5 MB
    parts as needed.
- **Disk.** Raw downloads for the pilot are about 0.7 GB. The development machine's disk
  is nearly full, so the archive should live on a separate volume or object storage.
