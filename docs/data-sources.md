# Data sources and how they are fetched

Status as of 2026-10-07. This covers what the pilot uses today, what is gated behind an
application or a licence, and the practical side of fetching each source: endpoints,
sizes, cadence, licences and the traps found along the way.

The data covers all of Denmark. `pipeline/` processes it, and `pipeline/README.md` lists
its steps.

## Principles

- **Only sources we may use.** Each source is open, licensed, or the user brings their own
  key or access. Nothing is scraped from sites whose terms forbid it.
- **Keep the raw download.** Every fetch lands unchanged in a raw archive with the
  date, URL, size, hash and licence, and a `source_file` row in the database (see
  `backend/README.md`). Processing always
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
| Forests, lakes, coast, beaches, solar parks, overhead power lines, airports and airfields, supermarkets, stations, pharmacies, libraries, main roads, address points, municipalities, national boundary | OpenStreetMap, Geofabrik extract `europe/denmark-latest.osm.pbf` | ODbL, attribution required | 0.5 GB, updated daily | One HTTPS download. The `osm` step takes the layers out with pyosmium in about a minute, and the `roads` step the roads, paths and ferries that travel times are found on |
| Noise (Lden) of roads, railways, airports and industry | Miljøstyrelsen, strategic noise maps 2022: `files-miljoegis.mim.dk/noise2022/2022_noise_shp.zip` | Open public data | 2 GB zip; mapped every 5 years (next round 2027) | `remote_zip.py` reads the zip's directory with HTTP range requests and pulls only the layers `eu_2022_vej_4m` (131 MB), `eu_2022_jernbane_4m` (13 MB), `eu_2022_lufthavn_4m` and `eu_2022_virksomhed_by_4m`. A cell has the loudest band; the railways, the airport and industry are louder than the roads on 0.2 % of the land |
| Planning zones (byzone, landzone, sommerhusområde) | Plandata.dk WFS `geoserver.plandata.dk/geoserver/wfs`, layer `pdk:theme_pdk_zonekort_v` | Open | 6,250 polygons, 19 MB GeoJSON for the whole country; updated continuously as plans change | One WFS GetFeature request with `count=20000` in EPSG:25832. Landzone is everything on land that is not byzone or sommerhusområde |
| Local plans of the last two years | Plandata.dk WFS, layers `pdk:theme_pdk_lokalplan_forslag` and `pdk:theme_pdk_lokalplan_vedtaget`, filtered on the server by the day proposed (`datoforsl`) or adopted (`datovedt`) | CC BY 4.0, as the zone map | 281 proposed and 1,072 adopted in the two years to 2026-10-10, of 38,051 adopted in all; 53 older proposals were never adopted and stay out | One WFS GetFeature per layer with `CQL_FILTER=datovedt>=YYYYMMDD`, the day two years back. The grid step measures the distance to them, 0 inside |
| Planned roads and railways | Plandata.dk WFS `geoserver.plandata.dk/geoserver/wfs`, layers `pdk:theme_pdk_planlagttrafikanlaeg_vedtaget` and `_forslag` (the municipal plans' planned traffic) | CC BY 4.0, as the zone map | 1,799 adopted (30 MB of GeoJSON) and 357 proposed on 2026-10-10; changes as the plans do | One WFS GetFeature per layer with `count=20000` in EPSG:25832. The grid step keeps the roads and railways (`temaspkode` 1 and 2: 385 adopted, 11 proposed), not the paths, corridors, stations, parking, ports and airports, and measures the distance to them |
| Schools | STIL Institutionsregisteret, the JSON behind the public data-extract page (`institutionsregisteret.stil.dk/frontend-api/Institutions`) | Open | All institutions, a few MB; changes continuously | One GET with `Accept: application/json`. Active folkeskoler, friskoler and private schools (type 1012 and 1013) with coordinates |
| Daycare | STIL Dagtilbudsregisteret, CSV export on `dagtilbudsregister.stil.dk/Eksport.aspx` | Open | About 5,000 active units | ASP.NET page. Get the form, then post its `__VIEWSTATE` back with the "anvisningsenhed" export button. That level has coordinates |
| Wind turbines | Energistyrelsen, "Vinddata" master data register (xlsx) | Open | About 4,900 turbines in operation; uploaded monthly | Download the xlsx. The media id in the link changes with every upload, so the link is looked up on ens.dk's data overview page |
| Income tax, land tax, population, home burglaries | Danmarks Statistik StatBank API `api.statbank.dk/v1/data`, tables PSKAT, FOLK1A, STRAF22 | Open, no key | Tiny; yearly (tax, crime) and quarterly (population) | POST a JSON query, get JSON-stat. `"values": ["*"]` returns every area, including the whole country, the regions and Christiansø (code 411), so filter to the 98 municipality codes |
| Air quality: NO₂ and PM2.5 | DCE's model for 2024, through Danmarks Miljøportal's WFS `arld-extgeo.miljoeportal.dk/geoserver/wfs`, layers `luft:ID6_Luft_Koncentration_2024_NO2` and `luft:ID7_Luft_Koncentration_2024_PM2_5` | CC BY 4.0 | 90,162 squares of 1 km per layer, about 20 MB of GeoJSON; a new year about yearly | One WFS GetFeature per layer with `count=200000` in EPSG:25832. GeoServer stamps every answer with the time, which the change check leaves out. The grid step puts each square's value on its 100 m cells (in steps of 0.25 µg/m³ for NO₂ and 0.1 for PM2.5); the sea has no squares, so no data |
| Protected areas (fredninger) and Natura 2000 areas for habitats and birds | Miljøstyrelsen, through Danmarks Miljøportal's Arealinformation WFS `arealeditering-dist-geo.miljoeportal.dk/geoserver/wfs`, layers `dai:fredede_omr`, `dai:habitat_omr` and `dai:fugle_bes_omr` | CC0 1.0 (the datasets' licence in Miljøportal's catalogue) | 4,177 fredninger (15 MB of GeoJSON), 269 habitat and 125 bird protection areas (11 and 5 MB); changed when a fredning is decided | One WFS GetFeature per layer with `count=100000` in EPSG:25832, as for the air. The grid step keeps the fredninger of land (`Fred_tkode` 1, not the 1,775 kirkefredninger, which keep the view of a church free) and the areas in force (`Statuskode` 3), and measures the distance to them, 0 inside. A cell is inside when its centre is, and an area smaller than a cell has the cell of a point inside it |
| Basemap | Protomaps daily planet build `build.protomaps.com/YYYYMMDD.pmtiles` (OpenStreetMap data) | ODbL (data), BSD (style) | The planet is well over 100 GB. Denmark up to zoom 12 is 75 MB (3,070 tiles), fetched in under a minute | `go-pmtiles extract` with the outline of Denmark (`basemap.sh`) fetches only those tiles by HTTP range requests |
| Basemap style, fonts, icons | `@protomaps/basemaps` (npm) and `protomaps.github.io/basemaps-assets` | BSD / OFL | Small | npm install and plain downloads |
| World map outside Denmark | Natural Earth 1:50m (`naciscdn.org/naturalearth/50m/...`) | Public domain | 2 MB after processing; rarely changes | Five zip downloads, converted by `build_world.py` |

## Licences and credits

Checked on the providers' own pages on 2026-10-09.

| Source | Licence or terms | Credit |
|---|---|---|
| OpenStreetMap | [ODbL 1.0](https://www.openstreetmap.org/copyright), share-alike | "© OpenStreetMap contributors", linked to the copyright page |
| Miljøstyrelsen, noise mapping 2022 | CC BY 4.0 (Miljøstyrelsen's INSPIRE metadata; the download says nothing) | "Støjkortlægning 2022: Miljøstyrelsen", and that we changed it |
| Plandata.dk, zone map, planned traffic and local plans | CC BY 4.0 ([webservices](https://www.plandata.dk/webservices/introduktion-til-webservices)) | "Zonekort, planlagte trafikanlæg og lokalplaner: Plan- og Landdistriktsstyrelsen, Plandata.dk", and that we changed it |
| STIL Institutionsregisteret and Dagtilbudsregisteret | No licence stated; STIL calls the daycare data free for everyone | A courtesy credit to Styrelsen for It og Læring |
| Energistyrelsen, wind turbines | [Website terms](https://ens.dk/om-os/datapolitik): free with the source named, not to be changed or distorted | "Kilde: Energistyrelsen"; derived values are marked as our own calculations |
| Danmarks Statistik | [Free with the source named](https://www.dst.dk/da/presse/kildeangivelse), as CC BY 4.0; not the logo | "Egne beregninger baseret på tal fra Danmarks Statistik", with links to the tables |
| DCE air quality 2024, through Danmarks Miljøportal | CC BY 4.0 (the dataset's licence in Miljøportal's catalogue) | "Luftkvalitet 2024: DCE – Nationalt Center for Miljø og Energi, Aarhus Universitet", and that we changed it |
| Miljøstyrelsen's protected areas and Natura 2000, through Danmarks Miljøportal | CC0 1.0 (the datasets' licence in Miljøportal's catalogue) | None needed; a courtesy credit, "Fredede områder og Natura 2000: Miljøstyrelsen, Danmarks Miljøportal", and that we changed it |
| Protomaps | Tiles: ODbL produced work. Style: CC0. Code: BSD-3-Clause | "Protomaps © OpenStreetMap" (Protomaps' own credit is a request, not a duty) |
| ESA WorldCover 2020, land cover in Protomaps' tiles up to zoom 7 | CC BY 4.0 | "© ESA WorldCover project 2020 / Contains modified Copernicus Sentinel data (2020) processed by ESA WorldCover consortium" |
| Noto fonts and Mapzen icons (basemaps-assets) | SIL OFL 1.1 and MIT | Copyright notices; the licence texts go with the copies we serve: the basemap job fetches them, and the data pack carries them in `licences/` |
| Roboto and Material Symbols, the app's own fonts | SIL OFL 1.1 and Apache 2.0 | Served by the app itself (npm `@fontsource/roboto`, `@material-symbols/font-400`), not from Google Fonts, with their licence texts in `/licences/`. "About the data" credits them |
| The frontend's libraries (Angular, MapLibre and the rest) | MIT, BSD and others | Angular's build lists them in `3rdpartylicenses.txt`, which the image serves as `/licences/third-party.txt`, linked from "About the data" |
| Natural Earth | Public domain | None needed; "Made with Natural Earth" |

- **Where OpenStreetMap's credit goes.** OSMF's [attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
  ask for it on the map without a click. It may go away when the map is first used, or after five
  seconds, as long as it can be found again, such as under "About". So the map shows "© OpenStreetMap"
  until it is moved or for five seconds, and "About the data" has the rest.
- **The data pack carries the licence texts** of the fonts and icons it serves (`licences/`), since
  2026-10-10.
- **No font comes from Google.** The app's fonts are served by the app, so a visit sends nothing to
  Google; the Content Security Policy allows nothing from elsewhere.
- **ODbL share-alike.** The data layers made from OpenStreetMap are a derived database under the
  ODbL. An instance that is used only by its owner publishes nothing. One that is open to others
  must offer that database, or the way it is made (ODbL 4.6): the data pack itself, or the pipeline's
  source in `pipeline/` and the jobs in `backend/src/pipeline/`. "About the data" says the layers are
  under the ODbL; README.md says what a public instance must do.

## Sources not used yet, and what they need

The public sources beyond the ones above, from Danmarks Miljøportal, Klimadatastyrelsen, Miljøstyrelsen, DMI, GEUS, Vejdirektoratet and others, were checked on the providers' own pages on 2026-10-09: [public-data.md](public-data.md) has the details and the links.

| Data | Source | What it takes | Notes |
|---|---|---|---|
| Addresses, buildings, dwellings, cadastre, ownership type, property valuations | Datafordeleren: DAR, BBR, MAT, EBR, VUR, GeoDanmark | A free user and API key at datafordeler.dk | Build only against the GraphQL API and the file downloads: the old REST and WFS services close on **15 January 2027**. Signing up has been troublesome (login failing), so this is still waiting. Klimadatastyrelsen merges into DMI on **1 December 2026**, so URLs and contacts may move. BBR alone gives, per building and dwelling: use, year built and rebuilt, areas, floors, rooms, roof and wall materials, heating and fuel, water and drains, kitchen and bath, and listed status ([geodata-info.dk](https://geodata-info.dk/srv/api/records/b49995f6-f194-4f31-8a81-ae3aa0a0f2dd), [Datafordeleren](https://datafordeler.dk/dataoversigt/bygnings-og-boligregistret-bbr/bbr/)) |
| **Sale prices (købesum)** | EJF (Ejerfortegnelsen) via Datafordeleren | An application to Geodatastyrelsen (GST). Requires MitID Erhverv, OAuth, a whitelisted IP, a stated purpose and a GDPR legal basis | The only official source of prices. Råd til Bolig documents that it gets EJF this way, so a small company can be granted access |
| Deeds (with the price), mortgages, servitudes, owners | Tinglysning (tinglysning.dk) | System access needs "storkunde" status and a systembruger | Bulk access is effectively closed. The OCES-only HTTP API closes on **6 November 2026**. Domstol.dk's ETL page sits behind a Cloudflare challenge, which we do not try to bypass |
| Homes for sale (listings) | Boligsiden datasalg, Geomatic Udbudsdata, or an aggregator with the user's own key | A licence, or the user's own access | Boligsiden and Boliga forbid scraping. A legal stop-gap is to parse the user's own search-alert e-mails |
| School results and well-being | uddannelsesstatistik.dk API (Børne- og Undervisningsministeriet) | A free key | Grades, well-being, absence and transition rates per school: a natural input for a school block. Free, also commercially, with "Kilde: Uddannelsesstatistik.dk" and the data unchanged (checked 2026-10-09) |
| School districts | GeoFA (skoledistrikter, theme 5710), WFS `geofa.geodanmark.dk/ows/fkg/fkg`, layer `fkg:fkg.t_5710_born_skole_dis` | Open: CC BY 4.0, credit "@geodanmark" | Which school a home belongs to, rather than the nearest school. All 98 municipalities, 1,366 districts (checked live 2026-10-09; 1,409 on 2026-10-10, 143 MB of GeoJSON). A district has a number and a name (`udd_distrikt_nr`, `udd_distrikt_navn`), not the school's institution number, and some have several schools or grade ranges, so joining them to STIL's schools needs the school results above. With the results: how the home's own school does |
| Public transport | Rejseplanen GTFS feed | CC BY 4.0 via Rejseplanen Labs (sign-up); static data may be used commercially, unchanged | Needed for real travel times by bus and train together with OpenTripPlanner, and for departures per hour near each cell (better than OSM's stops, which only say a stop exists). New feed about every 14 days. The Rejseplan API is free only for non-commercial use, up to 50,000 calls a month. The pilot only estimates from straight-line distance |
| Road and bike routing | OSM through Valhalla or OSRM (self-hosted) | ODbL | Replaces the straight-line travel-time estimate |
| Reviews of daycare and schools | Google Places and similar | Their terms forbid storing the data or using it for filtering | Not usable. Official quality data (above) is the alternative |
| Solar parks officially, with their capacity | Energistyrelsen's master data register, served by Plan- og Landdistriktsstyrelsen as WFS/WMS under "Vedvarende energi" ([ens.dk](https://ens.dk/service/statistik-data-noegletal-og-kort/data-oversigt-over-energisektoren)) | Find the WFS endpoint and layer names on PLST's web-services page | Solar plants over 1 MW have a location, capacity and grid date; smaller ones only as totals per municipality. Solar parks come from OpenStreetMap now (2026-10-10: 130 plants of 3,900 ha, which matches the national figures); this would add capacity and dates. The turbines' height and rotor are in use since 2026-10-10 (`turbine_heights`), from the register the turbines come from already |
| Energy parks to come | Plan- og Landdistriktsstyrelsen, [state-designated energy parks](https://www.plst.dk/landsplanlaegning/statsligt-udpegede-energiparker); municipal plans' areas for wind and solar (Plandata.dk); offshore wind areas in the maritime spatial plan | To find: no download of the designated areas was found, only maps on PLST's page and the map appendices to each executive order | What will be built near a home matters as much as what stands there now. Check whether Plandata's kommuneplan layers mark areas for wind and solar |
| Drinking water quality | GEUS: [hardness per waterworks and supply area](https://pub.geus.dk/da/publications/open-access-nationwide-data-sets-for-drinking-water-hardness-at-p/) (yearly, [Dataverse](https://doi.org/10.22008/FK2/5OZV7W)); the [Jupiter](https://data.geus.dk/JupiterWWW) database (PCJupiterXL) for nitrate, PFAS and other analyses | To find: the supply areas' geometry and licence, and how to pull the network samples per waterworks from PCJupiterXL | Hardness by supply area maps straight to the cells. PFAS and nitrate need a choice of which samples count (treated water, the network) and how old they may be |
| Terrain elevation | Danmarks Højdemodel (DHM/Terræn) on Dataforsyningen | A free Dataforsyningen user and token (Track A) | As data and as a map view (issue #53). Per cell: height above sea level and slope, averaged from the fine model by a job. Low-lying land feeds the flood-risk ideas in `block-ideas.md` |
| Addresses on the map: street names, and the address of a clicked spot | Street names from the Protomaps basemap at higher zoom; addresses from the OSM address points the pipeline already extracts, later DAR | More basemap zoom (today up to 12, so small streets have no names); a backend endpoint for the nearest address in PostGIS | Shows street, number and postcode for a clicked spot. Swap OSM for DAR once there is a Datafordeleren key |
| Municipal open data | OpenData.dk | Varies per municipality | Patchy and inconsistent between municipalities; check per dataset. Full survey: [opendata-dk.md](opendata-dk.md) |
| Statistics below the municipality | Danmarks Statistik, StatBank: per parish (about 2,100) education KMST007A, employment KMSTA005, mean age KMGALDER, age SOGN1/KM5, births, deaths and moves KMSTA003, day and night population KMSTA009; per postcode age POSTNR1/POSTNR2; per town population and density BY3, households with and without children BY4, age BY1; per polling district the election results FV26TOTA, EV24TOTA, FA22TOTA | Open, no key | Only 20 active tables go below the municipality. Parishes are small (median 909 adults, 49 under 100), so smooth them. Polling-district codes change between elections; match to DAGI by name. Full survey: [dst.md](dst.md) |
| Statistics per municipality, more themes | Danmarks Statistik, StatBank: income and inequality INDKP101, INDKF112, IFOR41, IFOR12P; crime in 91 kinds, quarterly, STRAF11; families, age and forecast to 2050 FAM44N, GALDER, FRKM126; childcare prices RES88, staffing BOERN8, class sizes KVOTIEN; tenure and heating BOL101, BOL102; commuting distance AFSTB4; cars BIL800 | Open, no key | See [dst.md](dst.md) |
| Income per parish or postcode, sales per postcode | Danmarks Statistik's paid tables (SOGN9A–10A, POST9A–10B, about 3,700–11,500 kr. each) and the product "Ejendomssalg" (postcode, up to 2020) | Paid | The free tables have income per municipality only, and sale prices only per landsdel |
| Population on a 1 km grid | Eurostat, census 2021 on the European 1 km grid (EPSG:3035) | To find: the download terms | Free alternative to DST's paid grid statistics; coarser than our 100 m cells |
| Contaminated land, §3 nature, drinking-water protection | Danmarks Miljøportal, Arealdata: soil contamination V1/V2, områdeklassificering, §3 nature (320,000 areas in `dai:bes_naturtyper`), BNBO. The fredninger and Natura 2000 are in use (above) | Nothing: WFS/WMS and Shape/GDB downloads, no login | CC0 for these layers. Precise to the parcel. "Not on contaminated land". Details: [public-data.md](public-data.md) |
| Radon, measured in homes | BUILD (Aalborg University), the national radon survey 2022 for Realdania's "Radonfrit hjem": 16,943 houses measured 2015–2020, mapped per municipality from the 10,018 measured by the instructions ([Realdania](https://realdania.dk/nyhedsoverblik/nyheder/2022/06/for-hoeje-niveauer-af-radioaktiv-gas-i-4-ud-af-10-danske-boliger), [Bolius](https://www.bolius.dk/radon-i-boligen)) | To find: whether the shares per municipality are published as a table; the measurements are only given to researchers | Share of houses over 100 Bq/m³ per municipality, in five classes. Not geographically representative (more measurements where more people have a STEM education). The official basis is still the 2001 map, set aside below. A finer proxy: GEUS's mapping of radon by soil type ([GEUS 1999/81](https://data.geus.dk/pure-pdf/GEUS-R_1999-81.pdf)) applied to the soil map |
| Radon per address | DinGeo ([dingeo.dk](https://www.dingeo.dk/data/sundhed-og-sikkerhed/radon/)): a risk per address from the official classes, the 2022 survey, geology and the building's age | A commercial licence; to ask: the terms and price | Already joins the sources above per address. An alternative to building the same from the open parts |
| Crime where it happens, below the municipality | Danmarks Statistik: the crime statistics record the scene's postcode (variable [MIN_POSTNR](https://www.dst.dk/da/Statistik/dokumentation/Times/kriminalstatistik/min-postnr)) | No StatBank table has it, nor any police district or parish ([dst.md](dst.md)). Only as a special data request (særkørsel, 1,476 kr. an hour excl. VAT) | Burglaries per postcode would be far finer than STRAF22 per municipality. Burglary codes: 1320 homes, 1316 businesses, 1324 empty buildings |
| Vulnerable housing areas (udsatte boligområder) | Social- og Boligministeriet's yearly list, 1 December ([2025](https://www.sm.dk/Media/639000077526538440/Liste%20over%20udsatte%20boligomrder%202025.pdf)); the areas are defined by cadastral parcels in an [executive order](https://www.sbst.dk/Media/638404752058882335/Bekendtg%C3%B8relse%20om%20omr%C3%A5deafgr%C3%A6nsning%202024.pdf) | PDFs only: the parcels would be joined to MAT to make polygons | Criteria include residents' convictions, employment, education and income. A political label rather than a measure of crime, so it needs care in how it is shown |
| Tree cover, also in streets and gardens | Danmarks Højdemodel: the surface model (DHM/Overflade) minus the terrain (DHM/Terræn), or the point cloud's vegetation class; Copenhagen's own crown map (see [opendata-dk.md](opendata-dk.md)) | The same Dataforsyningen user as elevation | Our own job: heights over 3 m that are not buildings give the share of each cell under crowns |
| Light at night | To find: satellite night lights, such as VIIRS from the Earth Observation Group (Colorado School of Mines) | To find: the terms and the resolution (about 500 m) | For a "dark nights" block. Not checked yet |
| Air quality, the other substances | DCE's model for 2024 (PM10, O₃, NH₃, SO₂), through Danmarks Miljøportal | Nothing: WFS | CC BY 4.0, on a 1 km grid (90,162 cells), like NO₂ and PM2.5, which are in use (above) |
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
| Listed and preservation-worthy buildings | Slots- og Kulturstyrelsen, FBB (Fredede og Bevaringsværdige Bygninger): about 7,000 listed buildings, about 360,000 with a SAVE value (1–9) | An INSPIRE download ([Atom feed](https://www.kulturarv.dk/fbb/inspire/feed-fbb.xml)); no conditions stated | FBB closes in 2026: listed buildings move to a new register, and the SAVE values to the municipalities, which KL gathers in GeoFA. For the blocks on protected areas and listed buildings in `block-ideas.md` (milestone 4) |
| Every other theme of the plans | Plandata.dk: local plans (and those for solar and wind), the municipal plan's frames, supplements and guidelines (landscapes, heritage, nature, forest planting, flooding, groundwater near the surface, noise-loaded areas, consequence zones, planned roads), heat and waste-water plans, the coastal zone, environmental assessments; 211 layers | Nothing: the WFS the zone map comes from | CC BY 4.0. Proposals say what is coming, which no other source does. Every theme, with its layers and what it says about a home: [plandata.md](plandata.md) |
| Airports and airfields | OSM `aeroway=aerodrome` (airports, airfields, glider fields, air stations); Naviair's AIP (AD 1.1) as the official list; aircraft noise from Miljøstyrelsen's noise mapping and Plandata's noise-loaded areas | OSM is in use already; the AIP is a PDF | Forsvaret's noise zones around Aalborg, Karup and Skrydstrup were not found as a national download. For the block on airports in `block-ideas.md` |

### Looked at and set aside (2026-10-09)

| Source | What it has | Why not |
|---|---|---|
| The police's daily reports (døgnrapporter, politi.dk) | Free-text excerpts of the day's incidents, often with a street and a town | Only a selection the police chose to publish ([Folketinget](https://www.ft.dk/samling/20161/almdel/reu/spm/391/svar/1389665/1732870.pdf)); not every district publishes them; no API; incidents tied to addresses are personal data. A map of them would show what was written about, not where things happen. The [POLITI \| UPDATE RSS](https://politi.dk/en/get-politi-update-as-an-rss-feed) only covers major incidents. Crime per municipality comes from DST |
| BBR in the National Archives ([Rigsarkivet, aflevering 853](https://digidata.rigsarkivet.dk/aflevering/853)) | Yearly copies of BBR, 1981–2017 | Historic, and BBR data has a 60-year access deadline, so it takes an application. Today's BBR comes from Datafordeleren |
| BBR as a research register ([NCRR, Aarhus University](https://ncrr.au.dk/danish-registers/the-central-register-of-buildings-and-dwellings-bbr)) | A description of BBR's variables for research | Access goes through DST's Forskningsservice, which is for researchers only. Useful as documentation of the fields |
| BBR's INSPIRE download ([ATOM feed](http://www2.sdfe.dk/INSPIRE/feeds/BBR.xml)) | A GeoPackage of buildings, CC BY 4.0 | Last updated 2022 and only 4 MB, so far from every building; the link returned an HTML page, probably a login. The WMS on Dataforsyningen gives images only |
| DCE, "Luften på din vej 2.0" | Air pollution per street and address (2019) | A map only, with no download or licence. DCE's 1 km grid for 2024 (above) is open |
| Sundhedsstyrelsen's radon map | The share of houses over 200 Bq/m³, from a 2001 survey | Only images, per the 275 municipalities before 2007, in five classes: too coarse for a cell |
| Politiets tryghedsundersøgelse ([politi.dk](https://politi.dk/statistik/tryghed)) | How safe people feel, from a survey by DST | Only for the 12 police districts, the five largest cities and the vulnerable housing areas: too coarse for a cell |
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
- **DAWA is gone for boundaries.** Its DAGI endpoints (`/sogne`, `/postnumre`,
  `/afstemningsomraader`) answer 410 Gone (checked 2026-10-09, see [dst.md](dst.md)). Parish, postcode
  and polling-district boundaries come from Datafordeleren, or from the DAR addresses in milestone 4.
- **OpenData.dk's download links expire.** Uploaded files redirect to Cloudflare URLs that work for
  60 seconds. Store the `admin.opendata.dk` URL and follow the redirect at each fetch
  ([opendata-dk.md](opendata-dk.md)).
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
