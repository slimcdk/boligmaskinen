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
- **Every source is credited as it asks**, in "About the data" (`SOURCES` in
  `frontend/src/app/panel/about-dialog.ts`): what it gives, its licence and its credit. The terms were
  checked on the providers' own pages on 2026-10-09; see [Licences and credits](#licences-and-credits).
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

## Licences and credits

Checked on the providers' own pages on 2026-10-09.

| Source | Licence or terms | Credit |
|---|---|---|
| OpenStreetMap | [ODbL 1.0](https://www.openstreetmap.org/copyright), share-alike | "© OpenStreetMap contributors", linked to the copyright page |
| Miljøstyrelsen, noise mapping 2022 | CC BY 4.0 (Miljøstyrelsen's INSPIRE metadata; the download says nothing) | "Støjkortlægning 2022: Miljøstyrelsen", and that we changed it |
| Plandata.dk, zone map | CC BY 4.0 ([webservices](https://www.plandata.dk/webservices/introduktion-til-webservices)) | "Zonekort: Plan- og Landdistriktsstyrelsen, Plandata.dk", and that we changed it |
| STIL Institutionsregisteret and Dagtilbudsregisteret | No licence stated; STIL calls the daycare data free for everyone | A courtesy credit to Styrelsen for It og Læring |
| Energistyrelsen, wind turbines | [Website terms](https://ens.dk/om-os/datapolitik): free with the source named, not to be changed or distorted | "Kilde: Energistyrelsen"; derived values are marked as our own calculations |
| Danmarks Statistik | [Free with the source named](https://www.dst.dk/da/presse/kildeangivelse), as CC BY 4.0; not the logo | "Egne beregninger baseret på tal fra Danmarks Statistik", with links to the tables |
| Protomaps | Tiles: ODbL produced work. Style: CC0. Code: BSD-3-Clause | "Protomaps © OpenStreetMap" (Protomaps' own credit is a request, not a duty) |
| ESA WorldCover 2020, land cover in Protomaps' tiles up to zoom 7 | CC BY 4.0 | "© ESA WorldCover project 2020 / Contains modified Copernicus Sentinel data (2020) processed by ESA WorldCover consortium" |
| Noto fonts and Mapzen icons (basemaps-assets) | SIL OFL 1.1 and MIT | Copyright notices; the licence texts must go with the copies we serve |
| Natural Earth | Public domain | None needed; "Made with Natural Earth" |

- **Where OpenStreetMap's credit goes.** OSMF's [attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
  ask for it on the map without a click. It may go away when the map is first used, or after five
  seconds, as long as it can be found again, such as under "About". So the map shows "© OpenStreetMap"
  until it is moved or for five seconds, and "About the data" has the rest.
- **Open:**
  - The data pack should carry the font and icon licence texts; the jobs that build it (milestone 2)
    add them.
  - Data layers made from OSM are a derived database. If an instance is ever public, it must offer
    them or the way they are made (ODbL 4.6); publishing the pipeline does that (milestone 7).

## Sources not used yet, and what they need

The public sources beyond the ones above, from Danmarks Miljøportal, Klimadatastyrelsen, Miljøstyrelsen, DMI, GEUS, Vejdirektoratet and others, were checked on the providers' own pages on 2026-10-09: [public-data.md](public-data.md) has the details and the links.

| Data | Source | What it takes | Notes |
|---|---|---|---|
| Addresses, buildings, dwellings, cadastre, ownership type, property valuations | Datafordeleren: DAR, BBR, MAT, EBR, VUR, GeoDanmark | A free user and API key at datafordeler.dk | Build only against the GraphQL API and the file downloads: the old REST and WFS services close on **15 January 2027**. Signing up has been troublesome (login failing), so this is still waiting. Klimadatastyrelsen merges into DMI on **1 December 2026**, so URLs and contacts may move. BBR alone gives, per building and dwelling: use, year built and rebuilt, areas, floors, rooms, roof and wall materials, heating and fuel, water and drains, kitchen and bath, and listed status ([geodata-info.dk](https://geodata-info.dk/srv/api/records/b49995f6-f194-4f31-8a81-ae3aa0a0f2dd), [Datafordeleren](https://datafordeler.dk/dataoversigt/bygnings-og-boligregistret-bbr/bbr/)) |
| **Sale prices (købesum)** | EJF (Ejerfortegnelsen) via Datafordeleren | An application to Geodatastyrelsen (GST). Requires MitID Erhverv, OAuth, a whitelisted IP, a stated purpose and a GDPR legal basis | The only official source of prices. Råd til Bolig documents that it gets EJF this way, so a small company can be granted access |
| Deeds (with the price), mortgages, servitudes, owners | Tinglysning (tinglysning.dk) | System access needs "storkunde" status and a systembruger | Bulk access is effectively closed. The OCES-only HTTP API closes on **6 November 2026**. Domstol.dk's ETL page sits behind a Cloudflare challenge, which we do not try to bypass |
| Homes for sale (listings) | Boligsiden datasalg, Geomatic Udbudsdata, or an aggregator with the user's own key | A licence, or the user's own access | Boligsiden and Boliga forbid scraping. A legal stop-gap is to parse the user's own search-alert e-mails |
| School results and well-being | uddannelsesstatistik.dk API (Børne- og Undervisningsministeriet) | A free key | Grades, well-being, absence and transition rates per school: a natural input for a school block. Free, also commercially, with "Kilde: Uddannelsesstatistik.dk" and the data unchanged (checked 2026-10-09) |
| School districts | GeoFA (skoledistrikter, theme 5710), WFS `geofa.geodanmark.dk/ows/fkg/fkg` | Open: CC BY 4.0, credit "@geodanmark" | Which school a home belongs to, rather than the nearest school. All 98 municipalities, 1,366 districts (checked live 2026-10-09). With the results above: how the home's own school does |
| Public transport | Rejseplanen GTFS feed | CC BY 4.0 via Rejseplanen Labs (sign-up); static data may be used commercially, unchanged | Needed for real travel times by bus and train together with OpenTripPlanner, and for departures per hour near each cell (better than OSM's stops, which only say a stop exists). New feed about every 14 days. The Rejseplan API is free only for non-commercial use, up to 50,000 calls a month. The pilot only estimates from straight-line distance |
| Road and bike routing | OSM through Valhalla or OSRM (self-hosted) | ODbL | Replaces the straight-line travel-time estimate |
| Reviews of daycare and schools | Google Places and similar | Their terms forbid storing the data or using it for filtering | Not usable. Official quality data (above) is the alternative |
| Solar parks, and the size of wind turbines | Energistyrelsen's master data register, served by Plan- og Landdistriktsstyrelsen as WFS/WMS under "Vedvarende energi" ([ens.dk](https://ens.dk/service/statistik-data-noegletal-og-kort/data-oversigt-over-energisektoren)) | Find the WFS endpoint and layer names on PLST's web-services page | Solar plants over 1 MW have a location, capacity and grid date; smaller ones only as totals per municipality. Today's turbine layer is distance only; height and rotor size would let a large turbine count for more than a small one |
| Energy parks to come | Plan- og Landdistriktsstyrelsen, [state-designated energy parks](https://www.plst.dk/landsplanlaegning/statsligt-udpegede-energiparker); municipal plans' areas for wind and solar (Plandata.dk); offshore wind areas in the maritime spatial plan | To find: no download of the designated areas was found, only maps on PLST's page and the map appendices to each executive order | What will be built near a home matters as much as what stands there now. Check whether Plandata's kommuneplan layers mark areas for wind and solar |
| Drinking water quality | GEUS: [hardness per waterworks and supply area](https://pub.geus.dk/da/publications/open-access-nationwide-data-sets-for-drinking-water-hardness-at-p/) (yearly, [Dataverse](https://doi.org/10.22008/FK2/5OZV7W)); the [Jupiter](https://data.geus.dk/JupiterWWW) database (PCJupiterXL) for nitrate, PFAS and other analyses | To find: the supply areas' geometry and licence, and how to pull the network samples per waterworks from PCJupiterXL | Hardness by supply area maps straight to the cells. PFAS and nitrate need a choice of which samples count (treated water, the network) and how old they may be |
| Terrain elevation | Danmarks Højdemodel (DHM/Terræn) on Dataforsyningen | A free Dataforsyningen user and token (Track A) | As data and as a map view (issue #53). Per cell: height above sea level and slope, averaged from the fine model by a job. Low-lying land feeds the flood-risk ideas in `block-ideas.md` |
| Addresses on the map: street names, and the address of a clicked spot | Street names from the Protomaps basemap at higher zoom; addresses from the OSM address points the pipeline already extracts, later DAR | More basemap zoom (today up to 12, so small streets have no names); a backend endpoint for the nearest address in PostGIS | Shows street, number and postcode for a clicked spot. Swap OSM for DAR once there is a Datafordeleren key |
| Municipal open data | OpenData.dk | Varies per municipality | Patchy and inconsistent between municipalities; check per dataset |
| Contaminated land, protected nature, drinking-water protection | Danmarks Miljøportal, Arealdata: soil contamination V1/V2, områdeklassificering, §3 nature, Natura 2000, fredninger, BNBO | Nothing: WFS/WMS and Shape/GDB downloads, no login | CC0 for these layers. Precise to the parcel. "Not on contaminated land", "near protected nature". Details: [public-data.md](public-data.md) |
| Air quality | DCE's model for 2024 (NO₂, PM2.5, PM10, O₃, NH₃, SO₂), through Danmarks Miljøportal | Nothing: WFS | CC BY 4.0, on a 1 km grid (90,162 cells). Replaces DCE's street-level "Luften på din vej", which has no download |
| Flood screening | Klimadatastyrelsen: Bluespot (hollows that fill with rain), Havvand på Land (sea flooding in steps of 0.1 m), Flow (flow paths) | A free Dataforsyningen user and token; FTPS, WMS/WMTS | CC BY 4.0, national rasters from DHM, updated yearly. Screening only, which the app must say. "Dry at 1 m higher sea" |
| Flood maps and coastal erosion | Miljøstyrelsen (formerly Kystdirektoratet; kyst.dk redirects): flood maps 2024 for sea (10 to 10,000-year) and watercourses (10 to 100-year), acute erosion, high-water statistics | ZIP and WMS; erosion as WFS | Erosion is CC BY 4.0; the flood maps state no licence (to ask). Miljøstyrelsen says they are not for the single property |
| Future and observed climate | DMI Klimaatlas v2025a (1 km grid and per municipality); DMI's free data API | Download and ArcGIS/WFS; the API needs no key | Klimaatlas: free, also commercially, with "Kilde: DMI Klimaatlas" and its version, unchanged. API: CC BY 4.0. Cloudburst days in 2071, sun hours. DMI merges with Klimadatastyrelsen on 1 December 2026 |
| Soil type | GEUS soil map (jordartskort): 1:25,000 for 88 % of Denmark (v7.1, CC BY 4.0), 1:200,000 for all; also the Jupiter boreholes | Download (GEUS Dataverse), WMS/WFS | GEUS's terms (2023): free, derived products allowed, credit GEUS. Clay or peat under the house |
| Traffic | Vejdirektoratet, Mastra traffic counts: daily traffic, share of lorries, speeds (state roads and 74 municipalities, up to 2026) | Nothing: WFS, CSV, GeoJSON | CC BY 4.0. "Busy road nearby", beyond what the noise maps cover |
| Doctors, pharmacies, dentists | Sundhedsdatastyrelsen, SOR (Sundhedsvæsenets Organisationsregister), with a location per unit | Nothing: nightly CSV/XML | "Freely available", no licence text. Better than OSM for general practitioners; OSM is fine for pharmacies |
| Broadband per address | Digitaliseringsstyrelsen, Tjekditnet: highest speed down and up per technology (fibre, coax, DSL, fixed wireless, mobile) per access address, also as a 100 m grid | CSV (382 MB, June 2026, history from 2016) and an API | No licence stated, and Digitaliseringsstyrelsen claims database rights and forbids scraping: ask before showing values per address. "Has fibre" (M4) |
| Heat supply areas | Plandata.dk: heat supply areas (6,275, 97 municipalities) and heat plans' areas for district heating or individual heating (1,354, 83 municipalities) | Nothing: the WFS the zone map comes from | CC BY 4.0. Whether district heating is planned where a home is: an input for the heating blocks in `block-ideas.md` |
| District heating prices | Forsyningstilsynet: the price of district heating for a standard house, about 400 suppliers, twice a year | CSV | No licence stated. The heating cost of a home with district heating, through its supplier |
| Energy labels | Energistyrelsen: the label, building parts and proposed savings per building | Lookup (Tjek Energimærke, Excel for several addresses); the EMOData API only on request (emo-info@ens.dk) | No public licence. The home's energy label (M4/M5): ask for EMOData access |
| Power lines | Energinet: overhead lines of 132–400 kV and their attention zones | WFS (INSPIRE) | No licence stated. Distance to a power line |
| Livestock | Landbrugsstyrelsen's CHR (herds with animal units, 2000–2024) and Plandata's large livestock farms | WFS (geodata.fvm.dk) and Plandata | CHR states no licence; Plandata is CC BY 4.0. Smell: animal units within 1 km |
| Rail and airport noise | Miljøstyrelsen's noise mapping 2022 for railways and airports (Lden, Lnight) | The same MiljøGIS download as road noise | As for road noise. Lets the noise block cover trains and planes too |

### Looked at and set aside (2026-10-09)

| Source | What it has | Why not |
|---|---|---|
| The police's daily reports (døgnrapporter, politi.dk) | Free-text excerpts of the day's incidents, often with a street and a town | Only a selection the police chose to publish ([Folketinget](https://www.ft.dk/samling/20161/almdel/reu/spm/391/svar/1389665/1732870.pdf)); not every district publishes them; no API; incidents tied to addresses are personal data. A map of them would show what was written about, not where things happen. The [POLITI \| UPDATE RSS](https://politi.dk/en/get-politi-update-as-an-rss-feed) only covers major incidents. Crime per municipality comes from DST |
| BBR in the National Archives ([Rigsarkivet, aflevering 853](https://digidata.rigsarkivet.dk/aflevering/853)) | Yearly copies of BBR, 1981–2017 | Historic, and BBR data has a 60-year access deadline, so it takes an application. Today's BBR comes from Datafordeleren |
| BBR as a research register ([NCRR, Aarhus University](https://ncrr.au.dk/danish-registers/the-central-register-of-buildings-and-dwellings-bbr)) | A description of BBR's variables for research | Access goes through DST's Forskningsservice, which is for researchers only. Useful as documentation of the fields |
| BBR's INSPIRE download ([ATOM feed](http://www2.sdfe.dk/INSPIRE/feeds/BBR.xml)) | A GeoPackage of buildings, CC BY 4.0 | Last updated 2022 and only 4 MB, so far from every building; the link returned an HTML page, probably a login. The WMS on Dataforsyningen gives images only |
| DCE, "Luften på din vej 2.0" | Air pollution per street and address (2019) | A map only, with no download or licence. DCE's 1 km grid for 2024 (above) is open |
| Sundhedsstyrelsen's radon map | The share of houses over 200 Bq/m³, from a 2001 survey | Only images, per the 275 municipalities before 2007, in five classes: too coarse for a cell |
| Vejdirektoratet's road accidents | Accidents with a place | Points only in vejman.dk, for road authorities, researchers and the police; the public statistics are per municipality |
| Danmarks Statistik's grid statistics (kvadratnet) | Population and variables such as income per 100 m cell, merged until 50–150 households | Paid: DKK 42,170 a year for the night population of all Denmark, plus DKK 54,821 per variable (2026 prices). Parish tables are free |

### Catalogues to search

Indexes of public data, to find sources from rather than to use.

| Catalogue | What it lists | How to read it | Notes |
|---|---|---|---|
| [Datavejviser](https://datavejviser.dk) (Digitaliseringsstyrelsen) | 3,708 datasets from 60 publishers on 2026-10-09: 2,288 Statistikbanken tables, 264 records from geodata-info.dk, 184 from Jobindsats, 156 from Danmarks Miljøportal, 119 from Klimadatastyrelsen, 100 from Energidataservice, 65 from Uddannelsesstatistik, and fewer from about 50 others. About 380 offer WMS and 270 WFS | CKAN's API (`datavejviser-ckan.digst.govcloud.dk/api/3/action/package_search`, open); or the whole catalogue as DCAT-AP-DK at `datavejviser.dk/katalog.jsonld?page=N`, 100 datasets a page; also through data.europa.eu's SPARQL endpoint | The metadata is CC0; each dataset's own terms are set by its publisher. Not complete: it says it describes "some of the most used" public data. A good index to harvest and filter, for example to the datasets with WMS or WFS |
| geodata-info.dk (Klimadatastyrelsen) | The national catalogue of geodata metadata, including INSPIRE | Its search portal; to check: the CSW endpoint and how many records it has | Fuller for geodata than Datavejviser, which carries 264 of its records |

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
