# Danmarks Statistik: every table, and what maps to a place

Status as of 2026-10-09. This goes through every table in StatBank (Statistikbanken) and what
Danmarks Statistik (DST) offers outside it. For each table it finds the place variable and the
finest level that variable reaches. It then rates what is useful for a home search. The map scores
100 m cells, so anything finer than a municipality matters most.

The pilot already uses three StatBank tables per municipality: [PSKAT](https://www.statbank.dk/PSKAT)
(income tax and land tax rates), [FOLK1A](https://www.statbank.dk/FOLK1A) (population) and
[STRAF22](https://www.statbank.dk/STRAF22) (home burglaries). See `data-sources.md`.

**Method.**

- The table list comes from
  [`tables?includeInactive=true`](https://api.statbank.dk/v1/tables?lang=en&format=JSON&includeInactive=true):
  5,739 tables, of which 2,309 are active. Without `includeInactive` the call returns only the 2,309
  ([`tables`](https://api.statbank.dk/v1/tables?lang=en&format=JSON)).
- Every table's variables and values come from `tableinfo`, e.g.
  [`tableinfo/SOGN1`](https://api.statbank.dk/v1/tableinfo/SOGN1?lang=en&format=JSON). The 5,739
  calls ran one at a time on 2026-10-09.
- The subjects come from
  [`subjects?recursive=true&includeTables=true&includeInactive=true`](https://api.statbank.dk/v1/subjects?lang=en&format=JSON&recursive=true&includeTables=true&includeInactive=true).
- A script sorted every value of every place variable into a level. It used the variable's `map`
  attribute in `tableinfo` (such as `denmark_parish_23_4c` or `denmark_municipality_07`), its code
  and the value codes and texts. The finest level found is the table's level.
- The sort is heuristic and was checked by hand on the edge cases. The counts may be off by a few
  tables, but not the conclusions.
- Places outside Denmark (countries of origin, trade partners) and typologies do not count as
  places. Typologies are things such as the five "municipality groups" or "city size".

## Summary

| Finest level | Tables | Of which active |
|---|--:|--:|
| 100 m or 1 km grid | 0 | 0 |
| Polling district (afstemningsområde) | 86 | 3 |
| Parish (sogn) | 17 | 12 |
| Postal code | 5 | 2 |
| Urban area (by, byopgørelsen) | 5 | 3 |
| Nomination district (opstillingskreds) | 14 | 3 |
| Municipality (the 98 since 2007) | 805 | 398 |
| Municipality before 2007 (271) | 307 | 0 |
| Deanery (provsti) | 11 | 10 |
| Multi-member constituency (storkreds) | 6 | 1 |
| County (amt), before 2007 | 99 | 1 |
| Province (landsdel, 11) | 274 | 113 |
| Region (5) | 186 | 77 |
| Part of the country (East/West and the like) | 16 | 7 |
| Whole country only | 3,908 | 1,679 |
| **All tables** | **5,739** | **2,309** |

- **1,831 tables have a place below the whole country, 630 of them active.**
- **Of the active ones, 418 reach a municipality or finer** (398 municipality, 20 finer).
- **Only 20 active tables go below the municipality:**
  - 12 parish tables, the church statistics (kirkestatistik);
  - two postal-code tables;
  - three urban-area tables;
  - three election tables by polling district.
- **There is no grid data in StatBank at all.** DST sells it (see [Outside StatBank](#data-outside-statbank)).
  - The only free grid data on dst.dk is a 2019 demo map with 1 km density classes, not counts.
  - Eurostat's 2021 census grid (1 km) is the only free grid with Danish figures.

**The most promising themes, and why:**

1. **Parish-level profiles (free, not used).** These come from the church statistics:
   - [KMST007A](https://www.statbank.dk/KMST007A): education;
   - [KMSTA005](https://www.statbank.dk/KMSTA005): employed, unemployed and outside the labour force;
   - [KMSTA009](https://www.statbank.dk/KMSTA009): commuting, as night and day population;
   - [KMGALDER](https://www.statbank.dk/KMGALDER): average age;
   - [SOGN1](https://www.statbank.dk/SOGN1): age and sex;
   - [KMSTA003](https://www.statbank.dk/KMSTA003): births, deaths and moves.

   About 2,100 parishes, against 98 municipalities: a 20-fold finer picture of who lives where. This
   is the best free material for a "neighbourhood" block.
2. **Age profile by postal code (free, not used).** [POSTNR1](https://www.statbank.dk/POSTNR1) and
   [POSTNR2](https://www.statbank.dk/POSTNR2) give age and sex. POSTNR2 splits each postal code by
   municipality.
3. **Urban areas (free, not used).** [BY1](https://www.statbank.dk/BY1) and
   [BY3](https://www.statbank.dk/BY3) give each town's population, area and density, and
   [BY4](https://www.statbank.dk/BY4) households with and without children. This separates a village
   from a town, which a municipality average cannot.
4. **Income, the main thing missing below the municipality.** It is only free per municipality:
   - [INDKP101](https://www.statbank.dk/INDKP101) and [INDKF112](https://www.statbank.dk/INDKF112):
     income;
   - [IFOR41](https://www.statbank.dk/IFOR41): inequality;
   - [IFOR12P](https://www.statbank.dk/IFOR12P): poverty.

   Income per parish and postal code exists only as paid tables (SOGN9A–10A, POST9A–10B).
5. **Crime by type, quarterly (free, partly used).** [STRAF11](https://www.statbank.dk/STRAF11) has
   91 kinds of offence per municipality and quarter. The pilot uses only burglaries, and only yearly
   (STRAF22). **No table has crime below the municipality**, by postal code or police district;
   see [Crime](#crime-the-municipality-is-the-floor).
6. **Free municipal context.** These are worth a block each:
   - housing stock by tenure, type and heating ([BOL101](https://www.statbank.dk/BOL101),
     [BOL102](https://www.statbank.dk/BOL102));
   - commuting distance ([AFSTB4](https://www.statbank.dk/AFSTB4));
   - car ownership ([BIL800](https://www.statbank.dk/BIL800));
   - unemployment ([AULP01](https://www.statbank.dk/AULP01));
   - childcare fees and staffing ([RES88](https://www.statbank.dk/RES88),
     [BOERN8](https://www.statbank.dk/BOERN8));
   - population forecasts to 2050 ([FRKM126](https://www.statbank.dk/FRKM126)).
7. **No sale prices below the province.** Free sale prices and price indices stop at the 11
   provinces ([EJEN77](https://www.statbank.dk/EJEN77), [EJ56](https://www.statbank.dk/EJ56)). Free
   rent indices stop at the regions ([HUS1](https://www.statbank.dk/HUS1)). The postal-code tables
   ended in 2002 ([EJEN3](https://www.statbank.dk/EJEN3)). The paid product "Ejendomssalg" had postal
   codes up to 2020. Prices per home still need EJF (see `data-sources.md`).

## Access

**Endpoints** ([API page](https://www.dst.dk/da/Statistik/brug-statistikken/muligheder-i-statistikbanken/api),
[API help](https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api)):

| Call | What it gives | Example |
|---|---|---|
| `GET /v1/subjects` | The subject tree, optionally with tables | [`subjects?recursive=true&includeTables=true`](https://api.statbank.dk/v1/subjects?lang=en&format=JSON&recursive=true&includeTables=true) |
| `GET /v1/tables` | Table list: id, title, unit, updated, first and latest period, `active`, variable names | [`tables?includeInactive=true`](https://api.statbank.dk/v1/tables?lang=en&format=JSON&includeInactive=true) |
| `GET /v1/tableinfo/{id}` | Variables with codes, texts, every value, `map`, `elimination`, documentation link, `suppressedDataValue` | [`tableinfo/KMSTA005`](https://api.statbank.dk/v1/tableinfo/KMSTA005?lang=en&format=JSON) |
| `POST /v1/data` | The data. Formats: JSONSTAT, CSV, PX, XLSX, BULK, SDMX and others | See below |

The base URL is `https://api.statbank.dk`, with no key (only the DCAT `catalogue` call needs one).
It needs TLS 1.2. `lang` is `da` (the default) or `en`.

**A query.** This is the pattern the pilot already uses: POST a JSON body.

```json
{"table": "KMSTA005", "format": "CSV", "lang": "en",
 "variables": [{"code": "SOGN", "values": ["*"]}, {"code": "SOCIO", "values": ["*"]},
               {"code": "Tid", "values": ["(1)"]}]}
```

- **Picking values.**
  - `"*"` is every value, and `"*K1"` is every code ending in K1.
  - `"(1)"` is the newest period, `"(-n+3)"` the three newest, and `">=2015<=2025"` a range.
  - A variable left out is eliminated, that is summed, if the table allows it.
- **Output.**
  - CSV comes with `;` as separator and a BOM. JSONSTAT is what `download.sh` uses today.
  - A stored but missing value is `..`.

**Limits and traps:**

- **1,000,000 cells per call** for the non-streaming formats (CSV, JSONSTAT, PX, XLSX), set on
  27 May 2021 ([API help](https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api)). A full
  FOLK1A asks for 90 million cells and fails with `REQUEST-LIMIT`, which points to BULK.
- **BULK and SDMX** have no cell limit. But they cannot eliminate variables or calculate, they leave
  out zero combinations, and they do not keep the order of rows.
- **No rate limit is stated.** 5,739 `tableinfo` calls in a row, at about two a second, all
  succeeded.
- **`"*"` brings the aggregates too.** On the area variable that means:
  - `000` (All Denmark);
  - the regions `081`–`085`;
  - for some tables, the provinces (`01`–`11`, "Province …");
  - Christiansø (`411`), on 327 of the 709 area variables with the municipality map.

  Filter to the 98 municipality codes, as the pilot does.
- **Region Østdanmark.** From 1 January 2027 Region Hovedstaden and Region Sjælland merge into
  Region Østdanmark ([lex.dk](https://lex.dk/Region_%C3%98stdanmark)).
  - The election tables [KVRES](https://www.statbank.dk/KVRES) and
    [VALGK3](https://www.statbank.dk/VALGK3) already have a code `086` "Region Østdanmark".
  - Region-level series will break, so join on municipalities, not regions.
- **The 2007 reform.** 307 tables use the 271 municipalities from before 2007 (map
  `Denmark_municipality`), and 99 use the counties (amter). All of them are inactive.
  - Use only tables whose area variable has the map `denmark_municipality_07`.
  - Most municipality series start in 2006–2008.
- **Discontinued tables** keep their code, but the default `tables` call hides them. Their
  successors often have the same name with a new number, e.g. EJ55 → EJ56 and BOL11 → BOL101.
- **Parishes change.**
  - SOGN in the church tables has 2,299 codes. Only 2,104 had residents aged 15 or more in 2025
    ([KMSTA005](https://www.statbank.dk/KMSTA005), 2025, all values), because parishes are merged
    over the years.
  - The map name `denmark_parish_23_4c` points at the 2023 parish layout.
  - Join the newest year's codes against a DAGI parish layer of the same date.
- **Small parishes are noisy.** In 2025 the median parish had 909 residents aged 15 or more, and 49
  parishes had fewer than 100. Shares from tiny parishes swing from year to year, so smooth them or
  pool several years.
- **Labels vs codes.** Variable codes are Danish (`OMRÅDE`, `KØN`, `Tid`) in both languages. Send
  UTF-8.
- **"Municipality of residence".** Some tables count the people who live in a municipality, not the
  places in it. [EJDFOE1](https://www.statbank.dk/EJDFOE1) is the market value of real estate owned
  by the residents, wherever it lies.
- **Time codes vary:** `2026K3`, `2026M09`, `2021U52` (week), `2021:2025` (five-year windows, as in
  [HISBK](https://www.statbank.dk/HISBK)), `2024:2025` (school years).

**Licence and credit.**

- Everything on dst.dk and Statistikbanken is free to use, commercially too, with the source named.
  DST says this "svarer til" CC BY 4.0 ([kildeangivelse](https://www.dst.dk/da/presse/kildeangivelse)).
- The credit should link to the table, e.g. "Kilde: Danmarks Statistik - https://statistikbanken.dk/bef1".
  Our own processing is marked "Egne beregninger baseret på tal fra Danmarks Statistik".
- The DST logo may not be used. "About the data" already gives this credit (`data-sources.md`).

## Below the municipality

These are the tables that are finer than a municipality. Cadence is the period of the data; the
"updated" date is from `tableinfo` on 2026-10-09.

### Parish (sogn): about 2,100 areas

The church statistics (kirkestatistik) are made "for parishes, deaneries and dioceses" from CPR
([documentation](https://www.dst.dk/en/Statistik/dokumentation/documentationofstatistics/church-statistics)).
Every table also splits by membership of the National Church; leaving that variable out sums it.

| Table | Contents | Period | Cadence | Updated | Use for a home | Rating |
|---|---|---|---|---|---|---|
| [KMST007A](https://www.statbank.dk/KMST007A) | Residents 15+ by highest education (H10–H90) | 2015–2025 | Yearly (1 October) | 2026-05-01 | Share with a higher education | **High** |
| [KMSTA005](https://www.statbank.dk/KMSTA005) | Residents 15+: employed, unemployed, outside the labour force | 2016–2025 | Yearly | 2026-02-27 | Employment rate, a proxy for income | **High** |
| [KMGALDER](https://www.statbank.dk/KMGALDER) | Average age by sex | 2007–2026 | Yearly | 2026-02-12 | Young or old area | **High** |
| [SOGN1](https://www.statbank.dk/SOGN1) | Population by sex and one-year age | 2010–2026 | Yearly | 2026-02-12 | Share of children 0–6 and 7–16, of elderly: families with children | **High** |
| [KM5](https://www.statbank.dk/KM5) | Population by sex, age and church membership | 2007–2026 | Yearly | 2026-02-12 | As SOGN1, from 2007 | Medium |
| [KMSTA003](https://www.statbank.dk/KMSTA003) | Births, deaths, moves in and out, net change | 2015–2025 | Yearly | 2026-02-12 | Growing or shrinking area, turnover | Medium |
| [KMSTA009](https://www.statbank.dk/KMSTA009) | Night population, commuting in and out, day population (15+) | 2016–2025 | Yearly | 2026-02-27 | Living area or workplace area; quiet by day | Medium |
| [KM1](https://www.statbank.dk/KM1) | Population by church membership | 2007Q1–2026Q3 | Quarterly | 2026-08-10 | Fresh population totals per parish | Medium |
| [KM3](https://www.statbank.dk/KM3) | Live births and deaths | 2007Q1–2026Q2 | Quarterly | 2026-08-10 | Births: young families moving in | Low |
| [KMSTA001](https://www.statbank.dk/KMSTA001) | Population by ancestry (Danish, immigrant, descendant) | 2008–2026 | Yearly | 2026-02-12 | See the note below | Not offered |
| [KM2](https://www.statbank.dk/KM2), [KM4](https://www.statbank.dk/KM4) | Joining and leaving the church; church ceremonies | 2006/2007– | Quarterly, yearly | 2026 | None | Low |

- **Discontinued parish tables:**
  - [SOGN10](https://www.statbank.dk/SOGN10): population 1925–2022;
  - [BEF4B](https://www.statbank.dk/BEF4B) and [BEFS4](https://www.statbank.dk/BEFS4): population
    1976–2008;
  - [KMSTA007](https://www.statbank.dk/KMSTA007): education 2016–2019, replaced by KMST007A;
  - [INDKF41](https://www.statbank.dk/INDKF41): families by ownership of the home and socio-economic
    status, 1986–2011. This was the last free parish table on owners and tenants.
- **Ancestry.** Ranking areas by the share of immigrants and descendants would be discrimination in
  a housing search. KMSTA001 should not become a block.
- **Deaneries (provstier, 112).** The same tables exist per deanery: KM11, KM55, KMSTA002, KMSTA004,
  KMSTA006, KMST008A, KMSTA010, KM22, KM33, KM44. A deanery is about the size of a municipality, so
  these add nothing.

### Postal code: about 1,060 codes

| Table | Contents | Period | Cadence | Updated | Use | Rating |
|---|---|---|---|---|---|---|
| [POSTNR1](https://www.statbank.dk/POSTNR1) | Population 1 January by sex and five-year age groups, per postal code | 2010–2026 | Yearly | 2026-02-12 | Age profile, children | **High** where parishes are not used |
| [POSTNR2](https://www.statbank.dk/POSTNR2) | The same, per municipality × postal code (1,484 combinations) | 2010–2026 | Yearly | 2026-02-12 | Splits postal codes that cross municipal borders | Medium |

- **Discontinued postal-code tables:**
  - [PNR1](https://www.statbank.dk/PNR1): key figures per postal code, 1997–2005;
  - [EJEN3](https://www.statbank.dk/EJEN3) (quarterly 1992Q1–2002Q2) and
    [EJEN4](https://www.statbank.dk/EJEN4) (yearly 1992–2001): property sales per postal code, with
    the number sold, average price, price per m² and price as a share of the valuation. Too old to
    use.

### Urban area (byopgørelsen): about 1,500 towns of 200+ residents, and the rural rest

A town is a continuous built-up area with at least 200 residents. The town polygons are drawn by
SDFI, now Klimadatastyrelsen (KDS), and DST counts the CPR addresses inside them on 1 January
([documentation](https://www.dst.dk/da/Statistik/dokumentation/statistikdokumentation/byopgoerelsen)).
The code is `municipality-town` (e.g. `101-01100`), and `…-99999` is each municipality's rural
area.

| Table | Contents | Period | Cadence | Updated | Use | Rating |
|---|---|---|---|---|---|---|
| [BY3](https://www.statbank.dk/BY3) | Population, area (km²) and density per town | 2017–2026 | Yearly | 2026-06-10 | How urban a place is; town size | **High** |
| [BY1](https://www.statbank.dk/BY1) | Population by sex and one-year age per town | 2010–2026 | Yearly | 2026-05-21 | Age profile of a town | Medium |
| [BY4](https://www.statbank.dk/BY4) | Households by type and with/without children per town | 2010, 2013, 2016, 2019–2026 | Yearly | 2026-05-21 | Share of families with children | **High** |
| [BY2](https://www.statbank.dk/BY2) | Population per municipality by town size class | 2010–2026 | Yearly | 2026-05-21 | Municipal context only | Low |

Discontinued: [BEF44](https://www.statbank.dk/BEF44) (2006–2014) and
[BEF4A](https://www.statbank.dk/BEF4A) (1976–2004).

### Elections: polling district (afstemningsområde), about 1,300

| Table | Contents | Period | Updated | Use | Rating |
|---|---|---|---|---|---|
| [FV26TOTA](https://www.statbank.dk/FV26TOTA) | Folketing election 2026: votes per party, valid and invalid votes, per polling district (1,314), nomination district (92), storkreds and country | 2026 | 2026-04-15 | Political lean and turnout of a neighbourhood | Low–medium |
| [EV24TOTA](https://www.statbank.dk/EV24TOTA) | European Parliament election 2024, the same (1,297 polling districts) | 2024 | 2024-06-21 | As above | Low |
| [FA22TOTA](https://www.statbank.dk/FA22TOTA) | Referendum 2022 on the defence opt-out, the same (1,355) | 2022 | 2022-06-10 | As above | Low |
| [FV26TOT](https://www.statbank.dk/FV26TOT), [EV24TOT](https://www.statbank.dk/EV24TOT), [FA22TOT](https://www.statbank.dk/FA22TOT) | The same elections per nomination district | | | | Low |

- **History.** 83 discontinued tables hold the elections of 2007–2022 per polling district:
  - FV22TOTA, FV19TOTA, EV19TOTA;
  - one table per storkreds for 2007–2015 (FV07S01–FV15S10, EV09S01–EV14S10 and the referendums).
- **Codes.** The polling-district codes are DST's own, e.g. `321043` "Vester Hassing Hallen" in
  FV26TOTA. They change between elections (`2551338` for the same place in EV24TOTA) and are not
  DAGI's numbers. The join to DAGI is by name within the nomination district and municipality, and
  needs checking.
- **Turnout.** Turnout is in FV26TOTA's values, and the 2026 Folketing tables
  [FVSTEM1](https://www.statbank.dk/FVSTEM1) and [FVSTEM2](https://www.statbank.dk/FVSTEM2) add
  voters by age, but only per municipality.

### Crime: the municipality is the floor

**No StatBank table gives crime below the municipality.** There is nothing per postal code, police
district or parish, active or discontinued. Of all 5,739 tables, no variable or value names a
police district (politikreds), and no crime table has a postal code.

- **The finest crime tables are per municipality:**
  - [STRAF11](https://www.statbank.dk/STRAF11): reported offences, quarterly from 2007Q1;
  - [STRAF22](https://www.statbank.dk/STRAF22): reported offences and charges, yearly from 2007;
  - STRAF44, STRAF46 and STRAF47: decisions and sentences;
  - STRAFNA6–8: persons found guilty.

  STRAF1 and STRAF2 (1995–2006) are the same per pre-2007 municipality.
- **Burglaries** have three codes in STRAF11 and STRAF22, per municipality only:
  - `1320` residential burglaries;
  - `1316` business and community;
  - `1324` uninhabited buildings.
- **The scene's postal code exists in DST's crime register,** as the variable
  [MIN_POSTNR](https://www.dst.dk/da/Statistik/dokumentation/Times/kriminalstatistik/min-postnr)
  "Gerningssted - Postnummer", but it is not published in StatBank. The ways to get burglaries per
  postal code are:
  - a custom run (DKK 1,476 an hour, see below);
  - the research access, which is closed to us.

### Grid: none in StatBank

No StatBank table has a grid variable. The 100 m and 1 km statistics are paid products; see the
next sections.

### How to join these to the 100 m cells

| Level | Key in StatBank | Boundary source | Join |
|---|---|---|---|
| Parish | `SOGN`, 4-digit sognekode (7001–9349) | DAGI Sogneinddeling, Klimadatastyrelsen | Area overlay, or through the address: a cell takes the parish of its addresses |
| Postal code | `PNR20`, 4 digits; POSTNR2 adds the municipality code in front | DAGI Postnummerinddeling | Overlay with the postal-code polygons; with POSTNR2, intersect postal code × municipality |
| Urban area | `BYER`, municipality code + 5-digit town code | KDS's town polygons, which DST counts in; BY3's areas let us check a match | Inside a town polygon: the town; outside: the municipality's rural area (`99999`) |
| Polling district | DST's own code and name | DAGI Afstemningsområde | By name within municipality and nomination district, then overlay |
| Municipality | 3-digit kommunekode | DAGI Kommuneinddeling (OSM's municipalities work too, as today) | As today |

- **DAGI, the official boundary register.** Klimadatastyrelsen keeps it: parishes, municipalities,
  regions, postal codes, polling and nomination districts and more
  ([DAGI object specification](https://sdfe.dk/media/2919047/dagi_objektspecifikation_20_public.pdf)).
  - **The open DAWA API is gone.** `api.dataforsyningen.dk/sogne`, `/postnumre` and
    `/afstemningsomraader` all answer **HTTP 410 Gone** (checked 2026-10-09).
  - **What is left is Datafordeleren**, with the same free user and key as DAR and BBR (Track A in
    `data-sources.md`). Its old services close on 15 January 2027, after which access is only
    through GraphQL with an API key or OAuth
    ([Klimadatastyrelsen, June 2026](https://lovguiden.dk/det-offentlige/klimadatastyrelsen/2026-06-25-datafordelerens-modernisering-paralleldrift-ophoerer-15-januar-2027)).
- **The simplest join comes with the homes in milestone 4.**
  - DAR's addresses are tied to their DAGI areas, so each address can carry its parish, postal
    code and polling district. Check this field by field when DAR is loaded.
  - A cell's value is then the value of the areas its homes lie in, weighted by the number of
    homes.
  - This avoids polygon overlays, and puts nothing on cells without homes.
- **Rates, not counts.** Turn the counts into shares within each area before giving them to cells
  (share with higher education, share aged 0–6 …). An area's count spread over its cells would make
  big parishes look "more".

## The most useful municipality-level themes

398 active tables reach the 98 municipalities. Ranked for a home search; "Used" means the pilot
uses it today.

| # | Theme | Best tables | Period, cadence | Why | Rating | Used |
|--:|---|---|---|---|---|---|
| 1 | Income and inequality | [INDKP101](https://www.statbank.dk/INDKP101) (average income per person, 39 income types), [INDKF112](https://www.statbank.dk/INDKF112) (families, by children), [IFOR41](https://www.statbank.dk/IFOR41) (Gini, P90/P10), [IFOR12P](https://www.statbank.dk/IFOR12P) (relative poverty), [IFOR22](https://www.statbank.dk/IFOR22) (deciles) | 1987–2025, yearly | The main socio-economic signal. Not free below the municipality | **High** | No |
| 2 | Crime by type | [STRAF11](https://www.statbank.dk/STRAF11) (reported offences, 91 kinds) | 2007Q1–2026Q2, quarterly | Violence, vandalism, vehicle theft and so on, besides burglary. Divide by FOLK1A | **High** | Partly: burglaries from STRAF22 |
| 3 | Education | [HFUDD11](https://www.statbank.dk/HFUDD11) | 2008–2025, yearly | Context where parish data is thin; KMST007A is better | Medium | No |
| 4 | Families, age, population change | [FAM44N](https://www.statbank.dk/FAM44N) (families with children), [FAM55N](https://www.statbank.dk/FAM55N) (households), [GALDER](https://www.statbank.dk/GALDER) (average age), [BEV107](https://www.statbank.dk/BEV107) (births, deaths, moves), [FRKM126](https://www.statbank.dk/FRKM126) (forecast 2026–2050) | 1986/2005–2026, yearly | Families with children, and whether an area grows. The forecast says where schools and services will be under pressure | **High** | Population only (FOLK1A) |
| 5 | Housing stock | [BOL101](https://www.statbank.dk/BOL101) (owner/tenant, owner type incl. non-profit housing, type, year built), [BOL102](https://www.statbank.dk/BOL102) (heating, facilities), [BOL103](https://www.statbank.dk/BOL103) (rooms, m²), [BYGB40](https://www.statbank.dk/BYGB40) (heated area by heating type) | 2010/2011–2026, yearly | Share of owner-occupied, rented and non-profit (almene) homes. Becomes per home with BBR in milestone 4 | Medium | No |
| 6 | Unemployment and labour market | [AULP01](https://www.statbank.dk/AULP01) (full-time unemployed %), [AUP02](https://www.statbank.dk/AUP02) (monthly), [RAS201](https://www.statbank.dk/RAS201) (socio-economic status) | 2007–2026 | Economic health of an area; KMSTA005 gives it per parish | Medium | No |
| 7 | Commuting | [AFSTB4](https://www.statbank.dk/AFSTB4) (average commuting distance of residents), [PEND100](https://www.statbank.dk/PEND100) (residence × workplace municipality) | 2008–2024, yearly | How far people from here travel to work. Our own travel-time blocks measure it per cell | Medium | No |
| 8 | Cars | [BIL800](https://www.statbank.dk/BIL800) (families with 0, 1, 2+ cars), [BIL710](https://www.statbank.dk/BIL710) (cars by fuel, incl. electric) | 2007/2018–2026, yearly | A car-free life is possible where few families have cars | Medium | No |
| 9 | Childcare and school | [RES88](https://www.statbank.dk/RES88) (yearly childcare fees per institution type), [BOERN8](https://www.statbank.dk/BOERN8) (children per adult in daycare), [KVOTIEN](https://www.statbank.dk/KVOTIEN) (pupils per class) | 2007/2009/2023–2025/2026, yearly | Real costs and quality for families. Fees differ a lot between municipalities | **High** for families | No |
| 10 | Property taxes and valuations | [EJDSK2](https://www.statbank.dk/EJDSK2) (land tax per mille and rates), [ESKAT](https://www.statbank.dk/ESKAT) (tax base) | 2006/2007–2026, yearly | Running cost of owning | Medium | Land tax rate via PSKAT |
| 11 | Forced sales | [TVANG3](https://www.statbank.dk/TVANG3) | 2012–2025, yearly | A weak sign of financial stress; divide by the number of homes | Low | No |
| 12 | Health and services | [SUNDAF01](https://www.statbank.dk/SUNDAF01) (average distance to the nearest GP, experimental, 2024), [HISBK](https://www.statbank.dk/HISBK) (life expectancy, five-year windows), [NGLK](https://www.statbank.dk/NGLK) (municipal spending per pupil, per child 0–10, per elderly) | 2008–2025 | Service level. Distance to a GP can be computed per cell once GP locations are known | Low–medium | No |
| 13 | Broadband | [LABY51](https://www.statbank.dk/LABY51) (share of homes with access, by speed) | 2014–2025, yearly | Matters for remote work. The address-level broadband map (Energistyrelsen) is better | Low | No |
| 14 | New construction | [BYGV33](https://www.statbank.dk/BYGV33) (housing started, completed), [BYGV11](https://www.statbank.dk/BYGV11) | 2006Q1–2026Q2, quarterly | Where an area is being built out; Plandata's local plans are finer | Low | No |
| 15 | Road accidents | [UHELDK1](https://www.statbank.dk/UHELDK1) (injured and killed) | 1998–2025, yearly | Weak per municipality; the Vejdirektoratet accident points are better | Low | No |
| 16 | Elections | [FVKOM](https://www.statbank.dk/FVKOM), [KVRES](https://www.statbank.dk/KVRES) | 2005–2026 | Polling-district tables are finer (above) | Low | No |
| 17 | Property prices | Only per province: [EJEN77](https://www.statbank.dk/EJEN77) (sales, average prices, quarterly), [EJ56](https://www.statbank.dk/EJ56) (price index); rents per region: [HUS1](https://www.statbank.dk/HUS1) | 1992–2026 | Too coarse for a cell; context only | Low | No |
| 18 | Holiday homes, tourism | Cottages as a use in [BOL101](https://www.statbank.dk/BOL101) per municipality; holiday-home lettings [FERIEH3](https://www.statbank.dk/FERIEH3) and overnight stays [TURIST](https://www.statbank.dk/TURIST) only per province | | Holiday-home areas come better from Plandata's zone map | Low | No |

**Traps:**

- **Owners and wealth by residence.** [EJDFOE1](https://www.statbank.dk/EJDFOE1) (market value of
  real estate) and [EJERFOF1](https://www.statbank.dk/EJERFOF1) (wealth in real estate and loans) are
  by the owner's municipality of residence. They describe the residents, not the homes in the place.
- **Energy.** Energy tables are mostly national; [ENEGEO](https://www.statbank.dk/ENEGEO) is
  industry only.
- **Municipality groups.** Some tables offer only the five typological groups, the "LABY" tables.
  Many of those, such as LABY51, also list each municipality.

## Data outside StatBank

| Offer | What | Level | Free? | Price (2026, excl. VAT) | For us |
|---|---|---|---|---|---|
| [Kvadratnet](https://www.dst.dk/da/TilSalg/produkter/geodata/kvadratnet), the grid itself | Det Danske Kvadratnet: cells named by their lower-left corner in EPSG:25832, 100 m to 100 km ([specification](https://www.dst.dk/ext/207885254380/0/kundecenter/Information-om-det-danske-kvadratnet-2024_v2--pdf)) | Grid | **Yes** | – | `build_grid.py` already builds on this grid, so DST grid data would join cell for cell |
| Kvadratnet statistics: night population (natbefolkning) | Households and persons per 100 m cell by home address ([documentation](https://www.dst.dk/ext/7435569093/0/kundecenter/Dokumentation-DST-Kvadratnet-Natbefolkning--pdf); cell IDs like `100M_61290_5904`) | 100 m, merged into clusters below 50–150 households | No | Whole country DKK 42,170; one region 16,868; one municipality 6,747 ([price list](https://www.dst.dk/ext/8847912875098/0/kundecenter/PriserDetaljeret_Kvadratnet_2026--pdf)) | The best population layer there is; set aside for its price |
| Kvadratnet: day population | Employed and students by workplace or place of study per cell | As above | No | Whole country DKK 54,821 | Low |
| Kvadratnet: variables | Residents by a chosen variable, e.g. personal income (DST01) | As above | No | Whole country DKK 54,821 **per variable**; extra years at half price | Income per cell, at a price |
| 1 km population demo map ([map](https://www.dst.dk/websites/extranet/kvadratnet/index.html)) | A public Leaflet demo whose data file `km1bef.js` holds 38,865 1 km cells, but only as density classes 1–6 (1–19 … 400+ residents), not counts. The file dates from November 2019, and no licence is stated | 1 km | Readable, terms unclear | – | Too coarse and old; not worth using |
| [Oplands- og afstandsanalyser](https://www.dst.dk/da/TilSalg/produkter/geodata/oplands-ogafstandsanalyser) | Statistics for a self-drawn area or radius (straight line, road distance, drive time) | Any area that passes the disclosure rules | No | On request | No |
| [Vejsegmentering](https://www.dst.dk/da/TilSalg/produkter/geodata/vejsegmentering) | Roads ranked by a target group, with households in clusters of at least 400 | Road segments | No | Whole country DKK 63,255; road pieces 75,905 ([price list](https://www.dst.dk/ext/8638712875099/0/kundecenter/PriserDetaljeret_Vejsegmentering_2026--pdf)) | No |
| [Nøgletal på sogne](https://www.dst.dk/da/TilSalg/produkter/noegletal/noegletal-paa-sogne) | Paid tables in the Betalingsdatabank: households (SOGN02), socio-economic status (SOGN05), cars (SOGN07), personal income before tax and disposable (SOGN9A, 9B), household income (SOGN10A), education (SOGN10B) | Parish | No | About DKK 3,700–11,400 per table, for 12 months of downloads | **Income per parish** is the one thing here worth paying for. The rest is free in the church tables |
| [Nøgletal på postnumre](https://www.dst.dk/da/TilSalg/produkter/noegletal/noegletal-paa-postnumre) | 12 tables: age, households, socio-economic status, commuting, cars, education, personal and household income (POST1–POST10B) | Postal code | No | About DKK 3,700–11,500 per table | As above |
| [Husstande med biler](https://www.dst.dk/da/TilSalg/produkter/uddannelse-social-og-sundhed/husstande-med-biler) | Households with 0, 1, 2, 3, 3+ cars | Postal code and parish, 2011–2020 | No | DKK 6,277 per table (7,846.25 with VAT) | Low |
| [Ejendomssalg](https://www.dst.dk/da/TilSalg/produkter/erhvervsliv-og-handel/ejendomssalg) | Sales by 29 property types, average price, price per m², price as a share of the valuation; EJS30 (quarterly) and EJS40 (yearly) per postal code | Postal code, 1992–2020 | No | DKK 7,554 per table | The only sale prices below the province from DST, and they end in 2020 |
| [Nøgletal på boligområder](https://www.dst.dk/da/TilSalg/produkter/noegletal/noegletal-paa-boligomraader) | 17 tables (age, households, education, income, benefits, crime …) for an area the buyer defines by streets, at least 20 households | Any small area | No | DKK 6,088 per area | No: one area at a time |
| [Custom statistics](https://www.dst.dk/da/TilSalg/skraeddersyede-loesninger) (særkørsler) | Any combination of DST's registers | Any, within the disclosure rules | No | DKK 1,476 per hour ([prices](https://www.dst.dk/da/TilSalg/skraeddersyede-loesninger/priser-og-aftalevilkaar/prispolitik)) | Possible later, e.g. income per grid cell for the whole country |
| [Forskningsservice](https://www.dst.dk/da/TilSalg/data-til-forskning/autorisering-af-institutioner) | Pseudonymised microdata on DST's servers | Person | – | – | **Not usable.** Only authorised, lasting research environments with at least three experienced researchers; private ones must be a year old; results are for research |

- **Boundaries.**
  - DST publishes no boundary files of its own. Its geodata products are the three above.
  - Parishes, postal codes, municipalities and polling districts are DAGI's, from Klimadatastyrelsen.
  - The town polygons behind byopgørelsen are drawn by KDS ([byopgørelsen](https://www.dst.dk/da/Statistik/dokumentation/statistikdokumentation/byopgoerelsen)).
  - StatBank's map names (`denmark_parish_23_4c` …) only drive its own map view. There is no
    public endpoint for them.
- **"Statistik i kort" and Kommunekort.**
  - [Kommunekort](https://www.dst.dk/da/Statistik/kommunekort) compares municipalities on spending,
    elder care, childcare fees, income and unemployment. It is built on StatBank tables, at
    municipality level only.
  - No separate open-data or map service with finer data was found on dst.dk.
- **Outside DST.** Eurostat's census grid holds the 2021 census on 1 km cells across the EU: age
  groups, sex, employment, place of birth, moves
  ([GISCO population grids](https://ec.europa.eu/eurostat/web/gisco/geodata/population-distribution/population-grids)).
  - Denmark's part comes from DST's registers.
  - It is in EPSG:3035, not the Danish grid, and its download rules were not checked.
  - At 1 km and from 2021 it adds little to the parish tables.

## Appendix: every table with a place

The 1,831 tables with a place below the whole country, by finest level. "Contents" is the table's
own description from `tableinfo`. Codes link to statbank.dk.

**By subject.** Every table, split into those with a place below the whole country and those for the whole country only (active in brackets). Subjects from the `subjects` call; 38 tables sit under two subjects and are counted under the first.

| Subject | All tables | Sub-national (active) | National only (active) |
|---|--:|--:|--:|
| Business | 1,122 | 196 (77) | 926 (332) |
| Culture and leisure | 616 | 110 (72) | 506 (227) |
| Economy | 1,076 | 136 (43) | 940 (311) |
| Education and research | 317 | 122 (35) | 195 (84) |
| Environment and energy | 232 | 21 (11) | 211 (101) |
| Labour and income | 770 | 320 (125) | 450 (216) |
| People | 775 | 487 (164) | 288 (145) |
| Social conditions | 601 | 401 (86) | 200 (110) |
| Transport | 230 | 38 (17) | 192 (153) |

<details><summary>polling district: 86 tables (3 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [EV24TOTA](https://www.statbank.dk/EV24TOTA) | European Parliament Election 2024 by result of the election, region | 2024 | yes |
| [FA22TOTA](https://www.statbank.dk/FA22TOTA) | Referendum on converting the opt-out on EU matters on Defence Reservation 2022 by result of the election, region | 2022 | yes |
| [FV26TOTA](https://www.statbank.dk/FV26TOTA) | Election to the Danish Parliament by result of the election, region | 2026 | yes |
| [EV09S01](https://www.statbank.dk/EV09S01) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S02](https://www.statbank.dk/EV09S02) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S03](https://www.statbank.dk/EV09S03) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S04](https://www.statbank.dk/EV09S04) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S05](https://www.statbank.dk/EV09S05) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S06](https://www.statbank.dk/EV09S06) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S07](https://www.statbank.dk/EV09S07) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S08](https://www.statbank.dk/EV09S08) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S09](https://www.statbank.dk/EV09S09) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV09S10](https://www.statbank.dk/EV09S10) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV14S01](https://www.statbank.dk/EV14S01) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S02](https://www.statbank.dk/EV14S02) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S03](https://www.statbank.dk/EV14S03) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S04](https://www.statbank.dk/EV14S04) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S05](https://www.statbank.dk/EV14S05) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S06](https://www.statbank.dk/EV14S06) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S07](https://www.statbank.dk/EV14S07) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S08](https://www.statbank.dk/EV14S08) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S09](https://www.statbank.dk/EV14S09) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV14S10](https://www.statbank.dk/EV14S10) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV19TOTA](https://www.statbank.dk/EV19TOTA) | European Parliament Election 2019 by result of the election, region | 2019 | no |
| [FA09S01](https://www.statbank.dk/FA09S01) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S02](https://www.statbank.dk/FA09S02) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S03](https://www.statbank.dk/FA09S03) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S04](https://www.statbank.dk/FA09S04) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S05](https://www.statbank.dk/FA09S05) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S06](https://www.statbank.dk/FA09S06) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S07](https://www.statbank.dk/FA09S07) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S08](https://www.statbank.dk/FA09S08) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S09](https://www.statbank.dk/FA09S09) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA09S10](https://www.statbank.dk/FA09S10) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA14S01](https://www.statbank.dk/FA14S01) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S02](https://www.statbank.dk/FA14S02) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S03](https://www.statbank.dk/FA14S03) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S04](https://www.statbank.dk/FA14S04) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S05](https://www.statbank.dk/FA14S05) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S06](https://www.statbank.dk/FA14S06) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S07](https://www.statbank.dk/FA14S07) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S08](https://www.statbank.dk/FA14S08) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S09](https://www.statbank.dk/FA14S09) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA14S10](https://www.statbank.dk/FA14S10) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA15S01](https://www.statbank.dk/FA15S01) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S02](https://www.statbank.dk/FA15S02) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S03](https://www.statbank.dk/FA15S03) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S04](https://www.statbank.dk/FA15S04) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S05](https://www.statbank.dk/FA15S05) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S06](https://www.statbank.dk/FA15S06) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S07](https://www.statbank.dk/FA15S07) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S08](https://www.statbank.dk/FA15S08) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S09](https://www.statbank.dk/FA15S09) | Referendum 2015 by result of the election, region | 2015 | no |
| [FA15S10](https://www.statbank.dk/FA15S10) | Referendum 2015 by result of the election, region | 2015 | no |
| [FV07S01](https://www.statbank.dk/FV07S01) | Election to the Parliament 2007 in Københavns Storkreds by result of the election, region | 2007 | no |
| [FV07S02](https://www.statbank.dk/FV07S02) | Election to the Parliament 2007  in Københavns Omegns Storkreds by result of the election, region | 2007 | no |
| [FV07S03](https://www.statbank.dk/FV07S03) | Election to the Parliament 2007  in Nordsjællands Storkreds by result of the election, region | 2007 | no |
| [FV07S04](https://www.statbank.dk/FV07S04) | Election to the Parliament 2007 in Bornholms Storkreds by result of the election, region | 2007 | no |
| [FV07S05](https://www.statbank.dk/FV07S05) | Election to the Parliament 2007 in Sjællands Storkreds by result of the election, region | 2007 | no |
| [FV07S06](https://www.statbank.dk/FV07S06) | Election to the Parliament 2007  in Fyns Storkreds by result of the election, region | 2007 | no |
| [FV07S07](https://www.statbank.dk/FV07S07) | Election to the Parliament 2007 in Sydjyllands Storkreds by result of the election, region | 2007 | no |
| [FV07S08](https://www.statbank.dk/FV07S08) | Election to the Parliament 2007 in Østjyllands Storkreds by result of the election, region | 2007 | no |
| [FV07S09](https://www.statbank.dk/FV07S09) | Election to the Parliament 2007 in Vestjyllands Storkreds by result of the election, region | 2007 | no |
| [FV07S10](https://www.statbank.dk/FV07S10) | Election to the Parliament 2007 of Nordjyllands Storkreds by result of the election, region | 2007 | no |
| [FV11S01](https://www.statbank.dk/FV11S01) | Election to the Parliament 2011 in Københavns Storkreds by result of the election, region | 2011 | no |
| [FV11S02](https://www.statbank.dk/FV11S02) | Election to the Parliament 2011 in Københavns Omegns Storkreds by result of the election, region | 2011 | no |
| [FV11S03](https://www.statbank.dk/FV11S03) | Election to the Parliament 2011 in Nordsjællands Storkreds by result of the election, region | 2011 | no |
| [FV11S04](https://www.statbank.dk/FV11S04) | Election to the Parliament 2011 in Bornholms Storkreds by result of the election, region | 2011 | no |
| [FV11S05](https://www.statbank.dk/FV11S05) | Election to the Parliament 2011 in Sjællands Storkreds by result of the election, region | 2011 | no |
| [FV11S06](https://www.statbank.dk/FV11S06) | Election to the Parliament 2011 in Fyns Storkreds by result of the election, region | 2011 | no |
| [FV11S07](https://www.statbank.dk/FV11S07) | Election to the Parliament 2011 in Sydjyllands Storkreds by result of the election, region | 2011 | no |
| [FV11S08](https://www.statbank.dk/FV11S08) | Election to the Parliament 2011 in Østjyllands Storkreds by result of the election, region | 2011 | no |
| [FV11S09](https://www.statbank.dk/FV11S09) | Election to the Parliament 2011 in Vestjyllands Storkreds by result of the election, region | 2011 | no |
| [FV11S10](https://www.statbank.dk/FV11S10) | Election to the Parliament 2011 in Nordjyllands Storkreds by result of the election, region | 2011 | no |
| [FV15S01](https://www.statbank.dk/FV15S01) | Election to the Parliament 2015 in Københavns Storkreds by result of the election, region | 2015 | no |
| [FV15S02](https://www.statbank.dk/FV15S02) | Election to the Parliament 2015 in Københavns Omegns Storkreds by result of the election, region | 2015 | no |
| [FV15S03](https://www.statbank.dk/FV15S03) | Election to the Parliament 2015 in Nordsjællands Storkreds by result of the election, region | 2015 | no |
| [FV15S04](https://www.statbank.dk/FV15S04) | Election to the Parliament 2015 in Bornholms Storkreds by result of the election, region | 2015 | no |
| [FV15S05](https://www.statbank.dk/FV15S05) | Election to the Parliament 2015 in Sjællands Storkreds by result of the election, region | 2015 | no |
| [FV15S06](https://www.statbank.dk/FV15S06) | Election to the Parliament 2015 in Fyns Storkreds by result of the election, region | 2015 | no |
| [FV15S07](https://www.statbank.dk/FV15S07) | Election to the Parliament 2015 in Sydjyllands Storkreds by result of the election, region | 2015 | no |
| [FV15S08](https://www.statbank.dk/FV15S08) | Election to the Parliament 2015 in Østjyllands Storkreds by result of the election, region | 2015 | no |
| [FV15S09](https://www.statbank.dk/FV15S09) | Election to the Parliament 2015 in Vestjyllands Storkreds by result of the election, region | 2015 | no |
| [FV15S10](https://www.statbank.dk/FV15S10) | Election to the Parliament 2015 in Nordjyllands Storkreds by result of the election, region | 2015 | no |
| [FV19TOTA](https://www.statbank.dk/FV19TOTA) | Election to the Parliament 2019 by result of the election, region | 2019 | no |
| [FV22TOTA](https://www.statbank.dk/FV22TOTA) | Election to the Parliament 2022 by result of the election, region | 2022 | no |

</details>

<details><summary>parish: 17 tables (12 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [KM1](https://www.statbank.dk/KM1) | Population at the first day of the quarter by parish, member of the National Church | 2007Q1–2026Q3 | yes |
| [KM2](https://www.statbank.dk/KM2) | Registration and resignation from the National Church by parish, age, member of the National Church | 2007Q1–2026Q2 | yes |
| [KM3](https://www.statbank.dk/KM3) | Live births and deaths by parish, movement | 2007Q1–2026Q2 | yes |
| [KM4](https://www.statbank.dk/KM4) | Religious ceremonies by parish, movement | 2006–2025 | yes |
| [KM5](https://www.statbank.dk/KM5) | Population 1. January by parish, sex, age, member of the National Church | 2007–2026 | yes |
| [KMGALDER](https://www.statbank.dk/KMGALDER) | Average age by parish, sex | 2007–2026 | yes |
| [KMST007A](https://www.statbank.dk/KMST007A) | Population 1. October (15 years+) by parish, member of the National Church, highest education completed | 2015–2025 | yes |
| [KMSTA001](https://www.statbank.dk/KMSTA001) | Population 1. January by parish, ancestry, member of the National Church | 2008–2026 | yes |
| [KMSTA003](https://www.statbank.dk/KMSTA003) | Summary vital statistics by parish, movements | 2015–2025 | yes |
| [KMSTA005](https://www.statbank.dk/KMSTA005) | Population 1. January (15 years+) by parish, socioeconomic status, member of the National Church | 2016–2025 | yes |
| [KMSTA009](https://www.statbank.dk/KMSTA009) | Population 1. January (15 years+) by parish, member of the National Church, commuting | 2016–2025 | yes |
| [SOGN1](https://www.statbank.dk/SOGN1) | Population 1. January by parish, sex, age | 2010–2026 | yes |
| [BEF4B](https://www.statbank.dk/BEF4B) | Population 1. January by parishes | 1976–2006 | no |
| [BEFS4](https://www.statbank.dk/BEFS4) | Population 1. January by parishes | 2007–2008 | no |
| [INDKF41](https://www.statbank.dk/INDKF41) | Families by parish, ownership, socioeconomic status | 1986–2011 | no |
| [KMSTA007](https://www.statbank.dk/KMSTA007) | Population 1. January (15 years+) by parish, member of the National Church, highest education completed | 2016–2019 | no |
| [SOGN10](https://www.statbank.dk/SOGN10) | Population 1. January by parish | 1925–2022 | no |

</details>

<details><summary>postal code: 5 tables (2 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [POSTNR1](https://www.statbank.dk/POSTNR1) | Population 1. January by postal code, sex, age | 2010–2026 | yes |
| [POSTNR2](https://www.statbank.dk/POSTNR2) | Population 1. January by postal code, sex, age | 2010–2026 | yes |
| [EJEN3](https://www.statbank.dk/EJEN3) | Sales of real property by region, category of real property, key figures, type of transfer | 1992Q1–2002Q2 | no |
| [EJEN4](https://www.statbank.dk/EJEN4) | Sales of real property by region, category of real property, key figures, type of transfer | 1992–2001 | no |
| [PNR1](https://www.statbank.dk/PNR1) | Key figures by region | 1997–2005 | no |

</details>

<details><summary>urban area: 5 tables (3 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [BY1](https://www.statbank.dk/BY1) | Population 1. January by urban and rural areas, age, sex | 2010–2026 | yes |
| [BY3](https://www.statbank.dk/BY3) | Population 1. January by urban and rural areas, population area and population density | 2017–2026 | yes |
| [BY4](https://www.statbank.dk/BY4) | Households 1. January by urban and rural areas, type of household, number of children | 2010–2026 | yes |
| [BEF44](https://www.statbank.dk/BEF44) | Population 1. January by urban and rural areas | 2006–2014 | no |
| [BEF4A](https://www.statbank.dk/BEF4A) | Population 1. January by urban and rural areas | 1976–2004 | no |

</details>

<details><summary>nomination district: 14 tables (3 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [EV24TOT](https://www.statbank.dk/EV24TOT) | European Parliament Election 2024 by result of the election, region | 2024 | yes |
| [FA22TOT](https://www.statbank.dk/FA22TOT) | Referendum on converting the opt-out on EU matters on Defence Reservation 2022 by result of the election, region | 2022 | yes |
| [FV26TOT](https://www.statbank.dk/FV26TOT) | Election to the Danish Parliament by result of the election, region | 2026 | yes |
| [EV09TOT](https://www.statbank.dk/EV09TOT) | European Parliament Election 2009 by result of the election, region | 2009 | no |
| [EV14TOT](https://www.statbank.dk/EV14TOT) | European Parliament Election 2014 by result of the election, region | 2014 | no |
| [EV19TOT](https://www.statbank.dk/EV19TOT) | European Parliament Election 2019 by result of the election, region | 2019 | no |
| [FA09TOT](https://www.statbank.dk/FA09TOT) | Referendum on the Act of Succession to the Throne 2009 by result of the election, region | 2009 | no |
| [FA14TOT](https://www.statbank.dk/FA14TOT) | Referendum on joining the Unified Patent Court 2014 by result of the election, region | 2014 | no |
| [FA15TOT](https://www.statbank.dk/FA15TOT) | Referendum 2015 by result of the election, region | 2015 | no |
| [FV07TOT](https://www.statbank.dk/FV07TOT) | Election to the Parliament 2007 by result of the election, region | 2007 | no |
| [FV11TOT](https://www.statbank.dk/FV11TOT) | Election to the Parliament 2011 by result of the election, region | 2011 | no |
| [FV15TOT](https://www.statbank.dk/FV15TOT) | Election to the Parliament 2015 by result of the election, region | 2015 | no |
| [FV19TOT](https://www.statbank.dk/FV19TOT) | Election to the Parliament 2019 by result of the election, region | 2019 | no |
| [FV22TOT](https://www.statbank.dk/FV22TOT) | Election to the Parliament 2022 by result of the election, region | 2022 | no |

</details>

<details><summary>municipality: 805 tables (398 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [BDF51](https://www.statbank.dk/BDF51) | Farms by region, selected farms crops and livestock | 2010–2020 | yes |
| [BYGB12](https://www.statbank.dk/BYGB12) | Buildings by region, ownership, use, areal intervals | 2011–2026 | yes |
| [BYGB34](https://www.statbank.dk/BYGB34) | Areas of the building stock by region, use, area type, year of construction | 2011–2026 | yes |
| [BYGB40](https://www.statbank.dk/BYGB40) | Buildings and their heated area by region, unit, type of heating, use, year of construction | 2011–2026 | yes |
| [BYGB50](https://www.statbank.dk/BYGB50) | Buildings and their building stock by region, unit, roofing material, use, year of construction | 2011–2026 | yes |
| [BYGB60](https://www.statbank.dk/BYGB60) | Buildings and their floor area by region, unit, outer wall material, use, year of construction | 2011–2026 | yes |
| [BYGB70](https://www.statbank.dk/BYGB70) | Buildings and their floor area by region, unit, use | 2021–2026 | yes |
| [BYGV11](https://www.statbank.dk/BYGV11) | Total construction (not adjusted for delays) by region, phase of construction, use, builders | 2006Q1–2026Q2 | yes |
| [BYGV22](https://www.statbank.dk/BYGV22) | New buildings completed (not adjusted for delays) by region, unit, year of commencement, type of building case, use | 2006Q1–2026Q2 | yes |
| [BYGV33](https://www.statbank.dk/BYGV33) | Residential Construction (not adjusted for delays) by region, phase of construction, use, builders | 2006Q1–2026Q2 | yes |
| [DEMO19](https://www.statbank.dk/DEMO19) | Business Demography by municipality, unit | 2019–2024 | yes |
| [ERHV2](https://www.statbank.dk/ERHV2) | Workplaces and job by region, industry (DB07 10-grouping), unit | 2008–2024 | yes |
| [ERHV5](https://www.statbank.dk/ERHV5) | Workplaces by region, sector | 2008–2024 | yes |
| [ERHV6](https://www.statbank.dk/ERHV6) | Workplaces by region, industry (DB07 10-grouping), size of workplace | 2008–2024 | yes |
| [GF12](https://www.statbank.dk/GF12) | General enterprise statistics by municipality, industry (DB07 10- 19- and 127 grouping and detailed) | 2019–2024 | yes |
| [KONK8](https://www.statbank.dk/KONK8) | Bankruptcies by municipality, type of enterprise | 2009M01–2026M09 | yes |
| [LABY37](https://www.statbank.dk/LABY37) | New construction (not adjusted for delays) by municipality groups, use | 2006Q1–2026Q2 | yes |
| [RST01](https://www.statbank.dk/RST01) | Extraction of raw materials in Denmark. by region, type of raw material | 2006–2025 | yes |
| [RST04](https://www.statbank.dk/RST04) | Unloading of raw materials from the bottom of the sea by region, type of raw material | 2007–2025 | yes |
| [BIA01](https://www.statbank.dk/BIA01) | Personal recipients of library money by region, sex, age | 2010–2023 | yes |
| [BIA02](https://www.statbank.dk/BIA02) | Payments of library money by region, sex, age | 2010–2023 | yes |
| [BIB2B](https://www.statbank.dk/BIB2B) | Public libraries by region, activity | 2009–2025 | yes |
| [BIB3A](https://www.statbank.dk/BIB3A) | Public libraries physical materials by region, collection, inventory, material type | 2009–2025 | yes |
| [BIB4E](https://www.statbank.dk/BIB4E) | Public libraries stock and use of electronic resources by region, inventory, electronic material type | 2014–2025 | yes |
| [BIB5](https://www.statbank.dk/BIB5) | Public libraries interlibrary loans by region, inventory, material type | 2009–2025 | yes |
| [BIB6](https://www.statbank.dk/BIB6) | Public libraries economy by region, revenue/expenditure | 2009–2025 | yes |
| [BIB8](https://www.statbank.dk/BIB8) | Full time employees at public libraries by region, category of staff | 2009–2025 | yes |
| [FSBIB1](https://www.statbank.dk/FSBIB1) | Public basic school libraries key figures by municipality, key figures | 2022–2025 | yes |
| [FSTRIB1](https://www.statbank.dk/FSTRIB1) | Filmstribens loans and loaners by municipality, sex, category | 2024Q1–2026Q2 | yes |
| [FSTRIB1A](https://www.statbank.dk/FSTRIB1A) | Filmstribens loans and loaners by municipality, sex, category | 2024–2025 | yes |
| [FSTRIB2](https://www.statbank.dk/FSTRIB2) | Filmstribens loans and loaners by municipality, age, category | 2024Q1–2026Q2 | yes |
| [FSTRIB2A](https://www.statbank.dk/FSTRIB2A) | Filmstribens loans and loaners by municipality, age, category | 2024–2025 | yes |
| [FSTRIB3](https://www.statbank.dk/FSTRIB3) | Filmstribens loans and loaners by municipality, highest education completed, category | 2024Q1–2026Q2 | yes |
| [FSTRIB3A](https://www.statbank.dk/FSTRIB3A) | Filmstribens loans and loaners by municipality, highest education completed, category | 2024–2025 | yes |
| [IBIB1](https://www.statbank.dk/IBIB1) | Loans and loaners by region, library, sex, category | 2020Q1–2026Q2 | yes |
| [IBIB1A](https://www.statbank.dk/IBIB1A) | Lending and borrowers by region, library, sex, category | 2020–2025 | yes |
| [IBIB2](https://www.statbank.dk/IBIB2) | Loans and loaners by region, library, age, category | 2020Q1–2026Q2 | yes |
| [IBIB2A](https://www.statbank.dk/IBIB2A) | Loans and loaners by region, library, age, category | 2020–2025 | yes |
| [IBIB3](https://www.statbank.dk/IBIB3) | Loans and loaners by region, library, highest education completed, category | 2020Q1–2026Q2 | yes |
| [IBIB3A](https://www.statbank.dk/IBIB3A) | Loans and loaners by region, library, highest education completed, category | 2020–2025 | yes |
| [IBIB4](https://www.statbank.dk/IBIB4) | Loans and loaners by region, distance from home to the library, category | 2020Q1–2026Q1 | yes |
| [IBIB4A](https://www.statbank.dk/IBIB4A) | Loans and loaners by region, distance from home to the library, category | 2020–2025 | yes |
| [IDRAKT01](https://www.statbank.dk/IDRAKT01) | Members of sports organizations by region, activity, sex, age | 2014–2025 | yes |
| [IDRAKT02](https://www.statbank.dk/IDRAKT02) | Memberships of sports organizations (share of population) by region, sex, age | 2014–2025 | yes |
| [IDRFAC01](https://www.statbank.dk/IDRFAC01) | Sports facilities by region, facility type | 2017–2026 | yes |
| [IDRFIN01](https://www.statbank.dk/IDRFIN01) | Sports expenses of municipalities ( DKK 1,000) by region, function, dranst | 2011–2025 | yes |
| [IDRFIN02](https://www.statbank.dk/IDRFIN02) | Sports expenses of municipalities pr. capita (DDK) by county, function, dranst | 2011–2025 | yes |
| [IDRFOR01](https://www.statbank.dk/IDRFOR01) | Sports associations and members by region, organisation, key figures | 2014–2025 | yes |
| [KUBS05](https://www.statbank.dk/KUBS05) | Personal recipients of payments by the Ministry of Culture by region, cultural domains, sex, age groups | 2010–2023 | yes |
| [KUBS06](https://www.statbank.dk/KUBS06) | Payments by the Ministry of Culture to personal recipients by region, cultural domains, sex, age groups | 2010–2023 | yes |
| [KUBS07](https://www.statbank.dk/KUBS07) | Companies receiving payments by the Ministry of Culture by location, cultural domains, type of company, size of company | 2010–2023 | yes |
| [KUBS08](https://www.statbank.dk/KUBS08) | Payments by the Ministry of Culture to companies by location, cultural domains, type of company, size of company | 2010–2023 | yes |
| [KUERH2](https://www.statbank.dk/KUERH2) | Cultural business structure by region, activity, unit | 2008–2023 | yes |
| [KV2GEO](https://www.statbank.dk/KV2GEO) | Use of cultural activities by cultural activity, municipality | 2024–2025 | yes |
| [LABY51](https://www.statbank.dk/LABY51) | Broadband coverage (share of private residence with access to broadband internet by municipality groups, broadband speed | 2014–2025 | yes |
| [LIGEKI1](https://www.statbank.dk/LIGEKI1) | Gender equality indicator of personal recipients of payments by the Min. of Cult by indicator, region, cultural domains, age groups | 2010–2023 | yes |
| [LIGEKI2](https://www.statbank.dk/LIGEKI2) | Gender equality indicator of payments by the Min. of Cul. to personal recipients by indicator, region, cultural domains, age groups | 2010–2023 | yes |
| [LIGEKI3A](https://www.statbank.dk/LIGEKI3A) | Gender equality indicator of pupils in music schools by indicator, municipality, age | 2021:2022–2024:2025 | yes |
| [SBS1](https://www.statbank.dk/SBS1) | Comparative statistics of public libraries by region, key figures | 2009–2025 | yes |
| [SKOLM01](https://www.statbank.dk/SKOLM01) | Music schools by municipality, key figures | 2021:2022–2024:2025 | yes |
| [SKOLM02A](https://www.statbank.dk/SKOLM02A) | Students activities at music schools by municipality, subject, age, sex | 2021:2022–2024:2025 | yes |
| [SKOLM02B](https://www.statbank.dk/SKOLM02B) | Students at music schools by municipality, age, sex | 2021:2022–2024:2025 | yes |
| [SKOLM04A](https://www.statbank.dk/SKOLM04A) | Employees full time work at the music schools by municipality, occupation, subject area | 2021:2022–2024:2025 | yes |
| [SKOLM05](https://www.statbank.dk/SKOLM05) | Music Schools economy by municipality, economic key figures | 2012:2013–2024:2025 | yes |
| [SKOLM06](https://www.statbank.dk/SKOLM06) | Talent students at music schools by municipality, art form | 2022:2023–2024:2025 | yes |
| [SKOLM07](https://www.statbank.dk/SKOLM07) | Events at music schools by municipality, Event type, key figures | 2022:2023–2024:2025 | yes |
| [SKOLM08](https://www.statbank.dk/SKOLM08) | Short projects at music schools by municipality, art form, key figures | 2022:2023–2024:2025 | yes |
| [SKOLM09](https://www.statbank.dk/SKOLM09) | Music school collaborations with childcare services by municipality, art form, age groups, key figures | 2022:2023–2024:2025 | yes |
| [SKOLM10](https://www.statbank.dk/SKOLM10) | Music school collaborations with primary schools by municipality, art form, class, teaching category, key figures | 2022:2023–2024:2025 | yes |
| [SKOLM11](https://www.statbank.dk/SKOLM11) | Music school collaborations with upper secondary schools and youth schools by municipality, art form, key figures | 2022:2023–2024:2025 | yes |
| [SKOLM12](https://www.statbank.dk/SKOLM12) | Music schools other collaborations by municipality, art form, purpose, key figures | 2022:2023–2024:2025 | yes |
| [BUDK1](https://www.statbank.dk/BUDK1) | Municipal budgets, main accounts by municipality, main account, dranst, kind, price unit | 2007–2026 | yes |
| [BUDK100](https://www.statbank.dk/BUDK100) | Municipal budgets, groupings without text by region, function, dranst, ownership, grouping, kind, price unit | 2017–2026 | yes |
| [BUDK32](https://www.statbank.dk/BUDK32) | Municipal budgets, functions by municipality, function, dranst, kind, price unit | 2007–2026 | yes |
| [BUDKC](https://www.statbank.dk/BUDKC) | Municipal budgets, groupings with text by region, dranst function and grouping, ownership, kind, price unit | 2019–2026 | yes |
| [EJDSK1](https://www.statbank.dk/EJDSK1) | Taxes on real property by region, type of tax | 2007–2025 | yes |
| [EJDSK2](https://www.statbank.dk/EJDSK2) | Taxes on real property by region, tax rate per thousand | 2007–2026 | yes |
| [EJDSK3](https://www.statbank.dk/EJDSK3) | Land tax by region, type of real estate | 2007–2025 | yes |
| [EJEN99](https://www.statbank.dk/EJEN99) | Key figures for housing cooperatives by region, valuation principle | 2015Q1–2026Q2 | yes |
| [ESKAT](https://www.statbank.dk/ESKAT) | Valuation and taxation of real property by region, tax base | 2006–2025 | yes |
| [NGLK](https://www.statbank.dk/NGLK) | Selected financial figures of municipalities by region, key figures, gross/net expenditures, price unit | 2008–2025 | yes |
| [PSKAT](https://www.statbank.dk/PSKAT) | Local government personal taxation by region, tax rate | 2007–2026 | yes |
| [PSKAT4](https://www.statbank.dk/PSKAT4) | End tax by region, income tax type | 2011–2024 | yes |
| [REGK100](https://www.statbank.dk/REGK100) | Municipal accounts by groupings without text by region, function, dranst, ownership, grouping, kind, price unit | 2007–2025 | yes |
| [REGK11](https://www.statbank.dk/REGK11) | Municipal accounts by main accounts by region, main account, dranst, kind, price unit | 2007–2025 | yes |
| [REGK31](https://www.statbank.dk/REGK31) | Municipal accounts by functions by region, function, dranst, kind, price unit | 2007–2025 | yes |
| [REGK4](https://www.statbank.dk/REGK4) | Municipal balances by region, function | 2007–2025 | yes |
| [REGKC](https://www.statbank.dk/REGKC) | Municipal accounts, groupings with text - by region, dranst function and grouping, ownership, kind, price unit | 2018–2025 | yes |
| [TVANG3](https://www.statbank.dk/TVANG3) | Announcements of forced sales of real property by region | 2012–2025 | yes |
| [HFUDD11](https://www.statbank.dk/HFUDD11) | Educational attainment (15-69 years) by region, ancestry, highest education completed, age, sex | 2008–2025 | yes |
| [HFUDD16](https://www.statbank.dk/HFUDD16) | Educational attainment (15-69 years) by region, highest education completed, socioeconomic status, industry, age, sex | 2008–2024 | yes |
| [HFUDD21](https://www.statbank.dk/HFUDD21) | Educational attainment (15-29 years) by region, ancestry, highest education completed, receiving education, age, sex | 2008–2025 | yes |
| [KVEU20](https://www.statbank.dk/KVEU20) | Participation in supplementary courses by field of education, region, age, sex, points in time, unit | 2005–2025 | yes |
| [KVOTIEN](https://www.statbank.dk/KVOTIEN) | Class quotients in primary schools by region, class, type of school | 2009–2025 | yes |
| [LABY19](https://www.statbank.dk/LABY19) | Educational attainment (15-69 years) (number) by municipality groups, highest education completed, age | 2008–2025 | yes |
| [LABY23](https://www.statbank.dk/LABY23) | Educational activity in basic school (number) by status, education, type of institution from basic school, municipality groups | 2007–2025 | yes |
| [LIGEUB1](https://www.statbank.dk/LIGEUB1) | Educational attainment (15-69 years) by region, ancestry, highest education completed, age, sex | 2005–2025 | yes |
| [LIGEUI1](https://www.statbank.dk/LIGEUI1) | Gender equality indicator of educational attainment (15-69 years) by highest education completed, indicator, age, region, ancestry | 2005–2025 | yes |
| [LIGEUI2](https://www.statbank.dk/LIGEUI2) | Gender equality indicator on participation in supplementary courses by field of education, indicator, age, region, unit, points in time | 2005–2025 | yes |
| [LIGEUI3](https://www.statbank.dk/LIGEUI3) | Gender equality indicator of educational activity by education, indicator, age, region | 2005–2025 | yes |
| [STATUSU6](https://www.statbank.dk/STATUSU6) | 18-25 year-olds by educational graduation statement, education, basic school location | 2008–2025 | yes |
| [STATUSV5](https://www.statbank.dk/STATUSV5) | 25-45 year-olds by educational graduation statement, education, basic school location | 2008–2025 | yes |
| [UDDAKT10](https://www.statbank.dk/UDDAKT10) | Educational activity by region, education, age, sex, status | 2005–2025 | yes |
| [UDDAKT11](https://www.statbank.dk/UDDAKT11) | Educational activity by location of educational institution, education, age, sex, status | 2005–2025 | yes |
| [UDDAKT20](https://www.statbank.dk/UDDAKT20) | Educational activity in basic school by education, age, ancestry, national origin, sex, type of institution from basic school, region, status | 2005–2025 | yes |
| [UDDALL10](https://www.statbank.dk/UDDALL10) | Educational activity by region, education, age, sex, status | 2005–2025 | yes |
| [VEU20](https://www.statbank.dk/VEU20) | Participation in supplementary courses by field of education, region, age, sex, points in time, unit | 2005–2025 | yes |
| [ARE207](https://www.statbank.dk/ARE207) | Area 1. January by region | 2007–2026 | yes |
| [AREALDK2](https://www.statbank.dk/AREALDK2) | Land by land cover, region, unit | 2011–2024 | yes |
| [ENEGEO](https://www.statbank.dk/ENEGEO) | Energy consumption of industry by municipality | 2012–2024 | yes |
| [LABY24](https://www.statbank.dk/LABY24) | Household waste by municipality groups, kind of treatment, waste category | 2013–2023 | yes |
| [LABY25](https://www.statbank.dk/LABY25) | Key figures for household waste by municipality groups, key figures | 2013–2023 | yes |
| [VANDIND](https://www.statbank.dk/VANDIND) | Water abstraction by region, water type, abstraction category | 1989–2024 | yes |
| [VANDUD](https://www.statbank.dk/VANDUD) | Discharge of water by region, discharge, farm type | 2010–2024 | yes |
| [AFSTA3](https://www.statbank.dk/AFSTA3) | Employed persons (end November) by area of workplace, socioeconomic status, sex, commuting distance | 2008–2024 | yes |
| [AFSTA4](https://www.statbank.dk/AFSTA4) | Average commuting distance (end November) by area of workplace, socioeconomic status, sex | 2008–2024 | yes |
| [AFSTB3](https://www.statbank.dk/AFSTB3) | Employed persons (end November) by region, socioeconomic status, sex, commuting distance | 2008–2024 | yes |
| [AFSTB4](https://www.statbank.dk/AFSTB4) | Average commuting distance (end November) by region, socioeconomic status, sex | 2008–2024 | yes |
| [AINDK1](https://www.statbank.dk/AINDK1) | A-income by region, unit, sex, type of income | 2012–2025 | yes |
| [AINDK2](https://www.statbank.dk/AINDK2) | A-income, total by region, unit, sex, age, income interval | 2012–2025 | yes |
| [AINDK3](https://www.statbank.dk/AINDK3) | Payout after deduction of tax etc by region, unit, sex, age, income interval | 2012–2025 | yes |
| [AMR1](https://www.statbank.dk/AMR1) | The population's attachment to the labour market (Full-time people) by region, socioeconomic status, sex, age | 2008–2024 | yes |
| [ATYP012](https://www.statbank.dk/ATYP012) | Employed persons by combination of jobs, municipality of residence, selected employed persons, sex | 2008–2024 | yes |
| [ATYP033](https://www.statbank.dk/ATYP033) | Employees by municipality of residence, hours of work, selected employees, sex | 2008–2024 | yes |
| [ATYP071](https://www.statbank.dk/ATYP071) | Salaried positions by weekly hours of work, municipality of residence, selected employees, sex | 2008–2024 | yes |
| [AUA01](https://www.statbank.dk/AUA01) | Insured persons by region, unemployment insurance fund, age, sex | 2000M04–2026M08 | yes |
| [AUF01](https://www.statbank.dk/AUF01) | Unemployed persons (provisional) by region, type of benefits, unemployment insurance fund, age, sex | 2017M07–2026M08 | yes |
| [AUF02](https://www.statbank.dk/AUF02) | Unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2007M01–2026M02 | yes |
| [AUL01](https://www.statbank.dk/AUL01) | Full-time unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2007–2025 | yes |
| [AULK01](https://www.statbank.dk/AULK01) | Full-time unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2007Q1–2026Q2 | yes |
| [AULK04](https://www.statbank.dk/AULK04) | Long-term unemployed persons by region, unit, age, sex | 2009M01–2026M05 | yes |
| [AULKP01](https://www.statbank.dk/AULKP01) | Full-time unemployed persons in per cent of the labour force by region, age, sex | 2007Q1–2026Q2 | yes |
| [AULP01](https://www.statbank.dk/AULP01) | Full-time unemployed persons in per cent of the labour force by region, age, sex | 2007–2025 | yes |
| [AUP01](https://www.statbank.dk/AUP01) | Unemployment in per cent of the labour force (provisional) by region, age, sex | 2017M07–2026M08 | yes |
| [AUP02](https://www.statbank.dk/AUP02) | Unemployed in per cent of the labour force by region, age, sex | 2007M01–2026M02 | yes |
| [AUP03](https://www.statbank.dk/AUP03) | Unemployed insured persons (provisional) by region, age, sex, unemployment insurance fund | 2017M07–2026M08 | yes |
| [AUS08](https://www.statbank.dk/AUS08) | unemployed persons (seasonally adjusted) by region, seasonal adjustment and actual figures | 2007M01–2026M08 | yes |
| [EJDFOE1](https://www.statbank.dk/EJDFOE1) | Real estate market value by valuation, municipality of residence, unit, type of real estate | 2004–2025 | yes |
| [EJERFOF1](https://www.statbank.dk/EJERFOF1) | Wealth in real estate and loans for families by type of components, municipality of residence, unit, family type | 2004–2025 | yes |
| [EJERFOF2](https://www.statbank.dk/EJERFOF2) | Wealth in real estate and loans for families by type of components, municipality of residence, unit, group of households | 2004–2025 | yes |
| [FLOW2](https://www.statbank.dk/FLOW2) | The population's shift in socio-economic status by municipality of residence, former socioeconomic status, new socioeconomic status, movement, sex, age | 2020–2024 | yes |
| [FORMUE12](https://www.statbank.dk/FORMUE12) | Wealth by type of wealth, unit, region, age, population | 2014–2024 | yes |
| [FRA027](https://www.statbank.dk/FRA027) | Absence in the municipality sector by region, sex, cause of absence, occupation, indicator of absence | 2013–2024 | yes |
| [IFOR12A](https://www.statbank.dk/IFOR12A) | Persons in risk of poverty families by municipality, income level | 2000–2024 | yes |
| [IFOR12P](https://www.statbank.dk/IFOR12P) | Persons in risk of poverty families by municipality, income level | 2000–2024 | yes |
| [IFOR22](https://www.statbank.dk/IFOR22) | Deciles, upper bounds on equivalised disposable income, by deciles bound, municipality | 1987–2024 | yes |
| [IFOR25](https://www.statbank.dk/IFOR25) | Deciles, upper bounds on equivalised disposable income, by deciles bound, municipality, price unit | 1987–2024 | yes |
| [IFOR32](https://www.statbank.dk/IFOR32) | Avg. equivalised disposable Income in decile groups, by decile average, municipality | 1987–2024 | yes |
| [IFOR35](https://www.statbank.dk/IFOR35) | Avg. equivalised disposable Income in decile groups, by decile average, municipality, price unit | 1987–2024 | yes |
| [IFOR41](https://www.statbank.dk/IFOR41) | Income distribution on equivalised disposable income by indicator, municipality | 1987–2024 | yes |
| [INDKF101](https://www.statbank.dk/INDKF101) | Income by region, unit, owner/ tenant of dwelling, type of income | 2000–2024 | yes |
| [INDKF104](https://www.statbank.dk/INDKF104) | Income by region, unit, socioeconomic status, type of income | 1993–2024 | yes |
| [INDKF107](https://www.statbank.dk/INDKF107) | Level of education of the family by region, unit, family type, level of education, type of income | 2000–2024 | yes |
| [INDKF111](https://www.statbank.dk/INDKF111) | Income for families by region, unit, family type, type of income | 1991–2025 | yes |
| [INDKF112](https://www.statbank.dk/INDKF112) | Income by region, unit, family type, number of children, type of income | 1993–2025 | yes |
| [INDKF11A](https://www.statbank.dk/INDKF11A) | Number of families by region, family type | 1987–2025 | yes |
| [INDKF122](https://www.statbank.dk/INDKF122) | Income by region, unit, family type, income interval | 1987–2025 | yes |
| [INDKF132](https://www.statbank.dk/INDKF132) | Disposable family income by region, unit, family type, income interval | 1987–2024 | yes |
| [INDKP101](https://www.statbank.dk/INDKP101) | People by region, unit, sex, type of income | 1987–2025 | yes |
| [INDKP105](https://www.statbank.dk/INDKP105) | Income, total by region, unit, sex, age, income interval | 1987–2025 | yes |
| [INDKP106](https://www.statbank.dk/INDKP106) | Disposable income by region, unit, sex, age, income interval | 1987–2024 | yes |
| [INDKP107](https://www.statbank.dk/INDKP107) | Income, persons by region, unit, sex, level of education, type of income | 2004–2024 | yes |
| [INDKP222](https://www.statbank.dk/INDKP222) | Personal income before tax for persons over 14 years by region, sex, age, income interval, price unit | 2000–2025 | yes |
| [KAS200](https://www.statbank.dk/KAS200) | Average activity and employment rates by region, ancestry, age, sex, frequency, period | 2017–2024 | yes |
| [KAS201](https://www.statbank.dk/KAS201) | Average population by region, socioeconomic status, ancestry, age, sex, period | 2017–2024 | yes |
| [KAS209](https://www.statbank.dk/KAS209) | Average population by region, education, socioeconomic status, age, sex, period | 2017–2024 | yes |
| [KAS210](https://www.statbank.dk/KAS210) | Average population 13-70 years by municipality of residence, socioeconomic status, age, sex, period | 2019–2024 | yes |
| [KAS301](https://www.statbank.dk/KAS301) | Average number of employed by region, industry (DB07), socioeconomic status, age, sex, period | 2008–2024 | yes |
| [KAS302](https://www.statbank.dk/KAS302) | Average number of employed by region, industry (DB07), socioeconomic status, age, sex, period | 2008–2024 | yes |
| [KAS305](https://www.statbank.dk/KAS305) | Average number of employees by area of workplace, sector, age, sex, period | 2008–2024 | yes |
| [KAS310](https://www.statbank.dk/KAS310) | Average number of employed by region, education, industry (DB07), age, sex, period | 2008–2024 | yes |
| [LABY06](https://www.statbank.dk/LABY06) | Average disposable income by municipality groups, age | 2004–2024 | yes |
| [LABY07](https://www.statbank.dk/LABY07) | Relative poverty (share of the population) by municipality groups, age | 2015–2024 | yes |
| [LABY10](https://www.statbank.dk/LABY10) | Share of youth (16-24 years) not in employment, education or training (NEET) by municipality groups, age | 2008–2024 | yes |
| [LABY11](https://www.statbank.dk/LABY11) | Median Net wealth (18 years old and above) by municipality groups, age standardisation | 2014–2024 | yes |
| [LABY12](https://www.statbank.dk/LABY12) | Net-wealth (median) by municipality groups, age | 2014–2024 | yes |
| [LABY13](https://www.statbank.dk/LABY13) | Persons with public transfers as main source of income by municipality groups, age | 2005–2025 | yes |
| [LABY14](https://www.statbank.dk/LABY14) | Negative net wealth (share of the population) by municipality groups, age | 2014–2024 | yes |
| [LABY15](https://www.statbank.dk/LABY15) | Pension wealth for people within 5 years of old-age retirement age (median) by municipality groups | 2014–2024 | yes |
| [LBESK354](https://www.statbank.dk/LBESK354) | Employees by unit, municipality of residence, sex | 2018Q1–2026Q2 | yes |
| [LBESK69](https://www.statbank.dk/LBESK69) | Employees by unit, municipality of residence, sex | 2008Q1–2025Q4 | yes |
| [LIGEAB2](https://www.statbank.dk/LIGEAB2) | Population (16-64 years) by region, socioeconomic status, family type, sex, age | 2008–2024 | yes |
| [LIGEAB4](https://www.statbank.dk/LIGEAB4) | Employed persons (16-64 years) by region, industry (DB07), category of insurance, sex, age | 2008–2024 | yes |
| [LIGEAI10](https://www.statbank.dk/LIGEAI10) | Gender equality indicator of long-term unemployed persons by indicator, age, region | 2009M01–2026M05 | yes |
| [LIGEAI2](https://www.statbank.dk/LIGEAI2) | Gender equality indicator of activity and employment rates (16-64 år) by frequency, indicator, family type, region, age | 2008–2024 | yes |
| [LIGEAI6](https://www.statbank.dk/LIGEAI6) | Gender equality indicator of NEET by indicator, region, age | 2008–2024 | yes |
| [LIGEAI9A](https://www.statbank.dk/LIGEAI9A) | Gender equality indicator of full-time unemployed persons by indicator, age, region | 2007M01–2026M02 | yes |
| [LIGELB1](https://www.statbank.dk/LIGELB1) | Level of earnings by work/residence, region, age, sex, family type | 2009–2025 | yes |
| [NEET3](https://www.statbank.dk/NEET3) | Population (16-29 years) by NEET status, sex, region, socioeconomic status, age | 2008–2024 | yes |
| [NEET4](https://www.statbank.dk/NEET4) | Population (16-29 years) by NEET status, region, sex, age | 2008–2024 | yes |
| [PEND100](https://www.statbank.dk/PEND100) | Employed (end November) by municipality of residence, area of workplace, sex | 2008–2024 | yes |
| [PEND101](https://www.statbank.dk/PEND101) | Employed (end November) by region, industry (DB07), commuting, sex | 2008–2024 | yes |
| [PENINDB1](https://www.statbank.dk/PENINDB1) | Persons with pension contributions by region, unit, sex, age, type of pension | 2005–2025 | yes |
| [RAS200](https://www.statbank.dk/RAS200) | Activity and employment rates (end November) by region, ancestry, age, sex, frequency | 2008–2024 | yes |
| [RAS201](https://www.statbank.dk/RAS201) | Population (end November) by region, socioeconomic status, ancestry, age, sex | 2008–2024 | yes |
| [RAS209](https://www.statbank.dk/RAS209) | Population (end November) by region, education, socioeconomic status, age, sex | 2008–2024 | yes |
| [RAS210](https://www.statbank.dk/RAS210) | Population 13-70 years (end November) by municipality of residence, socioeconomic status, age, sex | 2008–2024 | yes |
| [RAS301](https://www.statbank.dk/RAS301) | Employed (end November) by region, industry (DB07), socioeconomic status, age, sex | 2008–2024 | yes |
| [RAS302](https://www.statbank.dk/RAS302) | Employed (end November) by region, industry (DB07), socioeconomic status, age, sex | 2008–2024 | yes |
| [RAS305](https://www.statbank.dk/RAS305) | Employed salary earners (end November) by area of workplace, sector, extent of working time, age, sex | 2008–2024 | yes |
| [RAS310](https://www.statbank.dk/RAS310) | Employed (end November) by region, education, industry (DB07), age, sex | 2008–2024 | yes |
| [RAS400](https://www.statbank.dk/RAS400) | Labour force to calculating  unemployment (ultimo november) by region, age, sex | 2008–2024 | yes |
| [BEFOLK3](https://www.statbank.dk/BEFOLK3) | Population 1. January by region, sex, age | 2008–2026 | yes |
| [BEV107](https://www.statbank.dk/BEV107) | Summary vital statistics by region, type of movement, sex | 2006–2025 | yes |
| [BEV22](https://www.statbank.dk/BEV22) | Summary vital statistics (provisional data) by region, type of movement, sex | 2007Q2–2026Q2 | yes |
| [BOERN1](https://www.statbank.dk/BOERN1) | Fulltimeadjusted staff in municipal and self-governing day care, family day care by region, job title, education | 2015–2025 | yes |
| [BOERN10](https://www.statbank.dk/BOERN10) | Full-time equivalent children transferred to kindergarten before reaching the ag by municipality | 2023–2025 | yes |
| [BOERN11](https://www.statbank.dk/BOERN11) | Fulltimeadjusted staff employed through state funding by municipality, job title | 2023–2025 | yes |
| [BOERN2](https://www.statbank.dk/BOERN2) | Fulltimeadjusted clients in municipal and self-governing og family day care by region, category of child care | 2015–2025 | yes |
| [BOERN4](https://www.statbank.dk/BOERN4) | Institutions and units by region, type of care, type of ownership | 2017–2025 | yes |
| [BOERN5](https://www.statbank.dk/BOERN5) | Clients in leisure time facility by county, category of child care, type of ownership, age | 2015–2024 | yes |
| [BOERN61](https://www.statbank.dk/BOERN61) | Staff in school based leisure time facility by county, positions category | 2015–2024 | yes |
| [BOERN8](https://www.statbank.dk/BOERN8) | Ratios in municipal and self-governing day care and family day care by municipality, category of child care | 2023–2025 | yes |
| [BOL101](https://www.statbank.dk/BOL101) | Dwellings by region, type of resident, use, tenure, ownership, year of construction | 2010–2026 | yes |
| [BOL102](https://www.statbank.dk/BOL102) | Dwellings by county, type of resident, use, year of construction, heating, toiletfacilities, bathfacilities, kitchenfacilities | 2010–2026 | yes |
| [BOL103](https://www.statbank.dk/BOL103) | Dwellings by county, type of resident, use, number of rooms, size of dwelling in square metre, household size | 2010–2026 | yes |
| [BOL104](https://www.statbank.dk/BOL104) | Dwellings by county, type of resident, use, tenure, type of household, number of children | 2010–2026 | yes |
| [BOL105](https://www.statbank.dk/BOL105) | Dwellings by county, type of resident, use, heating, toiletfacilities, bathfacilities, type of household, number of children | 2010–2026 | yes |
| [BOL106](https://www.statbank.dk/BOL106) | Dwellings by region, unit, use | 2010–2026 | yes |
| [BOL201](https://www.statbank.dk/BOL201) | Occupants by county, use, tenure, ownership, year of construction, age, sex | 2010–2026 | yes |
| [BOL202](https://www.statbank.dk/BOL202) | Occupants by county, use, heating, toiletfacilities, bathfacilities, kitchenfacilities, age, sex | 2010–2026 | yes |
| [BOL203](https://www.statbank.dk/BOL203) | Occupants by county, use, tenure, number of rooms, household size, number of children, age, sex | 2010–2026 | yes |
| [BOL204](https://www.statbank.dk/BOL204) | Occupants by county, use, tenure, type of household, number of children, age, sex | 2010–2026 | yes |
| [BRN10](https://www.statbank.dk/BRN10) | Children and young persons who has lost their parents by region, age, mother status, father status, status of both parents | 2001–2026 | yes |
| [BRN11](https://www.statbank.dk/BRN11) | Children with change in family by region, change in family, familytype last year, familytype this year, age | 2008–2026 | yes |
| [BRN13](https://www.statbank.dk/BRN13) | Children by area, adults in the in-residence family, family type for the in- residence family, adults in the visiting family, family type for the visiting family, age | 2008–2026 | yes |
| [BRN15](https://www.statbank.dk/BRN15) | Children by region, age, family type, number of siblings, combination of siblings | 2008–2026 | yes |
| [BRN16](https://www.statbank.dk/BRN16) | Children by region, age, family type, number of siblings, combination of siblings | 2008–2026 | yes |
| [BRN9](https://www.statbank.dk/BRN9) | Children by region, age, family type, mother status, father status | 2007–2026 | yes |
| [BY2](https://www.statbank.dk/BY2) | Population 1. January by municipality, city size, age, sex | 2010–2026 | yes |
| [DAGTIL4](https://www.statbank.dk/DAGTIL4) | Recipients of subsidy to private day-care and day-care of own children by region, grant type, affected  | 2008–2025 | yes |
| [EB3](https://www.statbank.dk/EB3) | Children of descendants 1. January by Original ancestry, sex, age, country of origin, region | 2007–2026 | yes |
| [EB4](https://www.statbank.dk/EB4) | Population 1. January by ancestry, sex, age, country of origin, region | 2008–2026 | yes |
| [EVKOM1](https://www.statbank.dk/EVKOM1) | European Parliament Election by result of the election, region | 2009–2024 | yes |
| [EVPANDEL](https://www.statbank.dk/EVPANDEL) | The Parties share of votes (European Parliament Election) by result of the election, region | 2009–2024 | yes |
| [EVSTEM2](https://www.statbank.dk/EVSTEM2) | Persons aged 18 or more 1. January (European Parliament elections) by voting right, region | 2026 | yes |
| [FAKOM](https://www.statbank.dk/FAKOM) | Referendums by result of the election, region | 2014–2022 | yes |
| [FAM100N](https://www.statbank.dk/FAM100N) | Adults 1. January by region, family type, number of persons in the family, number of children in the family, sex, age | 1986–2026 | yes |
| [FAM111N](https://www.statbank.dk/FAM111N) | Children 1. January by region, family type, number of persons in the family, number of children in the family, sex, age | 1986–2026 | yes |
| [FAM122N](https://www.statbank.dk/FAM122N) | Adults 1. January by region, type of household, number of persons in the household , number of children in the household, sex, age | 1986–2026 | yes |
| [FAM133N](https://www.statbank.dk/FAM133N) | Children 1. January by region, type of household, number of persons in the household , number of children in the household, sex, age | 1986–2026 | yes |
| [FAM44BA](https://www.statbank.dk/FAM44BA) | Families with children 1 January by region, unit, family type, children from the age of, children to the age of | 1986–2026 | yes |
| [FAM44N](https://www.statbank.dk/FAM44N) | Families 1. January by region, family type, family size, number of children | 1986–2026 | yes |
| [FAM55N](https://www.statbank.dk/FAM55N) | Households 1. January by region, type of household, household size, number of children in the household | 1986–2026 | yes |
| [FLY33](https://www.statbank.dk/FLY33) | Internal migration within municipalities by region, age, sex | 2006–2025 | yes |
| [FLY66](https://www.statbank.dk/FLY66) | Internal migration between municipalities by in-migration municipality, out-migration municipality, age, sex | 2006–2025 | yes |
| [FLYUNG1](https://www.statbank.dk/FLYUNG1) | Migration among young people (15-29 years) by type of move, out-migration municipality, relocation site | 2007–2025 | yes |
| [FLYUNG2](https://www.statbank.dk/FLYUNG2) | Migration among young people (15-29 years) by type of move, in-migration municipality, relocation site | 2007–2025 | yes |
| [FOD111](https://www.statbank.dk/FOD111) | Average age of women giving birth and new fathers by region, age | 2006–2025 | yes |
| [FOD207](https://www.statbank.dk/FOD207) | Deaths by region, age, sex | 2006–2025 | yes |
| [FOD407](https://www.statbank.dk/FOD407) | Fertility rates by region, age | 2006–2025 | yes |
| [FODIE](https://www.statbank.dk/FODIE) | Live births by region, mothers ancestry, mothers country of origin, mothers citizenship, age of mother, sex of child | 2007–2025 | yes |
| [FOLK1A](https://www.statbank.dk/FOLK1A) | Population at the first day of the quarter by region, sex, age, marital status | 2008Q1–2026Q3 | yes |
| [FOLK1AM](https://www.statbank.dk/FOLK1AM) | Population at the first day of the month by region, sex, age | 2021M10–2026M09 | yes |
| [FOLK1B](https://www.statbank.dk/FOLK1B) | Population at the first day of the quarter by region, sex, age, citizenship | 2008Q1–2026Q3 | yes |
| [FOLK1C](https://www.statbank.dk/FOLK1C) | Population at the first day of the quarter by region, sex, age, ancestry, country of origin | 2008Q1–2026Q3 | yes |
| [FOLK1D](https://www.statbank.dk/FOLK1D) | Population at the first day of the quarter by region, sex, age, citizenship | 2008Q1–2026Q3 | yes |
| [FOLK1E](https://www.statbank.dk/FOLK1E) | Population at the first day of the quarter by region, sex, age, ancestry | 2008Q1–2026Q3 | yes |
| [FRKM126](https://www.statbank.dk/FRKM126) | Population projections 2026 by municipality, age, sex | 2026–2050 | yes |
| [FRKM226](https://www.statbank.dk/FRKM226) | Key figures 2026: Summary components of changes according to population projecti by municipality, type of movement | 2026–2050 | yes |
| [FVKOM](https://www.statbank.dk/FVKOM) | Election to the Danish Parliament by result of the election, region | 2007–2026 | yes |
| [FVPANDEL](https://www.statbank.dk/FVPANDEL) | The Parties share of votes to the Danish Parliament by result of the election, region | 2007–2026 | yes |
| [FVSTEM1](https://www.statbank.dk/FVSTEM1) | Voters in elections to the Danish Parliament by type of vote cast, region, age | 2026 | yes |
| [FVSTEM2](https://www.statbank.dk/FVSTEM2) | Persons aged 18 or more 1. January (elections to the Danish Parliament) by voting right, region | 2026 | yes |
| [GALDER](https://www.statbank.dk/GALDER) | Average age by municipality, sex | 2005–2026 | yes |
| [HISBK](https://www.statbank.dk/HISBK) | Life expectancy for new born babies by region, sex | 2000:2004–2021:2025 | yes |
| [HJEMSYG](https://www.statbank.dk/HJEMSYG) | Recipients of home nursing by region, age, sex | 2016–2025 | yes |
| [HJEMSYG2](https://www.statbank.dk/HJEMSYG2) | Provided home nursing by region, age, sex, days | 2016–2025 | yes |
| [INDOPH1](https://www.statbank.dk/INDOPH1) | Immigrants 1. January by first permit of residence, region | 2008–2026 | yes |
| [INDOPH3](https://www.statbank.dk/INDOPH3) | Immigrants 1. January by present permit of residence, region | 2008–2026 | yes |
| [KM6](https://www.statbank.dk/KM6) | Population 1. January by municipality, sex, age, member of the National Church | 2011–2026 | yes |
| [KVRES](https://www.statbank.dk/KVRES) | Elections to municipality councils by region, result of the election | 2005–2025 | yes |
| [KVSTEM1](https://www.statbank.dk/KVSTEM1) | Voters in elections to municipality councils by type of vote cast, region, age | 2025 | yes |
| [KVSTEM2](https://www.statbank.dk/KVSTEM2) | Persons aged 18 or more 1. January (elections to municipality councils) by voting right, region | 2026 | yes |
| [LABY01](https://www.statbank.dk/LABY01) | Population increase per 1,000 capita by municipality groups, type of movement | 2007–2025 | yes |
| [LABY04](https://www.statbank.dk/LABY04) | Families with/without children i percentage of all families in the same municipa by region, family type | 2007–2026 | yes |
| [LABY08](https://www.statbank.dk/LABY08) | Elections to municipality councils by municipality groups, result of the election | 2005–2025 | yes |
| [LABY09](https://www.statbank.dk/LABY09) | Election to the Danish Parliament by municipality groups, result of the election | 2007–2026 | yes |
| [LABY26](https://www.statbank.dk/LABY26) | Overweight among children by municipality groups, sex, age | 2012–2018 | yes |
| [LABY27](https://www.statbank.dk/LABY27) | People per general practitioner by municipality groups | 2015–2023 | yes |
| [LIGEDB2](https://www.statbank.dk/LIGEDB2) | Nominated and elected candidates to municipal councils by candidates, sex, age, municipality | 2005–2025 | yes |
| [LIGEDI2](https://www.statbank.dk/LIGEDI2) | Gender equality indicator of nominated and elected candidates to municipal counc by candidates, indicator, age, municipality | 2005–2025 | yes |
| [LIGEHB6](https://www.statbank.dk/LIGEHB6) | Consultations with the general practitioner by region, sex, age, family type | 2006–2025 | yes |
| [LIGEHI6](https://www.statbank.dk/LIGEHI6) | Gender equality indicator of consultation with the general  practitioner by indicator, region, age, family type | 2006–2025 | yes |
| [MEDI1](https://www.statbank.dk/MEDI1) | Purchases of prescription medicine by municipality, key figures, type of medicine, age | 2020–2025 | yes |
| [PAAROE01](https://www.statbank.dk/PAAROE01) | Average distance to grandparents of 0-24 years-olds 1. January by type of relation, residence of the main person, age of the main character | 2024 | yes |
| [PAAROE03](https://www.statbank.dk/PAAROE03) | Population 1. January by relationship, residence of the main person | 2020–2026 | yes |
| [PAAROE50](https://www.statbank.dk/PAAROE50) | Home care, recipients referral (share of 65-84 year-olds) by indicator, region, age, relationship | 2019–2024 | yes |
| [PAAROE51](https://www.statbank.dk/PAAROE51) | Home care, referral hours per person by indicator, region, age, relationship | 2019–2024 | yes |
| [PBOERN1](https://www.statbank.dk/PBOERN1) | Full-time adjusted pedagogical staff in private day care institutions by region, job title, education | 2021–2024 | yes |
| [PBOERN2](https://www.statbank.dk/PBOERN2) | Full-time adjusted children in private day care institutions by region, category of child care | 2021–2024 | yes |
| [RES88](https://www.statbank.dk/RES88) | Yearly rates of child-care by region, type of measure | 2007–2026 | yes |
| [SBR01](https://www.statbank.dk/SBR01) | Hospital utilisation in the population by municipality, hospital stays, age, sex | 2017–2025 | yes |
| [SKI125](https://www.statbank.dk/SKI125) | Divorces by place of residence of the male or the oldest person, Place of residence of the female or the youngest person, age of the male or the oldest person, age of the female or the youngest person, duration of marriage | 2007–2025 | yes |
| [SKI225](https://www.statbank.dk/SKI225) | Divorces by place of residence of the male or the oldest person, Place of residence of the female or the youngest person, month of the divorce | 2007–2025 | yes |
| [SUNDAF01](https://www.statbank.dk/SUNDAF01) | The populations distance to closest practitioner (experimental) by municipality, key figures, visits to physicians, sex, age | 2024 | yes |
| [SUNDAF02](https://www.statbank.dk/SUNDAF02) | The populations use of general practitioner (experimental statistic) by municipality, key figures, distance to closest general practitioner, sex, age | 2024 | yes |
| [SYGK1](https://www.statbank.dk/SYGK1) | Contacts covered by the public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGKS1](https://www.statbank.dk/SYGKS1) | Contacts covered by the public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGP1](https://www.statbank.dk/SYGP1) | Number of persons with contacts covered by public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGPS1](https://www.statbank.dk/SYGPS1) | Recievers og public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGSIK](https://www.statbank.dk/SYGSIK) | Population by region, health insurance group  | 2007–2025 | yes |
| [SYGU1](https://www.statbank.dk/SYGU1) | Public health insurance expenses by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGUS1](https://www.statbank.dk/SYGUS1) | Public health insurance expenses by region, type of benefits, age, sex | 2006–2025 | yes |
| [VALGK3](https://www.statbank.dk/VALGK3) | Elections to municipality councils by region, political party, votes cast/candidates/sex | 2005–2025 | yes |
| [VAN1AAR](https://www.statbank.dk/VAN1AAR) | Immigrations by region, sex, age, country of last residence, citizenship | 2007–2025 | yes |
| [VAN1KVT](https://www.statbank.dk/VAN1KVT) | Immigrations (provisional data) by region, sex, age, country of last residence, citizenship | 2007Q2–2026Q2 | yes |
| [VAN1UGE](https://www.statbank.dk/VAN1UGE) | Immigrations by region, sex, age, country of last residence, citizenship | 2021U52–2026U39 | yes |
| [VAN2AAR](https://www.statbank.dk/VAN2AAR) | Emigrations by region, sex, age, country of destination, citizenship | 2007–2025 | yes |
| [VAN2KVT](https://www.statbank.dk/VAN2KVT) | Emigrations (provisional data) by region, sex, age, country of destination, citizenship | 2007Q2–2026Q2 | yes |
| [VIE1KOM](https://www.statbank.dk/VIE1KOM) | Average age at first marriage by municipality of residence, sex | 2007–2025 | yes |
| [VIE225](https://www.statbank.dk/VIE225) | Marriages by place of residence of the male or the oldest person, Place of residence of the female or the youngest person, age of the male or the oldest person, age of the female or the youngest person, former marital status of the male or the oldest person, former marital status of the female or the youngest person | 2007–2025 | yes |
| [VIE325](https://www.statbank.dk/VIE325) | Marriages by place of residence of the male or the oldest person, Place of residence of the female or the youngest person, month of the marriage, type of marriage ceremony | 2007–2025 | yes |
| [AED01](https://www.statbank.dk/AED01) | Home care, provided hours by region, type of benefits, age, sex | 2011–2025 | yes |
| [AED012](https://www.statbank.dk/AED012) | Home care, recipients who use private contractors by region, type of benefits, age, sex | 2013–2025 | yes |
| [AED02](https://www.statbank.dk/AED02) | Home care, provided hours per person by region, type of benefits, age, sex | 2011–2025 | yes |
| [AED021](https://www.statbank.dk/AED021) | Home care, referral hours per person by region, type of benefits, age, sex | 2008–2025 | yes |
| [AED022](https://www.statbank.dk/AED022) | Home care, refarral hours by region, type of benefits, age, sex | 2008–2025 | yes |
| [AED023](https://www.statbank.dk/AED023) | Home care, recipients by region, type of benefits, hours per week, age, sex | 2011–2025 | yes |
| [AED06](https://www.statbank.dk/AED06) | Home care, recipents referral by region, type of benefits, hours per week, age, sex | 2008–2025 | yes |
| [AED08](https://www.statbank.dk/AED08) | Training and maintenance training, recipients by region, type of benefits, age, sex | 2008–2025 | yes |
| [AED10A](https://www.statbank.dk/AED10A) | Preventative home visits, recipients and visits by region, home visits, age, sex | 2016–2025 | yes |
| [AED12](https://www.statbank.dk/AED12) | Home care, recipients refarral who use private contractor by region, type of benefits, age, sex | 2008–2025 | yes |
| [AED14](https://www.statbank.dk/AED14) | Home care, recipients refarral who change between private and public contractor by region, type of benefits, age, sex | 2009–2025 | yes |
| [AED16](https://www.statbank.dk/AED16) | Free choice of dwelling and average waiting time for nursing homes by unit, region | 2009–2025 | yes |
| [AED21](https://www.statbank.dk/AED21) | Service indicators, per cent of the population aged 67 years and above by region, services | 2008–2025 | yes |
| [ANB5](https://www.statbank.dk/ANB5) | Children and young persons placed outside of own home per 30th of June by municipality, place of accommodation | 2011H1–2025H2 | yes |
| [ANB6](https://www.statbank.dk/ANB6) | Children and young persons placed outside of own home per 30th of June by municipality, measure | 2011H1–2025H2 | yes |
| [ANB7](https://www.statbank.dk/ANB7) | Children and young persons placed outside of own home per 30th of June by municipality, age | 2011H1–2025H2 | yes |
| [ANBIVS1](https://www.statbank.dk/ANBIVS1) | Initiated placement outside of own home of children and young persons by administrative municipality, age | 2011–2025 | yes |
| [ANBIVS2](https://www.statbank.dk/ANBIVS2) | Initiated placement outside of own home of children and young persons by administrative municipality, sex | 2011–2025 | yes |
| [AUH01](https://www.statbank.dk/AUH01) | Persons who are not in ordinary employment by region, type of benefits, sex, age | 2007–2025 | yes |
| [AUH03](https://www.statbank.dk/AUH03) | Persons receiving public benefits by region, type of benefits, sex, age | 2007–2025 | yes |
| [AUK01](https://www.statbank.dk/AUK01) | Persons receiving public benefits by region, type of benefits, sex, age | 2007Q1–2026Q2 | yes |
| [AUK03](https://www.statbank.dk/AUK03) | Persons receiving public benefits by region, type of benefits, sex, age | 2007Q1–2026Q2 | yes |
| [BARLOV1](https://www.statbank.dk/BARLOV1) | Cohabiting parents leave before birth and in the child´s first year of life by unit, entitlement, mothers education, fathers education, region | AUG - DEC 2019–AUG - DEC 2024 | yes |
| [BARLOV3](https://www.statbank.dk/BARLOV3) | Cohabiting parents on leave (children born August-December) by unit, entitlement, area, week | AUG - DEC 2019–AUG - DEC 2024 | yes |
| [BARSEL04](https://www.statbank.dk/BARSEL04) | Parents leave before birth and during the child's first year of life by unit, entitlement, mothers education, fathers education, region | 2015–2024 | yes |
| [BARSEL05](https://www.statbank.dk/BARSEL05) | Cohabiting parents leave before birth and in the child's first year of life by unit, entitlement, mothers education, fathers education, region | 2015–2024 | yes |
| [BARSEL24](https://www.statbank.dk/BARSEL24) | Parents leave in child's first two years (46 weeks of leave or more) by unit, entitlement, mothers education, fathers education, region | 2016–2023 | yes |
| [BARSEL25](https://www.statbank.dk/BARSEL25) | Cohabiting parents leave in child's first two years (46 weeks of leave or more) by unit, entitlement, mothers education, fathers education, region | 2016–2023 | yes |
| [BOST63](https://www.statbank.dk/BOST63) | Housing benefit by region, type of benefits, month, unit | 2007–2025 | yes |
| [BTS101](https://www.statbank.dk/BTS101) | Recipients of family benefits and child supplements by region, grant type, sex, number of children, unit | 2017Q1–2025Q4 | yes |
| [BU43](https://www.statbank.dk/BU43) | Children and young people who receive support per 31st December by region, Measure, age | 2015–2025 | yes |
| [HAND01](https://www.statbank.dk/HAND01) | Disability services by region, type of benefits | 2015Q1–2025Q4 | yes |
| [HAND05](https://www.statbank.dk/HAND05) | Disability services by region, type of benefits | 2015–2025 | yes |
| [HAND06](https://www.statbank.dk/HAND06) | Disability services (Number per 1,000 inhabitants) by region, type of benefits | 2015Q1–2025Q4 | yes |
| [HAND07](https://www.statbank.dk/HAND07) | Recipients of disability services by region, type of benefits | 2015Q1–2025Q4 | yes |
| [HANDBIL1](https://www.statbank.dk/HANDBIL1) | Benefit to disability car by region, unit | 2011–2025 | yes |
| [HANDBIL2](https://www.statbank.dk/HANDBIL2) | Refusal of benefit by region, unit | 2010–2025 | yes |
| [HANDBU01](https://www.statbank.dk/HANDBU01) | Disability measures for children between 0-17 years by municipality, measure, sex | 2022–2025 | yes |
| [HANDBU02](https://www.statbank.dk/HANDBU02) | Disability measures for children between 0-17 years by municipality, measure, age | 2022–2025 | yes |
| [HJALP1](https://www.statbank.dk/HJALP1) | Lending of assistive products from the municipalities' aid depots by municipality | 2023–2025 | yes |
| [HJALP2](https://www.statbank.dk/HJALP2) | Recipients of lending of assistive products from the municipalities' aid depots by municipality, sex, age | 2023–2025 | yes |
| [HJALP3](https://www.statbank.dk/HJALP3) | Recipients of lending of assistive products from the municipalities' aid depots by municipality, sex, age | 2023–2025 | yes |
| [ISBU01](https://www.statbank.dk/ISBU01) | Intervention and support to children and young people during the year by municipality, measure | 2015–2025 | yes |
| [ISBU02](https://www.statbank.dk/ISBU02) | Children and young people with intervention and supprt during the year by municipality, measure | 2015–2025 | yes |
| [KY044](https://www.statbank.dk/KY044) | Cash benefits (persons and amount) by unit, region | 2016–2025 | yes |
| [KY045](https://www.statbank.dk/KY045) | Cash benefits (full-time) by region, visitation | 2016–2025 | yes |
| [KY048](https://www.statbank.dk/KY048) | Cash benefits (full-time) by region, type of benefits, national origin, ancestry | 2016–2025 | yes |
| [KY051](https://www.statbank.dk/KY051) | Special benefits (persons and amount) by region, unit, type of benefits | 2007–2025 | yes |
| [KY24](https://www.statbank.dk/KY24) | Cash benefits (persons and amount) by region, unit, visitation | 2016M01–2026M06 | yes |
| [KY26](https://www.statbank.dk/KY26) | Cash benefits (persons and amount) by region, unit, type of benefits | 2016M01–2026M06 | yes |
| [LABY16](https://www.statbank.dk/LABY16) | Share of children between 0-18 years with notifications of concern by municipality groups | 2015–2025 | yes |
| [LABY20](https://www.statbank.dk/LABY20) | Home care and home care at nursing homes/nursing dwellings by municipality groups, services | 2022–2025 | yes |
| [PEN113](https://www.statbank.dk/PEN113) | Disability pensioner by region, sex, age, type of benefits, recipients | 2021M01–2026M06 | yes |
| [PEN114](https://www.statbank.dk/PEN114) | Recipients of national old-age pension by region, sex, age, type of benefits, recipients | 2021M01–2026M06 | yes |
| [REHAB19](https://www.statbank.dk/REHAB19) | Rehabilitation, recipients by region, age, sex | 2019–2025 | yes |
| [SIU001](https://www.statbank.dk/SIU001) | Municipal expenditure on social services by municipality, unit, measure, age | 2025 | yes |
| [SIU002](https://www.statbank.dk/SIU002) | Municipal expenditure on social services by municipality, unit, function group | 2025 | yes |
| [SMDBV001](https://www.statbank.dk/SMDBV001) | Drug abuse treatment by region, activity | 2015–2025 | yes |
| [SMDBV002](https://www.statbank.dk/SMDBV002) | Drug abuse treatment by region, key figures | 2015–2025 | yes |
| [SMDBV004](https://www.statbank.dk/SMDBV004) | Drug abuse treatment by region, guaranteed waiting time | 2015–2025 | yes |
| [SMDBV005](https://www.statbank.dk/SMDBV005) | Drug abuse treatment by region, status | 2015–2025 | yes |
| [STRAF11](https://www.statbank.dk/STRAF11) | Reported criminal offences by region, type of offence | 2007Q1–2026Q2 | yes |
| [STRAF22](https://www.statbank.dk/STRAF22) | Reported criminal offences and charges by region, type of offence, reported criminal offences and charges | 2007–2025 | yes |
| [STRAF44](https://www.statbank.dk/STRAF44) | Decisions, total by region, type of offence, type of decision, age, sex | 2007–2025 | yes |
| [STRAF46](https://www.statbank.dk/STRAF46) | Suspended sentence by region, sex, age, type of offence, type of decision, length of sentence | 2007–2025 | yes |
| [STRAF47](https://www.statbank.dk/STRAF47) | Unsuspended sentence by region, sex, age, type of offence, type of decision, length of sentence | 2007–2025 | yes |
| [STRAFNA6](https://www.statbank.dk/STRAFNA6) | Persons guilty in crimes by region, sex, age, national origin | 2005–2025 | yes |
| [STRAFNA7](https://www.statbank.dk/STRAFNA7) | Persons guilty in crimes by region, type of offence | 2005–2025 | yes |
| [STRAFNA8](https://www.statbank.dk/STRAFNA8) | Persons guilty in crimes by region, type of decision | 2005–2025 | yes |
| [SYGEDP01](https://www.statbank.dk/SYGEDP01) | Sickness benefits by municipality, sex, age, benefit recipient, unit | 2020–2024 | yes |
| [UND1](https://www.statbank.dk/UND1) | Notifications of concern for children by administrative municipality, reporter (who is notifying), age, sex | 2015–2025 | yes |
| [UND2](https://www.statbank.dk/UND2) | Children for whom a notification of concern has been received, classified by administrative municipality, notifications of concern, age, sex | 2015–2025 | yes |
| [UND3](https://www.statbank.dk/UND3) | Causes for notifications of concern for children by administrative municipality, cause, reporter (who is notifying), age, sex | 2015–2025 | yes |
| [VH33](https://www.statbank.dk/VH33) | Private contractors of home care by region | 2008–2025 | yes |
| [BIL53](https://www.statbank.dk/BIL53) | New registration of motor vehicles by region, type of vehicle, terms of use, propellant | 2018M01–2026M09 | yes |
| [BIL54](https://www.statbank.dk/BIL54) | Stock of motor vehicles by region, type of vehicle, terms of use, propellant | 2018M01–2026M09 | yes |
| [BIL600](https://www.statbank.dk/BIL600) | Families purchase of vehicles by region, patteren of purchase | 2006–2025 | yes |
| [BIL611](https://www.statbank.dk/BIL611) | Families purchase of vehicles by region, unit, patteren of purchase | 2006–2025 | yes |
| [BIL707](https://www.statbank.dk/BIL707) | Stock of vehicles as per 1 January by region, type of vehicle | 2007–2026 | yes |
| [BIL710](https://www.statbank.dk/BIL710) | Stock of passenger cars as per 1 January by region, ownership, propellant | 2018–2026 | yes |
| [BIL800](https://www.statbank.dk/BIL800) | Families disposal of vehicles by region, pattern of availability | 2007–2026 | yes |
| [BIL811](https://www.statbank.dk/BIL811) | Families disposal of vehicles by region, unit, pattern of availability | 2007–2026 | yes |
| [BIL907](https://www.statbank.dk/BIL907) | Stock of trailers as  per 1 January by region, ownership | 2007–2026 | yes |
| [UHELDK1](https://www.statbank.dk/UHELDK1) | Injured and killed in road traffic accidents by region, casualty, motor vehicles involved, age, sex | 1998–2025 | yes |
| [UHELDK7](https://www.statbank.dk/UHELDK7) | Road traffic accidents by type of accident, region, urban area, accident situation | 1998–2025 | yes |
| [BYGB11](https://www.statbank.dk/BYGB11) | Buildings by region, ownership, use, area in square metre (m2) | 2007–2014 | no |
| [BYGB33](https://www.statbank.dk/BYGB33) | Areas of the building stock by region, use, area, year of construction | 2007–2014 | no |
| [BYGB44](https://www.statbank.dk/BYGB44) | Areas of the building stock by region, type of heating, use, year of construction | 2011–2016 | no |
| [BYGB55](https://www.statbank.dk/BYGB55) | Areas of the building stock by region, roofing material, use, year of construction | 2011–2016 | no |
| [BYGB66](https://www.statbank.dk/BYGB66) | Areas of the building stock by region, outer wall material, use, year of construction | 2011–2016 | no |
| [DEMO9](https://www.statbank.dk/DEMO9) | Business Demography by municipality, unit | 2007–2021 | no |
| [GF02](https://www.statbank.dk/GF02) | General enterprise statistics by municipality, industry (DB07 10- 19- and 127 grouping and detailed), enterprise size (full time equivalents) | 2007–2021 | no |
| [LONKOMGA](https://www.statbank.dk/LONKOMGA) | Wage compensation to date from December 2020  (experimental statistics) by municipality of residence | 2021 | no |
| [LONKOMPF](https://www.statbank.dk/LONKOMPF) | Wage compensation (experimental statistics) by municipality, unit | 2020U25–2020U35 | no |
| [LONKOMPG](https://www.statbank.dk/LONKOMPG) | Wage compensation (experimental statistics) by municipality of residence, unit | 2020U25–2020U35 | no |
| [BIB1](https://www.statbank.dk/BIB1) | Public libraries key figures by region, key figures | 2009–2024 | no |
| [BIB3](https://www.statbank.dk/BIB3) | Public libraries physical materials by region, collection, inventory, material type | 2009–2024 | no |
| [BIB3B](https://www.statbank.dk/BIB3B) | Public libraries physical materials by region, collection, inventory, material type, age | 2010–2024 | no |
| [BIB4](https://www.statbank.dk/BIB4) | Public libraries stock and use of electronic resources by region, inventory, electronic material type, location | 2009–2013 | no |
| [BIB4C](https://www.statbank.dk/BIB4C) | Public libraries stock and use of electronic resources at external servers by region, inventory, electronic material type | 2014–2015 | no |
| [BIB4D](https://www.statbank.dk/BIB4D) | Public libraries stock and use of electronic resources at internal servers by region, inventory, electronic material type | 2014–2015 | no |
| [KUBS02](https://www.statbank.dk/KUBS02) | Payments by the Ministry of Culture targeted children and young people by region, cultural domains, targeted for children and young people, financing type | 2012–2018 | no |
| [KUBS02A](https://www.statbank.dk/KUBS02A) | Payments by the Ministry of Culture by region, cultural domains, financing type | 2010–2018 | no |
| [KUBS03](https://www.statbank.dk/KUBS03) | Payments by the Ministry of Culture by region, cultural domains, financing type | 2010–2018 | no |
| [KUBS04](https://www.statbank.dk/KUBS04) | Payments by the Ministry of Culture by region, cultural domains, financing type | 2012–2018 | no |
| [KUBS09](https://www.statbank.dk/KUBS09) | Payments by the Ministry of Culture targeted research by region, cultural domains, financing type | 2012–2018 | no |
| [KUBS10](https://www.statbank.dk/KUBS10) | Payments by the Ministry of Culture targeted education by region, cultural domains, financing type | 2012–2018 | no |
| [LIGEKB3](https://www.statbank.dk/LIGEKB3) | Pupils in music schools (0-24 years) by region, subject, sex | 2012:2013–2020:2021 | no |
| [LIGEKB3A](https://www.statbank.dk/LIGEKB3A) | Students at music schools by municipality, age, sex | 2021:2022 | no |
| [LIGEKI3](https://www.statbank.dk/LIGEKI3) | Gender equality indicator of pupils in music schools (0-24 years) by indicator, region, subject | 2012:2013–2020:2021 | no |
| [MUS2](https://www.statbank.dk/MUS2) | Activity at Danish museums (departments) by region, category of museum, type of museum, activity | 2009–2015 | no |
| [MUSKOL01](https://www.statbank.dk/MUSKOL01) | Music schools by region, key figures | 2012:2013–2020:2021 | no |
| [MUSKOL02](https://www.statbank.dk/MUSKOL02) | Pupils at music schools by region, status on music school pupil, subject, age, sex | 2012:2013–2020:2021 | no |
| [MUSKOL03](https://www.statbank.dk/MUSKOL03) | Maintaining music school students by region, subject, fortsættere | 2013:2014–2020:2021 | no |
| [MUSKOL04](https://www.statbank.dk/MUSKOL04) | Music school staff by region, category of staff, extent of working time | 2012:2013–2020:2021 | no |
| [MUSKOL05](https://www.statbank.dk/MUSKOL05) | Senior staff with teaching by region, category of person, employment rate, education time, education | 2012:2013–2020:2021 | no |
| [MUSKOL06](https://www.statbank.dk/MUSKOL06) | Music schools economy by region, economic key figures | 2012:2013–2020:2021 | no |
| [ZOO1](https://www.statbank.dk/ZOO1) | Zoos, Aquariums and Botanical Gardens by region, type of zoo, activity | 2009–2015 | no |
| [BUDK2](https://www.statbank.dk/BUDK2) | The financial part of the municipality budgets (DKK 1,000) by municipality, dranst, kind | 2007–2019 | no |
| [BUDK53](https://www.statbank.dk/BUDK53) | Kommunale driftsbudgetter (1.000 kr.) efter kommune, gruppering, art og tid | 2007–2019 | no |
| [REGK2](https://www.statbank.dk/REGK2) | The financial part of the municipality accounts (DKK 1,000) by region, dranst, kind | 2007–2018 | no |
| [REGK41](https://www.statbank.dk/REGK41) | Kommunernes åbningsbalance (1000 kr.) efter område, funktion og tid | 2007 | no |
| [REGK53](https://www.statbank.dk/REGK53) | Kommunernes driftsregnskab (1.000 kr.) efter område, gruppering, art og tid | 2007–2017 | no |
| [REGK54](https://www.statbank.dk/REGK54) | Forskydninger i anden kortfristet gæld til staten m.v. efter område, gruppering og tid | 2007–2017 | no |
| [HFUDD10](https://www.statbank.dk/HFUDD10) | Educational attainment (15-69 years) by region, ancestry, highest education completed, age, sex | 2006–2019 | no |
| [HFUDD15](https://www.statbank.dk/HFUDD15) | Educational attainment (15-69 years) by region, highest education completed, socioeconomic status, industry, age, sex | 2009–2018 | no |
| [HFUDD20](https://www.statbank.dk/HFUDD20) | Educational attainment (15-29 years) by region, ancestry, highest education completed, receiving education, age, sex | 2006–2019 | no |
| [KRHFU1](https://www.statbank.dk/KRHFU1) | Educational attainment (15-69 years) by region, ancestry, education, age, sex | 2006–2015 | no |
| [KRHFU2](https://www.statbank.dk/KRHFU2) | Attainment of the population by region, highest education completed, socioeconomic status, industry, age, sex | 2006–2014 | no |
| [KRHFU3](https://www.statbank.dk/KRHFU3) | 15-29 year-olds, education by region, ancestry, highest education completed, receiving education, age, sex | 2006–2015 | no |
| [LIGEUI4X](https://www.statbank.dk/LIGEUI4X) | Gender equality indicator on people with special needs education in basic school by indicator, class, region, ancestry | 2011–2015 | no |
| [U1107](https://www.statbank.dk/U1107) | Enrolled by municipality of residence, education, age, sex | 2005–2014 | no |
| [U1207](https://www.statbank.dk/U1207) | Enrolled by location of educational institution, education, age, sex | 2005–2014 | no |
| [U1907](https://www.statbank.dk/U1907) | Enrolled, basic school by education, age, ancestry, national origin, sex, type of institution, region | 2005–2014 | no |
| [U192](https://www.statbank.dk/U192) | Enrolled, basic school (provisional data) by location of educational institution, class, type of institution | 2008–2014 | no |
| [U194](https://www.statbank.dk/U194) | Enrolled, basic school by class, type of school, municipality of residence, special needs education | 2011–2014 | no |
| [U2107](https://www.statbank.dk/U2107) | Entrants by municipality of residence, education, age, sex | 2005–2014 | no |
| [U2207](https://www.statbank.dk/U2207) | Entrants by location of educational institution, education, age, sex | 2005–2014 | no |
| [U2907](https://www.statbank.dk/U2907) | Entrants, basic school by education, age, ancestry, national origin, sex, type of institution, region | 2005–2014 | no |
| [U3107](https://www.statbank.dk/U3107) | Graduates by municipality of residence, education, age, sex | 2005–2014 | no |
| [U3207](https://www.statbank.dk/U3207) | Graduates by location of educational institution, education, age, sex | 2005–2014 | no |
| [U3907](https://www.statbank.dk/U3907) | Graduates, basic school by education, age, ancestry, national origin, sex, type of institution, region | 2005–2014 | no |
| [UDDAKT22](https://www.statbank.dk/UDDAKT22) | Enrolled, basic school by class, type of school, region, special needs education, ancestry, sex | 2011–2015 | no |
| [VEU10](https://www.statbank.dk/VEU10) | Participation in supplementary courses by field of education, region, age, sex, highest education completed, points in time, unit | 2005–2017 | no |
| [VEU107](https://www.statbank.dk/VEU107) | Participation in supplementary courses, all courses by region, field of education, highest education completed, age, sex, ancestry, unit, points in time | 2006–2011 | no |
| [VEUGEO1](https://www.statbank.dk/VEUGEO1) | Participation in supplementary courses by field of education, region, age, sex, highest education completed, points in time, unit | 2007–2014 | no |
| [AREALDK](https://www.statbank.dk/AREALDK) | Land by land cover, region, unit | 2011–2021 | no |
| [TERM8](https://www.statbank.dk/TERM8) | Quality of air in cities by region, type of substance | 1990–2007 | no |
| [AAR07](https://www.statbank.dk/AAR07) | Unemlpoyed by region, sex | 2007 | no |
| [AARD07](https://www.statbank.dk/AARD07) | Unemlpoyed in per cent of the labour force by region, sex | 2007 | no |
| [AB112D07](https://www.statbank.dk/AB112D07) | Unemployed by region, age, sex | 2006M01–2007M12 | no |
| [AB11307](https://www.statbank.dk/AB11307) | Unemployed persons by region, category of insurance, unemployment insurance fund, age, sex | 2006M01–2007M12 | no |
| [AB113A07](https://www.statbank.dk/AB113A07) | Unemployed insured persons in per cent of the total num. of insur. by region, category of insurance, unemployment insurance fund, age, sex | 2006M01–2007M12 | no |
| [AB121D07](https://www.statbank.dk/AB121D07) | Unemployed in per cent of the labour force by region, age, sex | 2007Q1–2007Q4 | no |
| [AB12207](https://www.statbank.dk/AB12207) | Unemlpoyed persons by region, category of insurance, unemployment insurance fund, age, sex | 2007Q1–2007Q4 | no |
| [AB122A07](https://www.statbank.dk/AB122A07) | Unemployed insured persons in per cent of the total num. of insur. by region, category of insurance, unemployment insurance fund, age, sex | 2007Q1–2007Q4 | no |
| [AB32207](https://www.statbank.dk/AB32207) | Persons who have experienced unempl. for a short or long period by region, unemployment insurance fund, age, category of insurance, sex | 2007Q1–2007Q4 | no |
| [AB51307](https://www.statbank.dk/AB51307) | Insured persons by region, category of insurance, unemployment insurance fund, age, sex | 2006M01–2007M12 | no |
| [AB52207](https://www.statbank.dk/AB52207) | Insured persons by region, category of insurance, unemployment insurance fund, age, sex | 2007Q1–2007Q4 | no |
| [ABIE2](https://www.statbank.dk/ABIE2) | Unemployed by ancestry, country of origin, region | 1996Q1–2006Q4 | no |
| [ABIE2D](https://www.statbank.dk/ABIE2D) | Unemployed in per cent of the labour force by ancestry, country of origin, region | 1996Q1–2005Q4 | no |
| [AFSTA1](https://www.statbank.dk/AFSTA1) | Employed persons by area of workplace, sex, commuting distance | 2006–2013 | no |
| [AFSTA2](https://www.statbank.dk/AFSTA2) | Average commuting distance (end November) by area of workplace, sex | 2006–2013 | no |
| [AFSTB1](https://www.statbank.dk/AFSTB1) | Employed persons by region, sex, commuting distance | 2006–2013 | no |
| [AFSTB2](https://www.statbank.dk/AFSTB2) | Average commuting distance by region, sex | 2006–2013 | no |
| [AUF01R](https://www.statbank.dk/AUF01R) | Benefit-period. Unemployed persons (provisional) by region, type of benefits, unemployment insurance fund, age, sex | 2007M01–2017M06 | no |
| [AUF01X](https://www.statbank.dk/AUF01X) | Net unemployed persons (provisional) by region, type of benefits, unemployment insurance fund, age, sex | 2006M01–2010M11 | no |
| [AUF02R](https://www.statbank.dk/AUF02R) | Benefit-period. Unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2007M01–2016M12 | no |
| [AUF02X](https://www.statbank.dk/AUF02X) | Net unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2000M04–2010M05 | no |
| [AUL01X](https://www.statbank.dk/AUL01X) | Full-time unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2001–2009 | no |
| [AULK01X](https://www.statbank.dk/AULK01X) | Full-time net unemployed persons by region, type of benefits, unemployment insurance fund, age, sex | 2001Q1–2010Q3 | no |
| [AULK04R](https://www.statbank.dk/AULK04R) | Benefit-period. Long-term unemployed persons by region, unit, age, sex | 2009M02–2017M02 | no |
| [AULKP01X](https://www.statbank.dk/AULKP01X) | Full-time net unemployed persons in per cent of the labour force by region, age, sex | 2001Q1–2010Q3 | no |
| [AULP01X](https://www.statbank.dk/AULP01X) | Full-time unemployed persons in per cent of the labour force by region, age, sex | 2001–2009 | no |
| [AUP01R](https://www.statbank.dk/AUP01R) | Benefit-period. Unemployment in per cent of the labour force (provisional) by region, age, sex | 2007M01–2017M06 | no |
| [AUP01X](https://www.statbank.dk/AUP01X) | Net unemployment in per cent of the labour force by region, age, sex | 2006M01–2010M11 | no |
| [AUP02R](https://www.statbank.dk/AUP02R) | Benefit-period. Unemployed in per cent of the labour force by region, age, sex | 2007M01–2016M12 | no |
| [AUP02X](https://www.statbank.dk/AUP02X) | Net unemployed in per cent of the labour force by region, age, sex | 2000M04–2010M05 | no |
| [AUP03R](https://www.statbank.dk/AUP03R) | Benefit-period. Unemployed insured persons (provisional) by region, age, sex, unemployment insurance fund | 2007M01–2017M06 | no |
| [AUP03X](https://www.statbank.dk/AUP03X) | Net unemployed insured persons in per cent of the total number of insur. by region, age, sex, unemployment insurance fund | 2006M01–2010M11 | no |
| [AUS08R](https://www.statbank.dk/AUS08R) | Benefit-period. Unemployed persons (seasonally adjusted) by region, seasonal adjustment and actual figures | 2007M01–2017M06 | no |
| [FORM1](https://www.statbank.dk/FORM1) | Property by region, type of dwelling, type of wealth | 2005 | no |
| [FORM2](https://www.statbank.dk/FORM2) | Property by region, type of dwelling, age | 2005 | no |
| [FORMUE2](https://www.statbank.dk/FORMUE2) | Net wealth by region, type of components | 2014–2020 | no |
| [FRA04](https://www.statbank.dk/FRA04) | Absence by sector, sex, cause of absence, region, indicator of absence | 2003–2005 | no |
| [FRA12](https://www.statbank.dk/FRA12) | Absence in the municipality sector by region, sex, cause of absence, occupation, indicator of absence | 2010–2013 | no |
| [INDKF11](https://www.statbank.dk/INDKF11) | Income for families by region, unit, family type, type of income | 2000–2012 | no |
| [INDKF22](https://www.statbank.dk/INDKF22) | Income by region, unit, family type, income interval | 2000–2012 | no |
| [INDKF32](https://www.statbank.dk/INDKF32) | Disposable family income by region, unit, family type, income interval | 2000–2012 | no |
| [INDKF4](https://www.statbank.dk/INDKF4) | Income by region, unit, socioeconomic status, type of income | 2002–2012 | no |
| [INDKF6](https://www.statbank.dk/INDKF6) | Equivalence weighted  income, by region, unit, family type, income interval, type of income | 2000–2012 | no |
| [INDKF7](https://www.statbank.dk/INDKF7) | Level of education of the family by region, unit, family type, level of education, type of income | 2000–2012 | no |
| [INDKP5](https://www.statbank.dk/INDKP5) | Income, total by region, unit, sex, age, income interval | 2000–2012 | no |
| [INDKP5E](https://www.statbank.dk/INDKP5E) | Primary income by region, unit, sex, age, income interval | 2000–2012 | no |
| [INDKP6](https://www.statbank.dk/INDKP6) | Disposable income by region, unit, sex, age, income interval | 2000–2012 | no |
| [INDKP7](https://www.statbank.dk/INDKP7) | Level of education by region, unit, sex, level of education, type of income | 2000–2012 | no |
| [INDV1](https://www.statbank.dk/INDV1) | Full-time employees by region, unit, ancestry, age, sex, years in Denmark | 2002–2009 | no |
| [NEET1](https://www.statbank.dk/NEET1) | Population (16-24 years) by NEET status, sex, region, socioeconomic status | 2008–2023 | no |
| [NEET2](https://www.statbank.dk/NEET2) | Population (16-24 years) by NEET status, region, sex, age | 2008–2023 | no |
| [PENDAB11](https://www.statbank.dk/PENDAB11) | Employed by municipality of residence, area of workplace, sex | 2006–2011 | no |
| [PENDAB22](https://www.statbank.dk/PENDAB22) | Employed persons by region, industry (DB07), commuting, sex | 2008–2011 | no |
| [PENDABX](https://www.statbank.dk/PENDABX) | Employed persons by region, industry, commuting, sex | 2006–2008 | no |
| [PENS2](https://www.statbank.dk/PENS2) | Value of pension schemes by families by value of pension schemes, type of payment, life insurance companies, unit, region | 2014 | no |
| [RAS1F1](https://www.statbank.dk/RAS1F1) | Activity and employment rates by region, ancestry, age, sex, frequency | 2006–2011 | no |
| [RAS203](https://www.statbank.dk/RAS203) | Population (end November) by region, education, socioeconomic status, age, sex | 2008–2014 | no |
| [RAS207](https://www.statbank.dk/RAS207) | Population by region, socioeconomic status, ancestry, age, sex | 2006–2011 | no |
| [RAS303](https://www.statbank.dk/RAS303) | Employed (end November) by region, education, industry (DB07), age, sex | 2008–2014 | no |
| [RAS304](https://www.statbank.dk/RAS304) | Employed salary earners by area of workplace, sector, extent of working time, age, sex | 2008–2012 | no |
| [RAS3307](https://www.statbank.dk/RAS3307) | Labour force to calculating unemployment rates aged 16-66 by region, age, sex | 2006–2010 | no |
| [RASA1](https://www.statbank.dk/RASA1) | Employed (work place) by region, industry (DB07), socioeconomic status, ancestry, age, sex | 2006–2011 | no |
| [RASA1X](https://www.statbank.dk/RASA1X) | Employed by region, industry, socioeconomic status, ancestry, age, sex | 2006–2008 | no |
| [RASB1](https://www.statbank.dk/RASB1) | Employed (residens) by region, industry (DB07), socioeconomic status, ancestry, age, sex | 2006–2011 | no |
| [RASB1X](https://www.statbank.dk/RASB1X) | Employed by region, industry, socioeconomic status, ancestry, age, sex | 2006–2008 | no |
| [RASIE2](https://www.statbank.dk/RASIE2) | Labour force, age group 16-66 years by ancestry, country of origin, region | 1996–2005 | no |
| [RASOFF11](https://www.statbank.dk/RASOFF11) | Employed salary earners by area of workplace, sector, extent of working time, age, sex | 2006–2011 | no |
| [RASU11](https://www.statbank.dk/RASU11) | Population by region, education, socioeconomic status, age, sex | 2007–2011 | no |
| [RASU22](https://www.statbank.dk/RASU22) | Employed (residens) by region, education, industry (DB07), age, sex | 2008–2011 | no |
| [RASU22X](https://www.statbank.dk/RASU22X) | Employed by region, education, industry (27-grouping), age, sex | 2006–2008 | no |
| [RU121D07](https://www.statbank.dk/RU121D07) | Unemployde persons in per cent og the labour force by region, age, sex | 2007Q1–2007Q4 | no |
| [RU12207](https://www.statbank.dk/RU12207) | Unemployed persons by region, category of insurance, unemployment insurance fund, age, sex | 2007Q1–2007Q4 | no |
| [RU122A07](https://www.statbank.dk/RU122A07) | Unemployed insured persons in per cent of the total num. of insur. by region, category of insurance, unemployment insurance fund, age, sex | 2007Q1–2007Q4 | no |
| [RU32207](https://www.statbank.dk/RU32207) | Persons who have experienced unemployment for a short or long period by region, degree of unemployment, unemployment insurance fund, category of insurance, age, sex | 2007Q1–2007Q4 | no |
| [AED19](https://www.statbank.dk/AED19) | Discharges and length of stay (days) for persons aged 67, by region, unit, diagnosis | 2007–2018 | no |
| [AED19A](https://www.statbank.dk/AED19A) | Length of stay (days) for persons aged 67 and over by region, unit, diagnosis | 2014–2023 | no |
| [AED20](https://www.statbank.dk/AED20) | Clinical pathways and readmissions for persons aged 67, by region, unit, diagnosis | 2007–2016 | no |
| [AED20A](https://www.statbank.dk/AED20A) | Clinical pathways and readmissions for persons aged 67 and over by region, unit, diagnosis | 2012–2023 | no |
| [AMB03](https://www.statbank.dk/AMB03) | Out-patient treatments and out-patients by region, key figures, age, sex | 2006–2018 | no |
| [AMBP01](https://www.statbank.dk/AMBP01) | Out-patients by region, dominant diagnosis, age, sex | 2006–2018 | no |
| [AMBP02](https://www.statbank.dk/AMBP02) | Out-patients by region, diagnosis, age, sex | 2006–2018 | no |
| [BEF1A07](https://www.statbank.dk/BEF1A07) | Population 1. January by region, sex, marital status, age | 2005–2009 | no |
| [BEF607](https://www.statbank.dk/BEF607) | Midyear population (population 1. July) by region, sex, marital status, age | 2007–2008 | no |
| [BEF707](https://www.statbank.dk/BEF707) | Population 1. July by region, sex, marital status, age, citizenship | 2007–2008 | no |
| [BOERN3](https://www.statbank.dk/BOERN3) | Ratios in municipal and self-governing day care and family day care by region, category of child care | 2015–2022 | no |
| [BOERN6](https://www.statbank.dk/BOERN6) | Staff in school based leisure time facility by county, positions category | 2015–2020 | no |
| [BOERN9](https://www.statbank.dk/BOERN9) | Fulltimeadjusted staff employed through state funding by municipality | 2023 | no |
| [BOL11](https://www.statbank.dk/BOL11) | Occupied dwellings by region, type of dwelling, tenure, heating, number of rooms | 2007–2010 | no |
| [BOL22](https://www.statbank.dk/BOL22) | Occupied dwellings by region, type of dwelling, year of construction, installations | 2007–2010 | no |
| [BOL33](https://www.statbank.dk/BOL33) | Dwellings by region, type of dwelling, ownership, year of construction | 2007–2010 | no |
| [BOL44](https://www.statbank.dk/BOL44) | Households by region, type of dwelling, tenure, type of household, number of children | 2007–2010 | no |
| [BOL511](https://www.statbank.dk/BOL511) | Households by region, type of dwelling, size of dwelling in square metre, household size | 2007–2010 | no |
| [BOL522](https://www.statbank.dk/BOL522) | Households by region, type of dwelling, number of rooms, household size | 2007–2010 | no |
| [BOL66](https://www.statbank.dk/BOL66) | Occupants by region, type of dwelling, tenure, age, sex | 2007–2010 | no |
| [EVKOM](https://www.statbank.dk/EVKOM) | European Parliament Election by result of the election, region | 2009–2019 | no |
| [FAMFLYT5](https://www.statbank.dk/FAMFLYT5) | Inflow of residents by receiving municipality by in-migration municipality, type of move, type of family that has moved in, age of the youngest family member who has moved, age of the oldest family member who has moved | 2017–2021 | no |
| [FAMFLYT6](https://www.statbank.dk/FAMFLYT6) | Outward migration by municipality by out-migration municipality, type of move, type of family that has left, age of the youngest family member who has moved, age of the oldest family member who has moved | 2017–2021 | no |
| [FLY70](https://www.statbank.dk/FLY70) | Movements from and to the largest city, other cities or rural district by vacating area, relocation to area, type of move, age | 2021 | no |
| [FLYBOL](https://www.statbank.dk/FLYBOL) | Left empty dwellings by region, rooms, use, residence time before moving | 2010–2021 | no |
| [FOD107](https://www.statbank.dk/FOD107) | Live births by region, age of mother, sex | 2006–2008 | no |
| [FRKM113](https://www.statbank.dk/FRKM113) | Population projections by region, age, sex | 2013–2040 | no |
| [FRKM114](https://www.statbank.dk/FRKM114) | Population projections by region, age, sex | 2014–2040 | no |
| [FRKM115](https://www.statbank.dk/FRKM115) | Population projections 2015 by region, age, sex | 2015–2040 | no |
| [FRKM116](https://www.statbank.dk/FRKM116) | Population projections 2016 by region, age, sex | 2016–2045 | no |
| [FRKM117](https://www.statbank.dk/FRKM117) | Population projections 2017 by region, age, sex | 2017–2045 | no |
| [FRKM118](https://www.statbank.dk/FRKM118) | Population projections 2018 by region, age, sex | 2018–2045 | no |
| [FRKM119](https://www.statbank.dk/FRKM119) | Population projections 2019 by region, age, sex | 2019–2045 | no |
| [FRKM120](https://www.statbank.dk/FRKM120) | Population projections 2020 by region, age, sex | 2020–2045 | no |
| [FRKM121](https://www.statbank.dk/FRKM121) | Population projections 2021 by region, age, sex | 2021–2045 | no |
| [FRKM122](https://www.statbank.dk/FRKM122) | Population projections 2022 by region, age, sex | 2022–2045 | no |
| [FRKM123](https://www.statbank.dk/FRKM123) | Population projections 2023 by region, age, sex | 2023–2050 | no |
| [FRKM124](https://www.statbank.dk/FRKM124) | Population projections 2024 by municipality, age, sex | 2024–2050 | no |
| [FRKM125](https://www.statbank.dk/FRKM125) | Population projections 2025 by municipality, age, sex | 2025–2050 | no |
| [FRKM213](https://www.statbank.dk/FRKM213) | Key-figures, municipality by region, type of movement | 2013–2040 | no |
| [FRKM214](https://www.statbank.dk/FRKM214) | Key-figures, municipality by region, type of movement | 2014–2040 | no |
| [FRKM215](https://www.statbank.dk/FRKM215) | Nøgletal 2015: Fremskrivning af befolkningens bevægelser by region, type of movement | 2015–2040 | no |
| [FRKM216](https://www.statbank.dk/FRKM216) | Nøgletal 2016: Fremskrivning af befolkningens bevægelser by region, type of movement | 2016–2045 | no |
| [FRKM217](https://www.statbank.dk/FRKM217) | Nøgletal 2017: Fremskrivning af befolkningens bevægelser by region, type of movement | 2017–2045 | no |
| [FRKM218](https://www.statbank.dk/FRKM218) | Nøgletal 2018: Fremskrivning af befolkningens bevægelser by region, type of movement | 2018–2045 | no |
| [FRKM219](https://www.statbank.dk/FRKM219) | Nøgletal 2019: Fremskrivning af befolkningens bevægelser by region, type of movement | 2019–2045 | no |
| [FRKM220](https://www.statbank.dk/FRKM220) | Nøgletal 2020: Fremskrivning af befolkningens bevægelser by region, type of movement | 2020–2045 | no |
| [FRKM221](https://www.statbank.dk/FRKM221) | Nøgletal 2021: Fremskrivning af befolkningens bevægelser by region, type of movement | 2021–2045 | no |
| [FRKM222](https://www.statbank.dk/FRKM222) | Nøgletal 2022: Fremskrivning af befolkningens bevægelser by region, type of movement | 2022–2045 | no |
| [FRKM223](https://www.statbank.dk/FRKM223) | Key figures 2023: Summary components of changes according to population projecti by region, type of movement | 2023–2050 | no |
| [FRKM224](https://www.statbank.dk/FRKM224) | Key figures 2024: Summary components of changes according to population projecti by municipality, type of movement | 2024–2050 | no |
| [FRKM225](https://www.statbank.dk/FRKM225) | Key figures 2025: Summary components of changes according to population projecti by municipality, type of movement | 2025–2050 | no |
| [FROK2](https://www.statbank.dk/FROK2) | Lunch schemes in day care facilities by region, type of ownership, age groups, lunch programme, unit | 2018 | no |
| [FROK3](https://www.statbank.dk/FROK3) | Content of lunch schemes in day care facilities by region, type of ownership, age groups, lunch programme | 2018 | no |
| [HJSP01](https://www.statbank.dk/HJSP01) | Recipient of home nursing by region, age groups | 2011M01–2016M12 | no |
| [HJSP02](https://www.statbank.dk/HJSP02) | Home nursing by unit, region, age groups | 2014M01–2016M12 | no |
| [HJSP03](https://www.statbank.dk/HJSP03) | Visits (types) from home nurse by region, type of benefits | 2014M01–2016M12 | no |
| [IND03](https://www.statbank.dk/IND03) | Admissions, bed-days and hospital patients by region, key figures, age, sex | 2006–2018 | no |
| [INDAMP01](https://www.statbank.dk/INDAMP01) | Population by region, group of persons, key figures, age, sex | 2006–2018 | no |
| [INDAMP02](https://www.statbank.dk/INDAMP02) | Population by region, group of diagnosis, key figures, age, sex | 2006–2018 | no |
| [INDP01](https://www.statbank.dk/INDP01) | Hospital patients by region, dominant diagnosis, age, sex | 2006–2018 | no |
| [INDP02](https://www.statbank.dk/INDP02) | Hospital patients by region, diagnosis, age, sex | 2006–2018 | no |
| [KRBEF2A](https://www.statbank.dk/KRBEF2A) | Population 1. January by region, sex, marital status, age, citizenship | 2006–2009 | no |
| [KRBEF3](https://www.statbank.dk/KRBEF3) | Population 1. January by region, age, sex, ancestry, citizenship, country of origin | 2006–2009 | no |
| [LIGEHB7](https://www.statbank.dk/LIGEHB7) | Admissions, outpatient treatments and emergency department visits by type, region, sex, age, family type, diagnosis | 2006–2018 | no |
| [LIGEHI7](https://www.statbank.dk/LIGEHI7) | Gender equality indicator of admissions, outpatient treatm. and e.d. visits by indicator, type, region, age, family type, diagnosis | 2006–2018 | no |
| [MEDI1B](https://www.statbank.dk/MEDI1B) | Sale of prescription drugs (experimental statistics) by region, type of medicine, key figures, sex, age groups | 2016–2021 | no |
| [PAS11](https://www.statbank.dk/PAS11) | Clients in child care by region, Measure, ownership, age | 2007–2014 | no |
| [PAS22](https://www.statbank.dk/PAS22) | Child care by region, type of care, type of ownership, kind | 2007–2014 | no |
| [PAS33](https://www.statbank.dk/PAS33) | Personnel by region, type of care, groups of staff | 2007–2014 | no |
| [RESTAND](https://www.statbank.dk/RESTAND) | Municipal dental care by region, dental care sheme, recipients | 2015–2022 | no |
| [SGSU00](https://www.statbank.dk/SGSU00) | Vulnerable children and young persons (0-22 year) by region, target/control group, sex, age | 2015–2017 | no |
| [SKAD03](https://www.statbank.dk/SKAD03) | Emergency department visits and emergency patients by region, key figures, age, sex | 2006–2018 | no |
| [SKADP01](https://www.statbank.dk/SKADP01) | Emergency department patients by region, dominant contact reason, age, sex | 2006–2018 | no |
| [SKADP02](https://www.statbank.dk/SKADP02) | Emergency department patients by region, reason for contact, age, sex | 2006–2018 | no |
| [SMIT4](https://www.statbank.dk/SMIT4) | Confirmed cases of COVID-19 per day (eksperimentel statistik) by key figures, municipality | 2020M04D20–2021M06D29 | no |
| [SUIK11](https://www.statbank.dk/SUIK11) | Prevention and health promotion, costs and effects, by indicator, region | 2008–2012 | no |
| [SUIK12](https://www.statbank.dk/SUIK12) | The chronically sick by disease, region | 2010 | no |
| [SUIK13](https://www.statbank.dk/SUIK13) | Prevention and health promotion offers and activities by region, action area, target group | 2010 | no |
| [SUIK21](https://www.statbank.dk/SUIK21) | Rehabilitatiton and maintenance training, costs and effects, by indicator, region | 2008–2012 | no |
| [SUIK31](https://www.statbank.dk/SUIK31) | Net running costs of home nursing by region | 2008–2012 | no |
| [SUIK32](https://www.statbank.dk/SUIK32) | Recipients of visits by district nurses by age groups, region | 2011–2013 | no |
| [SUIK33](https://www.statbank.dk/SUIK33) | Visits by district nurses by type of benefits, region | 2011–2013 | no |
| [SUIK34](https://www.statbank.dk/SUIK34) | Preventive hospitalization of recipients of visits by district nurses by cause, region | 2011 | no |
| [SUIK41](https://www.statbank.dk/SUIK41) | Abuse of alcohol, costs and effects, by indicator, kind of treatment, region | 2008–2010 | no |
| [SUIK42](https://www.statbank.dk/SUIK42) | Termination of treatment for alcoholism by cause, kind of treatment, region | 2008–2010 | no |
| [SUIK51](https://www.statbank.dk/SUIK51) | Drug abuse, costs and effects, by indicator, kind of treatment, region | 2008–2010 | no |
| [SUIK52](https://www.statbank.dk/SUIK52) | Termination of treatment for drug abuse by cause, kind of treatment, region | 2008–2010 | no |
| [SUIK61](https://www.statbank.dk/SUIK61) | Child healthcare, costs and effects, by indicator, region | 2008–2012 | no |
| [UNGFLYT](https://www.statbank.dk/UNGFLYT) | Young people moving by municipality, family type, sex, age, type of move | 2009–2021 | no |
| [VAN211](https://www.statbank.dk/VAN211) | Immigrations by region, country of last residence, citizenship, age, sex | 2006 | no |
| [VAN222](https://www.statbank.dk/VAN222) | Emigrations by region, country of destination, citizenship, age, sex | 2006 | no |
| [AED03](https://www.statbank.dk/AED03) | Home care, nursing homes/nursing dwellings (referral hours per week) by region, type of benefits, age, sex | 2008–2010 | no |
| [AED04](https://www.statbank.dk/AED04) | Referral home care, nursing homes/nursing dwellings ( average per recipients) by region, type of benefits, age, sex | 2008–2010 | no |
| [AED05](https://www.statbank.dk/AED05) | Recipients referral to home care, nursing homes/nursing dwellings) by region, type of benefits, hours per week, age, sex | 2008–2010 | no |
| [AED07](https://www.statbank.dk/AED07) | Home care at nursing homes/nursing dwellings, recipents referral by region, age, sex | 2008–2025 | no |
| [AED10](https://www.statbank.dk/AED10) | Recipients of preventative home visits by region, home visits, age, sex | 2008–2015 | no |
| [AED13](https://www.statbank.dk/AED13) | Home care, first-time referred recipients who use private contractor by region, type of benefits, age, sex | 2010–2022 | no |
| [AED17](https://www.statbank.dk/AED17) | Home visits implemented as planned by region | 2012–2019 | no |
| [AED18](https://www.statbank.dk/AED18) | Ratio of Direct Contact in elderly care by region | 2007–2009 | no |
| [ANB1](https://www.statbank.dk/ANB1) | Children and young persons placed outside of own home by region, place of accommodation | 2011Q1–2017Q1 | no |
| [ANB3](https://www.statbank.dk/ANB3) | Children and young persons placed outside of own home by region, measure | 2011Q1–2017Q1 | no |
| [ANBAAR12](https://www.statbank.dk/ANBAAR12) | Children and young persons placed outside of own home per 31st december by administrative municipality, place of accommodation | 2011–2024 | no |
| [ANBAAR13](https://www.statbank.dk/ANBAAR13) | Children and young persons placed outside of own home per 31st december by administrative municipality, measure | 2011–2024 | no |
| [ANBAAR14](https://www.statbank.dk/ANBAAR14) | Initiated placement outside of own home of children and young persons by administrative municipality, age | 2011–2024 | no |
| [ANBAAR3](https://www.statbank.dk/ANBAAR3) | Children and young persons placed outside of own home per 31st december by administrative municipality, place of accommodation, measure, age, sex | 2011–2017 | no |
| [ANBAAR4](https://www.statbank.dk/ANBAAR4) | Initiated placement outside of own home of children and young persons by administrative municipality, place of accommodation, age, sex | 2011–2017 | no |
| [ANBAAR9](https://www.statbank.dk/ANBAAR9) | Children and young persons placed outside of own home per 31st december by administrative municipality, age | 2011–2024 | no |
| [BIDRAG11](https://www.statbank.dk/BIDRAG11) | Advance payments of child maintenance by region and age by region, age | 2006–2010 | no |
| [BIDRAG22](https://www.statbank.dk/BIDRAG22) | Advance payments of child maintenance, by region, benefits | 2006–2010 | no |
| [BIS55](https://www.statbank.dk/BIS55) | Families with certain preventive measures by region, measure | 2007–2011 | no |
| [BIS66](https://www.statbank.dk/BIS66) | Children and young persons 31st December by region, age, total duration of placement | 2006–2009 | no |
| [BIS99](https://www.statbank.dk/BIS99) | Children and young persons placed outside of own home 31st December by region, Measure | 2006–2009 | no |
| [BOST11](https://www.statbank.dk/BOST11) | Households (excl. disability pensioners) with rent subsidy in December by region, type of housing subsidy | 2007–2018 | no |
| [BOST22](https://www.statbank.dk/BOST22) | Rent subsidy paid to non-pensioners in December by region, type of housing subsidy | 2007–2018 | no |
| [BOST33](https://www.statbank.dk/BOST33) | Households with rent subsidy for pensioners in December by region, type of housing allowance | 2007–2018 | no |
| [BOST44](https://www.statbank.dk/BOST44) | Rent subsidy for pensioners (1,000 DKK) in December by region, type of housing allowance | 2007–2018 | no |
| [BTS44](https://www.statbank.dk/BTS44) | Families with child subsidy and family allowance in the 4th quarter of the year by region, grant type | 2007–2017 | no |
| [BTS55](https://www.statbank.dk/BTS55) | Children with child subsidy and family allowance in the 4th quarter of the year by region, grant type | 2007–2017 | no |
| [BTS66](https://www.statbank.dk/BTS66) | Paid amounts for child subsidy (1,000 DKK) in the 4th quarter of the year by region, grant type | 2007–2016 | no |
| [BU01](https://www.statbank.dk/BU01) | Children and young persons with preventive measures per 31st December by region, measure, age, sex | 2006–2013 | no |
| [BU01A](https://www.statbank.dk/BU01A) | Children and young persons with preventive measures per 31st December by region, measure, age, sex | 2011–2017 | no |
| [BU02A](https://www.statbank.dk/BU02A) | Children and young persons placed outside of own home (31st December) by region, place of accommodation | 2006–2015 | no |
| [BU03A](https://www.statbank.dk/BU03A) | Children and young persons placed outside of own home per 31st December by region, measure | 2006–2015 | no |
| [BU23](https://www.statbank.dk/BU23) | Level of education at current or former exposed children and young people by region, level of education, target/control group | 2009–2013 | no |
| [BU23A](https://www.statbank.dk/BU23A) | Level of education at current or former exposed children and young people by region, level of education, measure | 2010–2015 | no |
| [BU26](https://www.statbank.dk/BU26) | Education on age-appropriate grade levels by region, class, educational graduation statement, target/control group | 2009–2013 | no |
| [BU26A](https://www.statbank.dk/BU26A) | Education on age-appropriate grade levels by region, class, educational graduation statement, measure | 2010–2015 | no |
| [BU29](https://www.statbank.dk/BU29) | Illegal absence among children and young people by region, target group, Absence rate | 2010–2013 | no |
| [BU29A](https://www.statbank.dk/BU29A) | Illegal absence among children and young people by region, measure, Absence rate | 2010–2015 | no |
| [BU33](https://www.statbank.dk/BU33) | Disadvantaged children and young people as a percentage of the population by region, Measure | 2011–2019 | no |
| [BUFF01](https://www.statbank.dk/BUFF01) | Children and young persons with preventive measures per 31st December by region, measure | 2015–2021 | no |
| [ELH01](https://www.statbank.dk/ELH01) | Full-time participants in retirement by region, number and share, age, sex | 2007–2013 | no |
| [ELK01](https://www.statbank.dk/ELK01) | Full-time participants in retirement by region, number and share, age, sex | 2007Q1–2013Q4 | no |
| [FORHJBE1](https://www.statbank.dk/FORHJBE1) | Preventative home visits (previous year) by region, kind, age | 2007–2008 | no |
| [HAND01X](https://www.statbank.dk/HAND01X) | Handicap services (Number) by region, handicap service, service provider | 2013Q4–2017Q2 | no |
| [HAND05X](https://www.statbank.dk/HAND05X) | Handicap services by region, handicap service, service provider | 2014–2016 | no |
| [HAND06X](https://www.statbank.dk/HAND06X) | Handicap services (Number per 1.000 inhabitants) by region, handicap service, service provider | 2013Q4–2017Q2 | no |
| [KONT1](https://www.statbank.dk/KONT1) | Receivers of cash benefits by region, type of benefits | 2007M01–2013M12 | no |
| [KONT2](https://www.statbank.dk/KONT2) | Cash benefits by region, type of benefits | 2007M01–2013M12 | no |
| [KY024](https://www.statbank.dk/KY024) | Cash benefits by region, unit | 2007–2015 | no |
| [KY034](https://www.statbank.dk/KY034) | Cash benefits (persons and amount) by unit, region | 2007–2024 | no |
| [KY035](https://www.statbank.dk/KY035) | Cash benefits (full-time) by region, visitation | 2007–2024 | no |
| [KY038](https://www.statbank.dk/KY038) | Cash benefits (full-time) by region, type of benefits, national origin, ancestry | 2007–2024 | no |
| [KY04](https://www.statbank.dk/KY04) | Cash benefits (persons and amount) by region, unit, visitation | 2007M01–2025M06 | no |
| [KY16](https://www.statbank.dk/KY16) | Cash benefits (persons and amount) by region, unit, type of benefits | 2007M01–2025M06 | no |
| [LIGEHI12](https://www.statbank.dk/LIGEHI12) | Gender equality indicator home care, recipents referral by indicator, region, age, family type | 2010–2025 | no |
| [LIGEHI13](https://www.statbank.dk/LIGEHI13) | Gender equality indicator home care, referral hours per person by indicator, region, age, family type | 2010–2025 | no |
| [LIVBO1](https://www.statbank.dk/LIVBO1) | Quality of life by contentment, unit, tenure, region, sex | 2015 | no |
| [LIVBO10](https://www.statbank.dk/LIVBO10) | Quality of life by safety and credit, unit, tenure, region, sex | 2015 | no |
| [LIVBO2](https://www.statbank.dk/LIVBO2) | Quality of life by meaningful, unit, tenure, region, sex | 2015 | no |
| [LIVBO3](https://www.statbank.dk/LIVBO3) | Quality of life by state of mind, unit, tenure, region, sex | 2015 | no |
| [LIVBO4](https://www.statbank.dk/LIVBO4) | Quality of life by health, unit, tenure, region, sex | 2015 | no |
| [LIVBO5](https://www.statbank.dk/LIVBO5) | Quality of life by restrictions of life, unit, tenure, region, sex | 2015 | no |
| [LIVBO6](https://www.statbank.dk/LIVBO6) | Quality of life by everyday life, unit, tenure, region, sex | 2015 | no |
| [LIVBO7](https://www.statbank.dk/LIVBO7) | Quality of life by social relations, unit, tenure, region, sex | 2015 | no |
| [LIVBO8](https://www.statbank.dk/LIVBO8) | Quality of life by economic, unit, tenure, region, sex | 2015 | no |
| [LIVBO9](https://www.statbank.dk/LIVBO9) | Quality of life by confidence, unit, tenure, region, sex | 2015 | no |
| [LIVES1](https://www.statbank.dk/LIVES1) | Quality of life by contentment, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES10](https://www.statbank.dk/LIVES10) | Quality of life by safety and credit, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES2](https://www.statbank.dk/LIVES2) | Quality of life by meaningful, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES3](https://www.statbank.dk/LIVES3) | Quality of life by state of mind, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES4](https://www.statbank.dk/LIVES4) | Quality of life by health, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES5](https://www.statbank.dk/LIVES5) | Quality of life by restrictions of life, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES6](https://www.statbank.dk/LIVES6) | Quality of life by everyday life, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES7](https://www.statbank.dk/LIVES7) | Quality of life by social relations, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES8](https://www.statbank.dk/LIVES8) | Quality of life by economic, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVES9](https://www.statbank.dk/LIVES9) | Quality of life by confidence, unit, socioeconomic status, region, sex | 2015 | no |
| [LIVFO1](https://www.statbank.dk/LIVFO1) | Quality of life by contentment, unit, wealth, region, sex | 2015 | no |
| [LIVFO10](https://www.statbank.dk/LIVFO10) | Quality of life by safety and credit, unit, wealth, region, sex | 2015 | no |
| [LIVFO2](https://www.statbank.dk/LIVFO2) | Quality of life by meaningful, unit, wealth, region, sex | 2015 | no |
| [LIVFO3](https://www.statbank.dk/LIVFO3) | Quality of life by state of mind, unit, wealth, region, sex | 2015 | no |
| [LIVFO4](https://www.statbank.dk/LIVFO4) | Quality of life by health, unit, wealth, region, sex | 2015 | no |
| [LIVFO5](https://www.statbank.dk/LIVFO5) | Quality of life by restrictions of life, unit, wealth, region, sex | 2015 | no |
| [LIVFO6](https://www.statbank.dk/LIVFO6) | Quality of life by everyday life, unit, wealth, region, sex | 2015 | no |
| [LIVFO7](https://www.statbank.dk/LIVFO7) | Quality of life by social relations, unit, wealth, region, sex | 2015 | no |
| [LIVFO8](https://www.statbank.dk/LIVFO8) | Quality of life by economic, unit, wealth, region, sex | 2015 | no |
| [LIVFO9](https://www.statbank.dk/LIVFO9) | Quality of life by confidence, unit, wealth, region, sex | 2015 | no |
| [LIVHE1](https://www.statbank.dk/LIVHE1) | Quality of life by contentment, unit, ancestry, region, sex | 2015 | no |
| [LIVHE10](https://www.statbank.dk/LIVHE10) | Quality of life by safety and credit, unit, ancestry, region, sex | 2015 | no |
| [LIVHE2](https://www.statbank.dk/LIVHE2) | Quality of life by meaningful, unit, ancestry, region, sex | 2015 | no |
| [LIVHE3](https://www.statbank.dk/LIVHE3) | Quality of life by state of mind, unit, ancestry, region, sex | 2015 | no |
| [LIVHE4](https://www.statbank.dk/LIVHE4) | Quality of life by health, unit, ancestry, region, sex | 2015 | no |
| [LIVHE5](https://www.statbank.dk/LIVHE5) | Quality of life by restrictions of life, unit, ancestry, region, sex | 2015 | no |
| [LIVHE6](https://www.statbank.dk/LIVHE6) | Quality of life by everyday life, unit, ancestry, region, sex | 2015 | no |
| [LIVHE7](https://www.statbank.dk/LIVHE7) | Quality of life by social relations, unit, ancestry, region, sex | 2015 | no |
| [LIVHE8](https://www.statbank.dk/LIVHE8) | Quality of life by economic, unit, ancestry, region, sex | 2015 | no |
| [LIVHE9](https://www.statbank.dk/LIVHE9) | Quality of life by confidence, unit, ancestry, region, sex | 2015 | no |
| [LIVIL1](https://www.statbank.dk/LIVIL1) | Quality of life by contentment, unit, disposable income, region, sex | 2015 | no |
| [LIVIL10](https://www.statbank.dk/LIVIL10) | Quality of life by safety and credit, unit, disposable income, region, sex | 2015 | no |
| [LIVIL2](https://www.statbank.dk/LIVIL2) | Quality of life by meaningful, unit, disposable income, region, sex | 2015 | no |
| [LIVIL3](https://www.statbank.dk/LIVIL3) | Quality of life by state of mind, unit, disposable income, region, sex | 2015 | no |
| [LIVIL4](https://www.statbank.dk/LIVIL4) | Quality of life by health, unit, disposable income, region, sex | 2015 | no |
| [LIVIL5](https://www.statbank.dk/LIVIL5) | Quality of life by restrictions of life, unit, disposable income, region, sex | 2015 | no |
| [LIVIL6](https://www.statbank.dk/LIVIL6) | Quality of life by everyday life, unit, disposable income, region, sex | 2015 | no |
| [LIVIL7](https://www.statbank.dk/LIVIL7) | Quality of life by social relations, unit, disposable income, region, sex | 2015 | no |
| [LIVIL8](https://www.statbank.dk/LIVIL8) | Quality of life by economic, unit, disposable income, region, sex | 2015 | no |
| [LIVIL9](https://www.statbank.dk/LIVIL9) | Quality of life by confidence, unit, disposable income, region, sex | 2015 | no |
| [LIVLK1](https://www.statbank.dk/LIVLK1) | Quality of life by contentment, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK10](https://www.statbank.dk/LIVLK10) | Quality of life by safety and credit, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK2](https://www.statbank.dk/LIVLK2) | Quality of life by meaningful, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK3](https://www.statbank.dk/LIVLK3) | Quality of life by state of mind, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK4](https://www.statbank.dk/LIVLK4) | Quality of life by health, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK5](https://www.statbank.dk/LIVLK5) | Quality of life by restrictions of life, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK6](https://www.statbank.dk/LIVLK6) | Quality of life by everyday life, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK7](https://www.statbank.dk/LIVLK7) | Quality of life by social relations, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK8](https://www.statbank.dk/LIVLK8) | Quality of life by economic, unit, visits to physicians, region, sex | 2015 | no |
| [LIVLK9](https://www.statbank.dk/LIVLK9) | Quality of life by confidence, unit, visits to physicians, region, sex | 2015 | no |
| [LIVO1](https://www.statbank.dk/LIVO1) | Quality of life by key figures, region | 2008–2018 | no |
| [LIVS10](https://www.statbank.dk/LIVS10) | Quality of life by confidence, unit, region, age, sex | 2015 | no |
| [LIVS11](https://www.statbank.dk/LIVS11) | Quality of life by safety and credit, unit, region, age, sex | 2015 | no |
| [LIVS2](https://www.statbank.dk/LIVS2) | Quality of life by contentment, unit, region, age, sex | 2015 | no |
| [LIVS3](https://www.statbank.dk/LIVS3) | Quality of life by meaningful, unit, region, age, sex | 2015 | no |
| [LIVS4](https://www.statbank.dk/LIVS4) | Quality of life by state of mind, unit, region, age, sex | 2015 | no |
| [LIVS5](https://www.statbank.dk/LIVS5) | Quality of life by health, unit, region, age, sex | 2015 | no |
| [LIVS6](https://www.statbank.dk/LIVS6) | Quality of life by restrictions of life, unit, region, age, sex | 2015 | no |
| [LIVS7](https://www.statbank.dk/LIVS7) | Quality of life by everyday life, frequency, region, age, sex | 2015 | no |
| [LIVS8](https://www.statbank.dk/LIVS8) | Quality of life by social relations, frequency, region, age, sex | 2015 | no |
| [LIVS9](https://www.statbank.dk/LIVS9) | Quality of life by economic, unit, region, age, sex | 2015 | no |
| [LIVUL1](https://www.statbank.dk/LIVUL1) | Quality of life by contentment, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL10](https://www.statbank.dk/LIVUL10) | Quality of life by safety and credit, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL2](https://www.statbank.dk/LIVUL2) | Quality of life by meaningful, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL3](https://www.statbank.dk/LIVUL3) | Quality of life by state of mind, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL4](https://www.statbank.dk/LIVUL4) | Quality of life by health, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL5](https://www.statbank.dk/LIVUL5) | Quality of life by restrictions of life, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL6](https://www.statbank.dk/LIVUL6) | Quality of life by everyday life, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL7](https://www.statbank.dk/LIVUL7) | Quality of life by social relations, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL8](https://www.statbank.dk/LIVUL8) | Quality of life by economic, unit, highest education completed, region, sex | 2015 | no |
| [LIVUL9](https://www.statbank.dk/LIVUL9) | Quality of life by confidence, unit, highest education completed, region, sex | 2015 | no |
| [MH11](https://www.statbank.dk/MH11) | Recipients of temporary home help by region, frequency of benefits, age | 2006–2013 | no |
| [PEN11](https://www.statbank.dk/PEN11) | Recipients of old age- and early retirement pension, etc. (pr. January) by region, kind of pension, age, sex | 2007–2018 | no |
| [PEN111](https://www.statbank.dk/PEN111) | Recipients of disability pension by region, type of benefits, age, sex, recipients | 2009–2021 | no |
| [PEN112](https://www.statbank.dk/PEN112) | Recipients of national old-age pension by region, type of benefits, age, sex, recipients | 2009–2021 | no |
| [PEN12](https://www.statbank.dk/PEN12) | Old age- and early retirement pension (per january) by county, family type, kind of pension, sex, unit | 2017–2018 | no |
| [PEN22](https://www.statbank.dk/PEN22) | Old age- and early retirement pension payment in January by region, kind of pension, type of amount, marital status, sex | 2007–2015 | no |
| [PEN33](https://www.statbank.dk/PEN33) | Recipients of old age- and early retirement pension (per january) by region, kind of pension, type of amount, marital status, sex | 2007–2015 | no |
| [REHAB](https://www.statbank.dk/REHAB) | Recipients of rehabilitation by region, age, sex | 2017–2018 | no |
| [RES10](https://www.statbank.dk/RES10) | Staff working with nursing and care, full-time employees by region, main account, occupation | 2008–2015 | no |
| [RES10X](https://www.statbank.dk/RES10X) | Staff in measures for elderly people, full-time employees by region, function | 2007–2009 | no |
| [RES11](https://www.statbank.dk/RES11) | Staff in municipal dental care and health care, full-time employees by region, function | 2007–2015 | no |
| [RES13](https://www.statbank.dk/RES13) | Staff working with municipal and regional nursing and care, full-time employees by region, occupation | 2016–2019 | no |
| [RES14](https://www.statbank.dk/RES14) | Staff working with municipal and regional nursing and care, full-time employees by region, main account | 2016–2019 | no |
| [RES15](https://www.statbank.dk/RES15) | Staff in municipal dental care and health care, full-time employees by region, function | 2016–2019 | no |
| [RESI01](https://www.statbank.dk/RESI01) | Clients in nursing dwellings and dwellings for the elderly by region, age, type of measure | 2007–2022 | no |
| [RESMAD](https://www.statbank.dk/RESMAD) | Persons referral to home food delivery by region, refarral recipients of home food delivery | 2008–2022 | no |
| [RESP01](https://www.statbank.dk/RESP01) | Places in social measures by region, type of measure, number of places | 2007–2022 | no |
| [RESSBU](https://www.statbank.dk/RESSBU) | Special institutions for children and juveniles by region, enrolled persons, type of client, age | 2008–2018 | no |
| [RESV01](https://www.statbank.dk/RESV01) | Residence scheme at an institution for adults by region, residence scheme at an institution, type of client, sex | 2007–2012 | no |
| [RESV02](https://www.statbank.dk/RESV02) | Residence scheme at an institution for adults by region, residence scheme at an institution, type of client, target group | 2007–2012 | no |
| [RESV03](https://www.statbank.dk/RESV03) | Residence scheme at an institution for adults by region, residence scheme at an institution, type of client, age | 2007–2012 | no |
| [RESV04](https://www.statbank.dk/RESV04) | Sheltered workshop and activity and drop-in centres by region, activity, target group, sex | 2007–2012 | no |
| [RESV05](https://www.statbank.dk/RESV05) | Sheltered workshop and activity and drop-in centres by region, activity, age | 2007–2012 | no |
| [RESV07](https://www.statbank.dk/RESV07) | Social pedagogical assistance and treatment schemes by region, type of benefits, target group, sex | 2007–2012 | no |
| [RESV08](https://www.statbank.dk/RESV08) | Social pedagogical assistance and treatment schemes by region, type of benefits, age | 2011–2012 | no |
| [SAM11](https://www.statbank.dk/SAM11) | Recipients of transfer payments by region, type of benefits, age, sex, family type | 2006–2007 | no |
| [SAM22](https://www.statbank.dk/SAM22) | Transfer payment paid by region, type of benefits, age, sex, family type | 2006–2007 | no |
| [SAM55](https://www.statbank.dk/SAM55) | Recipients under 60 years of temp. transfer payments for at least half a year by region, type of benefits, age, sex, family type | 2006–2007 | no |
| [SAM77](https://www.statbank.dk/SAM77) | Full-time recipients of transfer payments by region, type of benefits, age, sex | 2006–2007 | no |
| [SOCDAG00](https://www.statbank.dk/SOCDAG00) | Sickness and maternity benefits, all cases by region, movement, sex, age, type of benefit | 2006–2019 | no |
| [SOCDAG33](https://www.statbank.dk/SOCDAG33) | Concluded benefit cases by region, sex, age, type of benefit, duration, industry, socioeconomic status | 2009–2014 | no |
| [SOCDAG55](https://www.statbank.dk/SOCDAG55) | Concluded benefit cases by region, sex, age, type of benefit, duration, family type | 2010–2015 | no |
| [SOCDAG66](https://www.statbank.dk/SOCDAG66) | Concluded benefit cases (amounts) by region, sex, age, type of benefit, duration, family type | 2010–2014 | no |
| [SOCDAG77](https://www.statbank.dk/SOCDAG77) | Concluded benefit cases by region, sex, age, type of benefit, duration, cause of discontinuation, course of extension | 2010–2014 | no |
| [SOCDAG88](https://www.statbank.dk/SOCDAG88) | Concluded benefit cases (amounts) by region, sex, age, type of benefit, duration, cause of discontinuation, course of extension | 2010–2014 | no |
| [SOCDAG99](https://www.statbank.dk/SOCDAG99) | Concluded benefit cases by region, sex, age, type of benefit, duration, unit | 2010–2014 | no |
| [STRAF41](https://www.statbank.dk/STRAF41) | Population by region, age, sex | 2007–2021 | no |
| [VH44](https://www.statbank.dk/VH44) | Persons, who are embraced by free choice/users of permanent home help done by pr by region, type of measure, type of help, age | 2007–2010 | no |
| [VHLT1](https://www.statbank.dk/VHLT1) | Delivered hours per week for permanent home help by region, type of benefits, age | 2007 | no |
| [VHP1](https://www.statbank.dk/VHP1) | Number of recipients of permanent home help by region, type of resident, type of benefits, age, scope | 2007 | no |
| [VHVT1](https://www.statbank.dk/VHVT1) | Referral hours per week for permanent home help (both personal help and care) by region, age | 2007 | no |

</details>

<details><summary>municipality (pre-2007): 307 tables (0 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [BDF5](https://www.statbank.dk/BDF5) | Farms by region, selected farms crops and livestock | 1982–1999 | no |
| [BYGB1](https://www.statbank.dk/BYGB1) | Buildings by region, ownership, use, area in square metre (m2) | 1986–2006 | no |
| [BYGB3](https://www.statbank.dk/BYGB3) | Areas of the building stock by region, use, area, year of construction | 1986–2006 | no |
| [BYGV1](https://www.statbank.dk/BYGV1) | Total construction (not adjusted for delays) by region, condition, use, ownership | 1982–2006 | no |
| [BYGV2](https://www.statbank.dk/BYGV2) | New buildings completed (not adjusted for delays) by region, year of commencement, type of building case | 1981–2006 | no |
| [BYGV3](https://www.statbank.dk/BYGV3) | Residential construction (not adjusted for delays) by region, condition, use, ownership | 1981–2006 | no |
| [ERH1](https://www.statbank.dk/ERH1) | Workplaces by region, size | 2002–2006 | no |
| [ERH13](https://www.statbank.dk/ERH13) | Workplaces by region, industry | 2002–2006 | no |
| [ERH13X](https://www.statbank.dk/ERH13X) | Workplaces by region, industry | 1992–2001 | no |
| [ERH16](https://www.statbank.dk/ERH16) | Workplaces by region, industry, size | 2002–2006 | no |
| [ERH16X](https://www.statbank.dk/ERH16X) | Workplaces by region, industry, size | 1992–2001 | no |
| [ERH1X](https://www.statbank.dk/ERH1X) | Workplaces by region, size | 1980–2001 | no |
| [ERH2](https://www.statbank.dk/ERH2) | Annual salary cost for the workplaces by region | 1980–1996 | no |
| [ERH3](https://www.statbank.dk/ERH3) | Workplaces by region, industry | 1980–1992 | no |
| [ERH6](https://www.statbank.dk/ERH6) | Workplaces by region, industry, size | 1990–1992 | no |
| [ERH7](https://www.statbank.dk/ERH7) | Employment conditions by region, industry, job title | 1990–1992 | no |
| [ERH8](https://www.statbank.dk/ERH8) | Employment conditions by region, industry, activity | 1990–1992 | no |
| [INDU1](https://www.statbank.dk/INDU1) | Employees in the industry by region, job title, sex | 1977–1989 | no |
| [INDU2](https://www.statbank.dk/INDU2) | Wage costs in the industry by region, job title | 1977–1989 | no |
| [INDU3](https://www.statbank.dk/INDU3) | Industrial activities by region | 1977–1989 | no |
| [MOMS1](https://www.statbank.dk/MOMS1) | Momsregistrerede virksomheder efter område, branche, ejerforhold og tid | 1984–1992 | no |
| [MOMS11](https://www.statbank.dk/MOMS11) | Business units registered for VAT settlement: distribution by region, industry, ownership | 1992–1999 | no |
| [NYMO1](https://www.statbank.dk/NYMO1) | Momsregistrerede virksomheder efter branche, område, bevægelsesart og tid | 1985–1992 | no |
| [OFF2](https://www.statbank.dk/OFF2) | Municipal employees by region, main account, extent of working time, primary/secondary employment, sex | 1983–1995 | no |
| [RST](https://www.statbank.dk/RST) | Extraction of raw materials in Denmark. by region, type of raw material | 1989–2006 | no |
| [RST4](https://www.statbank.dk/RST4) | Extraction of raw materials from the bottom of the sea. by region, type of raw material | 1990–2006 | no |
| [SKOV1](https://www.statbank.dk/SKOV1) | Forestry area by region, forest area | 1990–2000 | no |
| [BUD1](https://www.statbank.dk/BUD1) | Municipality budgets (DKK 1,000) by region, main account, dranst, kind | 1982–2006 | no |
| [BUD2](https://www.statbank.dk/BUD2) | The financial part of the municipality budgets (DKK 1,000) by region, dranst, kind | 1982–2006 | no |
| [BUD32](https://www.statbank.dk/BUD32) | Kommunale budgetter (1.000 kr.) efter område, funktion, dranst, art og tid | 1998–2006 | no |
| [BUD32X](https://www.statbank.dk/BUD32X) | Kommunale budgetter efter område, funktion, dranst, art og tid | 1991–1997 | no |
| [BUD53](https://www.statbank.dk/BUD53) | Driftsbudgetter (1.000 kr.) (social- og sundhed) efter område, gruppering, art og tid | 1998–2006 | no |
| [BUD54](https://www.statbank.dk/BUD54) | Budgetterede forskydninger i kortfristet gæld til staten (1.000 kr.) efter område, gruppering og tid | 2000–2006 | no |
| [BUDP4X](https://www.statbank.dk/BUDP4X) | Kommunernes budgetterede personaleforbrug omregnet til fuldtidsbeskæftigede efter område, funktion og tid | 1986–1997 | no |
| [EJEN1](https://www.statbank.dk/EJEN1) | Sales of real property by region, category of real property, key figures, type of transfer | 1992Q1–2002Q4 | no |
| [EJEN2](https://www.statbank.dk/EJEN2) | Sales of real property by region, category of real property, key figures, type of transfer | 1992–2001 | no |
| [ESKATX](https://www.statbank.dk/ESKATX) | Valuation and taxation of real property  by region, tax base | 1981–2006 | no |
| [PSKATX](https://www.statbank.dk/PSKATX) | Local government personal taxation by region, tax rate | 1976–2006 | no |
| [REG1](https://www.statbank.dk/REG1) | Kommunale regnskaber efter område, hovedkonto, dranst, art og tid | 1978–1991 | no |
| [REG11](https://www.statbank.dk/REG11) | Municipality accounts (DKK 1.000) by region, main account, dranst, kind | 1995–2006 | no |
| [REG1R](https://www.statbank.dk/REG1R) | Kommunale regnskaber efter område, hovedkonto, dranst, art og tid | 1990–1995 | no |
| [REG2](https://www.statbank.dk/REG2) | The financial part of the municipality accounts (DKK 1.000) by region, dranst, kind | 1978–2006 | no |
| [REG3](https://www.statbank.dk/REG3) | Kommunale regnskaber (1000 kr.) efter område, funktion, dranst, art og tid | 1990–1994 | no |
| [REG31](https://www.statbank.dk/REG31) | Kommunale regnskaber (1000 kr.) efter område, funktion, dranst, art og tid | 1995–2006 | no |
| [REG4](https://www.statbank.dk/REG4) | Finansiel status (1000 kr.) efter område, funktion og tid | 1983–2006 | no |
| [REG53](https://www.statbank.dk/REG53) | Driftsregnskab (1000 kr.), (social- og sundhed) efter område, gruppering, art og tid | 1995–2006 | no |
| [REG54](https://www.statbank.dk/REG54) | Forskydninger i anden kortfristet gæld til staten m.v. efter område, gruppering og tid | 1991–2006 | no |
| [REG71](https://www.statbank.dk/REG71) | Driftsregnskab (1000 kr.) (skolevæsen) efter område, funktion, udgifter/indtægter og tid | 1981–2006 | no |
| [ARBUD](https://www.statbank.dk/ARBUD) | Kursister ved arbejdsmarkedsuddannelser efter område, uddannelsesart, højeste fuldførte uddannelse, alder, køn og tid | 1980–1994 | no |
| [HFU1](https://www.statbank.dk/HFU1) | Educational attainment of the population by region, ancestry, education, age, sex | 1991–2006 | no |
| [HFU2](https://www.statbank.dk/HFU2) | Educational attainment of the population by region, highest education completed, socioeconomic status, industry, age, sex | 1993–2006 | no |
| [HFU3](https://www.statbank.dk/HFU3) | Educational attainment of the youth by region, ancestry, highest education completed, receiving education, age, sex | 1991–2006 | no |
| [U11](https://www.statbank.dk/U11) | Enrolled by municipality of residence, education, age, sex | 1991–2005 | no |
| [U12](https://www.statbank.dk/U12) | Enrolled by location of educational institution, education, age, sex | 1991–2005 | no |
| [U19](https://www.statbank.dk/U19) | Enrolled, basic school by education, age, ancestry, national origin, sex, type of institution, region | 2001–2005 | no |
| [U21](https://www.statbank.dk/U21) | Entrants by municipality of residence, education, age, sex | 1991–2005 | no |
| [U22](https://www.statbank.dk/U22) | Entrants by location of educational institution, education, age, sex | 1991–2005 | no |
| [U29](https://www.statbank.dk/U29) | Entrants, basic school by education, age, ancestry, national origin, sex, type of institution, region | 2001–2005 | no |
| [U31](https://www.statbank.dk/U31) | Graduates by municipality of residence, education, age, sex | 1991–2005 | no |
| [U32](https://www.statbank.dk/U32) | Graduates by location of educational institution, education, age, sex | 1991–2005 | no |
| [U39](https://www.statbank.dk/U39) | Graduates, basic school by education, age, ancestry, national origin, sex, type of institution, region | 2001–2005 | no |
| [VEU1](https://www.statbank.dk/VEU1) | Participation in supplementary courses by region, field of education, highest education completed, age, sex, ancestry, unit, points in time | 1996–2006 | no |
| [VUC3](https://www.statbank.dk/VUC3) | Persons by region, level of education, age, sex | 1979–1998 | no |
| [ARE2](https://www.statbank.dk/ARE2) | Area by region by region | 1985–2006 | no |
| [AAR](https://www.statbank.dk/AAR) | Unemlpoyed by region, sex | 1979–2006 | no |
| [AARD](https://www.statbank.dk/AARD) | Unemlpoyed in per cent of the labour force by region, sex | 1979–2006 | no |
| [AB112D](https://www.statbank.dk/AB112D) | Unemployed by region, age, sex | 1996M01–2006M12 | no |
| [AB113](https://www.statbank.dk/AB113) | Unemployed persons by region, category of insurance, unemployment insurance fund, age, sex | 1996M01–2006M12 | no |
| [AB113A](https://www.statbank.dk/AB113A) | Unemployed insured persons in per cent of the total num. of insur. by region, category of insurance, unemployment insurance fund, age, sex | 1996M01–2006M12 | no |
| [AB113E](https://www.statbank.dk/AB113E) | Updated and final number of unemployed persons by region, category of insurance, unemployment insurance fund, age, sex | 1996M01–2006M11 | no |
| [AB113X](https://www.statbank.dk/AB113X) | Unemployed persons by region, unemployment insurance fund | 1991M01–1995M12 | no |
| [AB121D](https://www.statbank.dk/AB121D) | Unemployed in per cent of the labour force by region, age, sex | 1996Q1–2006Q4 | no |
| [AB122](https://www.statbank.dk/AB122) | Unemlpoyed persons by region, category of insurance, unemployment insurance fund, age, sex | 1996Q1–2006Q4 | no |
| [AB122A](https://www.statbank.dk/AB122A) | Unemployed insured persons in per cent of the total num. of insur. by region, category of insurance, unemployment insurance fund, age, sex | 1996Q1–2006Q4 | no |
| [AB322](https://www.statbank.dk/AB322) | Persons who have experienced unempl. for a short or long period by region, unemployment insurance fund, age, category of insurance, sex | 1996Q1–2006Q4 | no |
| [AB513](https://www.statbank.dk/AB513) | Insured persons by region, category of insurance, unemployment insurance fund, age, sex | 1996M01–2006M12 | no |
| [AB513X](https://www.statbank.dk/AB513X) | Insured persons by region, unemployment insurance fund | 1991M01–1995M12 | no |
| [AB522](https://www.statbank.dk/AB522) | Insured persons by region, category of insurance, unemployment insurance fund, age, sex | 1996Q1–2006Q4 | no |
| [DURA1](https://www.statbank.dk/DURA1) | Benefit claimants by region, age, sex | 1998M09–2006M12 | no |
| [DURG1](https://www.statbank.dk/DURG1) | Average number of benefit claimants by region, age, sex | 1998M09–2006M12 | no |
| [DURU1](https://www.statbank.dk/DURU1) | Total payments of unemployment benefit (DKK. 1,000) by region, age, sex | 1998M09–2006M12 | no |
| [IA911](https://www.statbank.dk/IA911) | Families by region, family type, type of income | 1991–2003 | no |
| [IA921](https://www.statbank.dk/IA921) | Families by region, family type, owner/ tenant of dwelling, type of income | 1991–2003 | no |
| [IA922](https://www.statbank.dk/IA922) | Families by region, family type, use of cars, type of income | 1991–2003 | no |
| [IA923](https://www.statbank.dk/IA923) | Families by region, owner/ tenant of dwelling, type of income | 1991–2005 | no |
| [IA933](https://www.statbank.dk/IA933) | Families by region, education, type of income | 1991–1997 | no |
| [IA953](https://www.statbank.dk/IA953) | Families by region, type of dwelling, type of income | 1991–2003 | no |
| [IB811](https://www.statbank.dk/IB811) | Income (personal) by region, age, sex, type of income | 1991–2005 | no |
| [IB812](https://www.statbank.dk/IB812) | Income (personal) by region, age, sex, family type, type of income | 1991–2000 | no |
| [IB821](https://www.statbank.dk/IB821) | Income (personal) by region, education, sex, type of income | 1991–1998 | no |
| [IB831S](https://www.statbank.dk/IB831S) | Income (personal) by region, sex, socioeconomic status, type of income | 1996–2004 | no |
| [IB911](https://www.statbank.dk/IB911) | Family income by region, family type, type of income | 1991–2003 | no |
| [IB922](https://www.statbank.dk/IB922) | Family income by region, family type, use of cars, type of income | 1991–2003 | no |
| [IB923](https://www.statbank.dk/IB923) | Family income by region, owner/ tenant of dwelling, type of income | 1991–2005 | no |
| [IB933](https://www.statbank.dk/IB933) | Family income by region, education, type of income | 1991–1997 | no |
| [IB953](https://www.statbank.dk/IB953) | Family income by region, type of dwelling, type of income | 1991–2003 | no |
| [IF111](https://www.statbank.dk/IF111) | Persons fully liable to pay tax (all the year) by region, type of income | 1999–2001 | no |
| [IF112](https://www.statbank.dk/IF112) | Persons liable to pay tax with income by region, type of income | 1983–2001 | no |
| [IF12](https://www.statbank.dk/IF12) | Gross income by region, income interval, age, sex | 2000–2005 | no |
| [IF13](https://www.statbank.dk/IF13) | Persons liable to pay tax by region, income interval, age, sex | 1983–2005 | no |
| [IF14](https://www.statbank.dk/IF14) | Persons liable to pay tax by region, income interval, job title | 1983–1995 | no |
| [IF14X](https://www.statbank.dk/IF14X) | Persons liable to pay tax by region, income interval, socioeconomic status | 1995–2001 | no |
| [IF15](https://www.statbank.dk/IF15) | Persons liable to pay tax by region, income interval, job title | 1983–1995 | no |
| [IF15X](https://www.statbank.dk/IF15X) | Persons liable to pay tax by region, income interval, socioeconomic status | 1995–2000 | no |
| [IF16](https://www.statbank.dk/IF16) | Persons liable to pay tax by region, industry/occupation | 1983–1995 | no |
| [IF16X](https://www.statbank.dk/IF16X) | Persons liable to pay tax, working, by region, industry/occupation | 1995–1996 | no |
| [IF211](https://www.statbank.dk/IF211) | Income for persons fully liable to pay tax (all the year) by region, type of income | 1983–2001 | no |
| [IF212](https://www.statbank.dk/IF212) | Income for persons liable to pay tax by region, type of income | 1983–2001 | no |
| [IF221](https://www.statbank.dk/IF221) | Gross income by region, income interval, age, sex | 1983–2005 | no |
| [IF23](https://www.statbank.dk/IF23) | Taxable income by region, income interval, age, sex | 1983–2005 | no |
| [IF25](https://www.statbank.dk/IF25) | Taxable income by region, income interval, job title | 1983–1995 | no |
| [IG911](https://www.statbank.dk/IG911) | Average family income by region, family type, type of income | 2002–2005 | no |
| [PEND11](https://www.statbank.dk/PEND11) | Employed by area of workplace, industry, age, sex | 1993–2005 | no |
| [PEND1XX](https://www.statbank.dk/PEND1XX) | Employed by region, industry, age, sex | 1984–1993 | no |
| [PEND2R](https://www.statbank.dk/PEND2R) | Employed by area of workplace, job title, age, sex | 1993–1996 | no |
| [PENDAB1](https://www.statbank.dk/PENDAB1) | Employed by municipality of residence, area of workplace, sex | 1993–2006 | no |
| [PENDAB2](https://www.statbank.dk/PENDAB2) | Employed persons by region, industry, commuting, sex | 1993–2006 | no |
| [RAS1](https://www.statbank.dk/RAS1) | Population by region, socioeconomic status, ancestry, age, sex | 1981–2006 | no |
| [RAS11](https://www.statbank.dk/RAS11) | Population by region, socioeconomic status, ancestry, age, sex | 1997–2001 | no |
| [RAS1F](https://www.statbank.dk/RAS1F) | Economic activity and employment rates by region, ancestry, age, sex, frequency | 1997–2006 | no |
| [RAS1Z](https://www.statbank.dk/RAS1Z) | Population by region, job title, citizenship, age, sex | 1981–1996 | no |
| [RAS2](https://www.statbank.dk/RAS2) | Population by region, socioeconomic status, ancestry, age, sex | 1997–2006 | no |
| [RAS2XX](https://www.statbank.dk/RAS2XX) | Employed by region, industry, age, sex | 1984–1993 | no |
| [RAS33](https://www.statbank.dk/RAS33) | Labour force to calculating unemployment rates aged 16-66 by region, age, sex | 1980–2005 | no |
| [RAS33X](https://www.statbank.dk/RAS33X) | Labour force aged 16-66 by region, category of insurance, age, sex | 1981–1999 | no |
| [RAS6](https://www.statbank.dk/RAS6) | Employed by region, industry, job title, sex | 1993–1996 | no |
| [RAS6XX](https://www.statbank.dk/RAS6XX) | Employed by region, industry, job title, sex | 1983–1993 | no |
| [RASA](https://www.statbank.dk/RASA) | Employed by region, industry, socioeconomic status, ancestry, age, sex | 1997–2006 | no |
| [RASA01](https://www.statbank.dk/RASA01) | Employed by area of workplace, industry (DB07), socioeconomic status, ancestry, age, sex | 2001–2006 | no |
| [RASB](https://www.statbank.dk/RASB) | Employed by region, industry, socioeconomic status, ancestry, age, sex | 1997–2006 | no |
| [RASB01](https://www.statbank.dk/RASB01) | Employed by region, industry (DB07), socioeconomic status, ancestry, age, sex | 2001–2006 | no |
| [RASOFF1](https://www.statbank.dk/RASOFF1) | Employed salary earners by area of workplace, sector, extent of working time, age, sex | 1997–2006 | no |
| [RASU1](https://www.statbank.dk/RASU1) | Population by region, education, socioeconomic status, age, sex | 1997–2006 | no |
| [RASU2](https://www.statbank.dk/RASU2) | Employed by region, education, industry (27-grouping), age, sex | 1993–2006 | no |
| [RU121D](https://www.statbank.dk/RU121D) | Unemployde persons in per cent og the labour force by region, age, sex | 1996Q1–2006Q4 | no |
| [RU121X](https://www.statbank.dk/RU121X) | Unemployed persons by region, sex | 1986KV4–1995KV4 | no |
| [RU122](https://www.statbank.dk/RU122) | Unemployed persons by region, category of insurance, unemployment insurance fund, age, sex | 1996Q1–2006Q4 | no |
| [RU122A](https://www.statbank.dk/RU122A) | Unemployed insured persons in per cent of the total num. of insur. by region, category of insurance, unemployment insurance fund, age, sex | 1996Q1–2006Q4 | no |
| [RU322](https://www.statbank.dk/RU322) | Persons who have experienced unemployment for a short or long period by region, degree of unemployment, unemployment insurance fund, category of insurance, age, sex | 1996Q1–2006Q4 | no |
| [BEF1](https://www.statbank.dk/BEF1) | Population 1. January by region, marital status, age, sex | 1971–2002 | no |
| [BEF1A](https://www.statbank.dk/BEF1A) | Population 1. January by region, sex, marital status, age | 1979–2006 | no |
| [BEF2A](https://www.statbank.dk/BEF2A) | Population 1. January by region, sex, marital status, age, citizenship | 1979–2006 | no |
| [BEF3](https://www.statbank.dk/BEF3) | Population 1. January by region, age, sex, ancestry, citizenship, country of origin | 1980–2006 | no |
| [BEF6](https://www.statbank.dk/BEF6) | Midyear population (population 1. July) by region, sex, marital status, age | 1993–2006 | no |
| [BEF7](https://www.statbank.dk/BEF7) | Population 1. July by region, sex, marital status, age, citizenship | 1993–2006 | no |
| [BEV1](https://www.statbank.dk/BEV1) | Summary vital statistics by region, type of movement, sex | 1979–2005 | no |
| [BEV2](https://www.statbank.dk/BEV2) | Summary vital statistics (provisional data) by region, type of movement, sex | 1988Q1–2006Q3 | no |
| [BOL1](https://www.statbank.dk/BOL1) | Occupied dwellings by region, type of dwelling, tenure, heating, number of rooms | 1981–2006 | no |
| [BOL2](https://www.statbank.dk/BOL2) | Occupied dwellings by region, type of dwelling, year of construction, installations | 1981–2006 | no |
| [BOL3](https://www.statbank.dk/BOL3) | Dwellings by region, type of dwelling, ownership, year of construction | 1981–2006 | no |
| [BOL4](https://www.statbank.dk/BOL4) | Households by region, type of dwelling, tenure, type of household, number of children | 1995–2006 | no |
| [BOL4A](https://www.statbank.dk/BOL4A) | Households by region, type of dwelling, tenure, type of household, number of children | 1981–1994 | no |
| [BOL51](https://www.statbank.dk/BOL51) | Households by region, type of dwelling, size of dwelling in square metre, household size | 1981–2006 | no |
| [BOL52](https://www.statbank.dk/BOL52) | Households by region, type of dwelling, number of rooms, household size | 1981–2006 | no |
| [BOL6](https://www.statbank.dk/BOL6) | Occupants by region, type of dwelling, tenure, age, sex | 1981–2006 | no |
| [BRN05](https://www.statbank.dk/BRN05) | Children by region, age, family type, number of siblings, combination of siblings | 1980–2006 | no |
| [BRN06](https://www.statbank.dk/BRN06) | Children by region, age, family type, number of siblings, combination of siblings | 1980–2006 | no |
| [BRN09](https://www.statbank.dk/BRN09) | Children by region, age, family type, mother status, father status | 1980–2006 | no |
| [FLY3](https://www.statbank.dk/FLY3) | Internal migration within municipalities by region, age, sex | 1979–2005 | no |
| [FLY6](https://www.statbank.dk/FLY6) | Internal migration between municipalities by in-migration municipality, out-migration municipality, age, sex | 1980–2005 | no |
| [FOD1](https://www.statbank.dk/FOD1) | Live births by region, age of mother, sex | 1974–2005 | no |
| [FOD2](https://www.statbank.dk/FOD2) | Deaths by region, age, sex | 1974–2005 | no |
| [FOD4](https://www.statbank.dk/FOD4) | Fertility rates by region, age | 1971–2005 | no |
| [PA1](https://www.statbank.dk/PA1) | Hospital patients by region, dominant diagnosis, age, sex | 1991–2005 | no |
| [PA1A](https://www.statbank.dk/PA1A) | Hospital patients by region, diagnosis, age, sex | 2000–2005 | no |
| [PAS1](https://www.statbank.dk/PAS1) | Clients in child care by region, Measure, age | 2004–2006 | no |
| [PAS2](https://www.statbank.dk/PAS2) | Child care etc. by region, Measure, kind | 2004–2006 | no |
| [PAS2X](https://www.statbank.dk/PAS2X) | Staff in day-care, full-time employees by region, function | 2000–2003 | no |
| [PAS3](https://www.statbank.dk/PAS3) | Child care etc. by region, Measure, type of staff | 2004–2006 | no |
| [RES11X](https://www.statbank.dk/RES11X) | Staff in municipal dental care and health care, full-time employees by region, function | 2000–2006 | no |
| [RES12](https://www.statbank.dk/RES12) | Staff in day-cares and school-care schemes, full-time employees by region, Measure, function | 2001–2003 | no |
| [RES5](https://www.statbank.dk/RES5) | Clients in day-care institutions and day-care by region, age | 1983–1993 | no |
| [RES5N](https://www.statbank.dk/RES5N) | Clients in day-care institutions, day-care and school-care schemes by region, Measure, age | 1994–2003 | no |
| [RES7](https://www.statbank.dk/RES7) | Rates in day-care institutions and day-care by region, type of measure | 1987–1997 | no |
| [RES8](https://www.statbank.dk/RES8) | Yearly rates of child-care by region, type of measure | 1997–2006 | no |
| [SKI1](https://www.statbank.dk/SKI1) | Divorces between two of different sex by recidence of the male, residence of the female, age of the male, age of the female, duration of marriage | 1999–2005 | no |
| [SKI2](https://www.statbank.dk/SKI2) | Divorces between two of different sex by recidence of the male, residence of the female, month of the divorce | 1999–2005 | no |
| [SYG1](https://www.statbank.dk/SYG1) | Contacts with the public health insurance by region, type of benefits, age, sex, job title | 1992–1996 | no |
| [SYG1A](https://www.statbank.dk/SYG1A) | Contacts with the public health insurance by region, type of benefits, age, sex, socioeconomic status | 1997–2005 | no |
| [SYG3](https://www.statbank.dk/SYG3) | Receivers of public health insurance by region, age, sex | 1992–1996 | no |
| [SYG31A](https://www.statbank.dk/SYG31A) | Receivers of public health insurance by region, age, sex | 1997–2005 | no |
| [SYG4](https://www.statbank.dk/SYG4) | Amounts to public health insurance in DKK 1000 by region, type of benefits, age, sex | 1992–1996 | no |
| [SYG41A](https://www.statbank.dk/SYG41A) | Amounts to public health insurance in DKK 1000 by region, type of benefits, age, sex | 1997–2005 | no |
| [UD3](https://www.statbank.dk/UD3) | Admissions, hospital patients and bed-days by region, key figures, age, sex | 1991–2005 | no |
| [VALGK3X](https://www.statbank.dk/VALGK3X) | Elections to municipality councils by region, political party, votes cast/candidates/sex | 1989–2001 | no |
| [VAN21A](https://www.statbank.dk/VAN21A) | Immigrations by region, country of last residence, citizenship, age, sex | 1980–2005 | no |
| [VAN22A](https://www.statbank.dk/VAN22A) | Emigrations by region, country of destination, citizenship, age, sex | 1980–2005 | no |
| [VIE2](https://www.statbank.dk/VIE2) | Marriages between two of different sex by residence of the groom, residence of the bride, age of the groom, age of the bride, former marital status of the groom, former marital status of the bride | 1999–2005 | no |
| [VIE3](https://www.statbank.dk/VIE3) | Marriages between two of different sex by recidence of the male, residence of the female, month of the marriage, type of marriage ceremony | 1999–2005 | no |
| [AB701](https://www.statbank.dk/AB701) | Full-time participants in labour market policy measures by region, Measure, sector, age, sex | 2004Q1–2006Q4 | no |
| [AB702](https://www.statbank.dk/AB702) | Full-time participants in labour market policy measures by region, activation, sector, age, sex | 2004Q1–2006Q4 | no |
| [AB704](https://www.statbank.dk/AB704) | Participants in flex job and light job by region, Measure, sector, age, sex | 1999Q3–2006Q4 | no |
| [AB705](https://www.statbank.dk/AB705) | Full-time participants in labour market policy measures by region, Measure, sector, age, sex | 2004–2006 | no |
| [AB706](https://www.statbank.dk/AB706) | Full-time participants in labour market policy measures by region, activation, sector, age, sex | 2004–2006 | no |
| [AB708](https://www.statbank.dk/AB708) | Participants in flex job and light job by region, Measure, sector, age, sex | 2000–2006 | no |
| [AB711](https://www.statbank.dk/AB711) | Full-time participants in labour market policy measures by region, Measure, sector, age, sex | 1995Q1–2004Q4 | no |
| [AB712](https://www.statbank.dk/AB712) | Full-time participants in labour market policy measures by region, Measure, sector, age, sex | 1995–2004 | no |
| [BIDRAG1](https://www.statbank.dk/BIDRAG1) | Advance payments of child maintenance by region and age by region, age | 2000–2005 | no |
| [BIDRAG2](https://www.statbank.dk/BIDRAG2) | Advance payments of child maintenance, by region, benefits | 2000–2005 | no |
| [BIS2](https://www.statbank.dk/BIS2) | Children and young persons placed outside of own home 31st December by region, place of accommodation, age, sex | 1982–2005 | no |
| [BIS3](https://www.statbank.dk/BIS3) | Families by region, type of social assistance | 2001–2005 | no |
| [BIS4](https://www.statbank.dk/BIS4) | Children and young persons with preventive measures by region, measure, age, sex | 2001–2005 | no |
| [BIS5](https://www.statbank.dk/BIS5) | Families with certain preventive measures by region, measure | 2001–2005 | no |
| [BOST1](https://www.statbank.dk/BOST1) | Households with rent subsidy in December by region, type of housing subsidy | 1983–2006 | no |
| [BOST2](https://www.statbank.dk/BOST2) | Rent subsidy paid to non-pensioners (1,000 DKK) in December by region, type of housing subsidy | 1983–2006 | no |
| [BOST3](https://www.statbank.dk/BOST3) | Households with rent subsidy in December by region, type of housing allowance | 1983–2006 | no |
| [BOST4](https://www.statbank.dk/BOST4) | Rent subsidy for pensioners (1.000 DKK) in December by region, type of housing allowance | 1983–2006 | no |
| [BTS1](https://www.statbank.dk/BTS1) | Families entitled to child subsidy/youth allowance in the 4th quarter of year by region, grant type | 1982–1986 | no |
| [BTS2](https://www.statbank.dk/BTS2) | Children with child subsidy or youth allowance in the 4th quarter of the year by region, grant type | 1982–1986 | no |
| [BTS3](https://www.statbank.dk/BTS3) | Paid amounts for child subsidy or youth allowance in the 4th quarter of the year by region, grant type | 1982–1986 | no |
| [BTS4](https://www.statbank.dk/BTS4) | Families with child subsidy and family allowance in the 4th quarter of the year by region, grant type | 1987–2006 | no |
| [BTS5](https://www.statbank.dk/BTS5) | Children with child subsidy and family allowance in the 4th quarter of the year by region, grant type | 2001–2006 | no |
| [BTS6](https://www.statbank.dk/BTS6) | Paid amounts for child subsidy (1,000 DKK) in the 4th quarter of the year by region, grant type | 1987–2006 | no |
| [DAGP1](https://www.statbank.dk/DAGP1) | Payment of sickness benefit by region, type of benefit, age, sex | 1985–2002 | no |
| [DAGP10](https://www.statbank.dk/DAGP10) | Sickness benefit, all concluded cases by region, duration of a case, cause of discontinuation, family type, industry | 1995–2002 | no |
| [DAGP10X](https://www.statbank.dk/DAGP10X) | Amounts, all concluded cases by region, duration of a case, cause of discontinuation, family type, industry | 1995–2002 | no |
| [DAGP11](https://www.statbank.dk/DAGP11) | Sickness benefit, all concluded cases by region, cause of benefits, cause of discontinuation, sex, family type, occupation | 1995–1996 | no |
| [DAGP11A](https://www.statbank.dk/DAGP11A) | Benefits, all concluded cases by region, cause of benefits, cause of discontinuation, sex, family type, socioeconomic status | 2001–2002 | no |
| [DAGP11X](https://www.statbank.dk/DAGP11X) | Amounts, all concluded cases by region, cause of benefits, cause of discontinuation, sex, family type, occupation | 1995–1996 | no |
| [DAGP12](https://www.statbank.dk/DAGP12) | Benefit cases, all concluded cases by region, type of benefit, cause of benefits, age | 1995–2002 | no |
| [DAGP12X](https://www.statbank.dk/DAGP12X) | Amounts, all concluded cases by region, type of benefit, cause of benefits, age | 1995–2002 | no |
| [DAGP13](https://www.statbank.dk/DAGP13) | Benefit cases, all concluded cases by region, duration of a case, cause of discontinuation, age, sex | 1995–2002 | no |
| [DAGP13X](https://www.statbank.dk/DAGP13X) | Amounts, all concluded cases by region, duration of a case, cause of discontinuation, age, sex | 1995–2002 | no |
| [DAGP14](https://www.statbank.dk/DAGP14) | Benefit cases, all concluded cases by region, duration of a case, cause of discontinuation, sex, industry | 1995–2002 | no |
| [DAGP14X](https://www.statbank.dk/DAGP14X) | Amounts, all concluded cases by region, duration of a case, cause of discontinuation, sex, industry | 1995–2002 | no |
| [DAGP15](https://www.statbank.dk/DAGP15) | Benefit cases, all concluded cases by region, duration of a case, cause of discontinuation, sex, family type | 1995–2002 | no |
| [DAGP15X](https://www.statbank.dk/DAGP15X) | Amounts, all concluded cases by region, duration of a case, cause of discontinuation, sex, family type | 1995–2002 | no |
| [DAGP16](https://www.statbank.dk/DAGP16) | Benefit cases, all concluded cases by region, duration of a case, cause of discontinuation, sex, occupation | 1995–1996 | no |
| [DAGP16A](https://www.statbank.dk/DAGP16A) | Benefit cases, all concluded cases by region, duration of a case, cause of discontinuation, sex, socioeconomic status | 1997–2002 | no |
| [DAGP16X](https://www.statbank.dk/DAGP16X) | Amounts, all concluded cases by region, duration of a case, cause of discontinuation, sex, occupation | 1995–1996 | no |
| [DAGP16Y](https://www.statbank.dk/DAGP16Y) | Amounts, all concluded cases by region, duration of a case, cause of discontinuation, sex, socioeconomic status | 1997–2002 | no |
| [DAGP17](https://www.statbank.dk/DAGP17) | Benefit cases, all concluded cases by region, cause of discontinuation, age, sex, occupation | 1995–1996 | no |
| [DAGP17A](https://www.statbank.dk/DAGP17A) | Benefit cases, all concluded cases by region, cause of discontinuation, age, sex, socioeconomic status | 1997–2002 | no |
| [DAGP17X](https://www.statbank.dk/DAGP17X) | Amounts, all concluded cases by region, cause of discontinuation, age, sex, occupation | 1995–1996 | no |
| [DAGP17Y](https://www.statbank.dk/DAGP17Y) | Amounts, all concluded cases by region, cause of discontinuation, age, sex, socioeconomic status | 1997–2002 | no |
| [DAGP18](https://www.statbank.dk/DAGP18) | Benefit cases, all concluded cases by region, sex, industry, family type, cause of benefits | 1995–2002 | no |
| [DAGP18X](https://www.statbank.dk/DAGP18X) | Amounts, all concluded cases by region, sex, industry, family type, cause of benefits | 1995–2002 | no |
| [DAGP2](https://www.statbank.dk/DAGP2) | Weeks with benefit by region, type of benefit, age, sex | 1985–2002 | no |
| [DAGP3](https://www.statbank.dk/DAGP3) | Receivers of benefits by region, type of benefit, age, sex | 1985–2002 | no |
| [DAGP4](https://www.statbank.dk/DAGP4) | Benefit cases by region, type of benefit, age, sex | 1985–2002 | no |
| [DAGP5](https://www.statbank.dk/DAGP5) | Benefit cases, all concluded cases by region, type of benefit, duration of a case, sex, industry | 1995–2002 | no |
| [DAGP5X](https://www.statbank.dk/DAGP5X) | Amounts, all concluded cases by region, type of benefit, duration of a case, sex, industry | 1995–2002 | no |
| [DAGP6](https://www.statbank.dk/DAGP6) | Benefit cases, all concluded cases by region, type of benefit, duration of a case, cause of discontinuation | 1995–2002 | no |
| [DAGP6X](https://www.statbank.dk/DAGP6X) | Amounts, all concluded cases by region, type of benefit, duration of a case, cause of discontinuation | 1995–2002 | no |
| [DAGP7](https://www.statbank.dk/DAGP7) | Benefit cases, all concluded cases by region, type of benefit, duration of a case, occupation | 1995–1996 | no |
| [DAGP7A](https://www.statbank.dk/DAGP7A) | Benefit cases, all concluded cases by region, type of benefit, duration of a case, socioeconomic status | 1997–2002 | no |
| [DAGP7X](https://www.statbank.dk/DAGP7X) | Amounts, all concluded cases by region, type of benefit, duration of a case, occupation | 1995–1996 | no |
| [DAGP7Y](https://www.statbank.dk/DAGP7Y) | Amounts, all concluded cases by region, type of benefit, duration of a case, socioeconomic status | 1997–2002 | no |
| [DAGP8](https://www.statbank.dk/DAGP8) | Benefit cases, all concluded cases by region, type of benefit, duration of a case, sex, age | 1995–2002 | no |
| [DAGP8X](https://www.statbank.dk/DAGP8X) | Amounts, all concluded cases by region, type of benefit, duration of a case, sex, age | 1995–2002 | no |
| [DAGP9](https://www.statbank.dk/DAGP9) | Benefit cases, all concluded cases by region, type of benefit, cause of discontinuation, age | 1995–2002 | no |
| [FORHJBE](https://www.statbank.dk/FORHJBE) | Preventative home visits (previous year) by region, kind, age | 2000–2006 | no |
| [KH1](https://www.statbank.dk/KH1) | Families receiving cash benefits by region, type of benefits, family type, age | 1982–1994 | no |
| [KH1R](https://www.statbank.dk/KH1R) | Persons receiving cash benefits by region, type of benefits, family type, age | 1994–2006 | no |
| [KH2](https://www.statbank.dk/KH2) | Cash benefits in DKK 1000 by region, type of benefits | 1982–1994 | no |
| [KH2R](https://www.statbank.dk/KH2R) | Cash benefits in DKK 1000 by region, type of benefits | 1994–2006 | no |
| [KONT1X](https://www.statbank.dk/KONT1X) | Receivers of cash benefits (monthly, persons) by region, type of benefits | 1994M01–2006M12 | no |
| [KONT2X](https://www.statbank.dk/KONT2X) | Cash benefits (monthly) by region, type of benefits | 1994M01–2006M12 | no |
| [MH1](https://www.statbank.dk/MH1) | Recipients of temporary home help (previous year) by region, frequency of benefits, age | 2003–2005 | no |
| [MH1X](https://www.statbank.dk/MH1X) | Recipients of temporary home help (previous year) by region, frequency of benefits, age | 1982–2002 | no |
| [PEN1](https://www.statbank.dk/PEN1) | Recipients of social pensions, etc. by region, kind of pension, residential nursing homes, age, sex | 1984–2006 | no |
| [PEN2](https://www.statbank.dk/PEN2) | Social pension payment in 1000 DKK by region, kind of pension, type of amount, marital status, sex | 1984–2006 | no |
| [PEN3](https://www.statbank.dk/PEN3) | Recipients of social pension by region, kind of pension, type of amount, marital status, sex | 1984–2006 | no |
| [RES1](https://www.statbank.dk/RES1) | Social measures by region, type of measure | 1983–2003 | no |
| [RES10XX](https://www.statbank.dk/RES10XX) | Staff in measures for elderly people, full-time employees by region, function | 2000–2006 | no |
| [RES2](https://www.statbank.dk/RES2) | Staff at social measures by region, type of measure, type of staff | 1983–1993 | no |
| [RES2N](https://www.statbank.dk/RES2N) | Staff at social measures, full-time employees by region, type of measure, type of staff | 1994–2000 | no |
| [RES3](https://www.statbank.dk/RES3) | Places in social measures by region, type of measure, number of places | 1987–2000 | no |
| [RES3EX](https://www.statbank.dk/RES3EX) | Places in social measures by region, type of measure, number of places | 2001–2006 | no |
| [RES3N](https://www.statbank.dk/RES3N) | Places in social measures by region, type of measure, number of places | 2001–2006 | no |
| [RES3NX](https://www.statbank.dk/RES3NX) | Places in social measures by region, type of measure, number of places | 2001–2005 | no |
| [RES4](https://www.statbank.dk/RES4) | Clients in social measures by region, type of measure, type of client | 1987–2002 | no |
| [RES6](https://www.statbank.dk/RES6) | Clients in nursing homes (83-98) by region, age | 1983–1998 | no |
| [RES6A](https://www.statbank.dk/RES6A) | Clients in nursing dwellings and dwellings for the elderly by region, age, type of measure | 1999–2003 | no |
| [RES6BX](https://www.statbank.dk/RES6BX) | Clients in nursing dwellings and dwellings for the elderly by region, age, type of measure | 2004–2006 | no |
| [SAM1](https://www.statbank.dk/SAM1) | Recipients of transfer payments by region, type of benefits, age, sex, family type | 1984–2005 | no |
| [SAM2](https://www.statbank.dk/SAM2) | Transfer payment paid by region, type of benefits, age, sex, family type | 1984–2005 | no |
| [SAM4](https://www.statbank.dk/SAM4) | Families by region, type of benefits, family type, amount | 1991–2002 | no |
| [SAM5](https://www.statbank.dk/SAM5) | Recipients under 60 years of temp. transfer payments for at least half a year by region, type of benefits, age, sex, family type | 1984–2005 | no |
| [SAM7](https://www.statbank.dk/SAM7) | Full-time recipients of transfer payments by region, type of benefits, age, sex | 1984–2005 | no |
| [STRAF1](https://www.statbank.dk/STRAF1) | Reported criminal offences by region, type of offence | 1995Q1–2006Q4 | no |
| [STRAF2](https://www.statbank.dk/STRAF2) | Reported criminal offences and charges by region, type of offence, reported criminal offences and charges | 1995–2006 | no |
| [VH1A](https://www.statbank.dk/VH1A) | Recipients of permanent home help by region, age, scope | 1982–1984 | no |
| [VH1B](https://www.statbank.dk/VH1B) | Recipients of permanent home help by region, age, scope | 1985–1998 | no |
| [VH2](https://www.statbank.dk/VH2) | Recipients of permanent home help in nursing homes and protected dwellings by region, type of benefits | 2002–2006 | no |
| [VH3](https://www.statbank.dk/VH3) | Private suppliers of home help by region | 2004–2006 | no |
| [VH4](https://www.statbank.dk/VH4) | Persons, who are embraced by free choice/users of permanent home help done by region, type of measure, type of help, age | 2004–2006 | no |
| [VHLT](https://www.statbank.dk/VHLT) | Delivered hours per week for permanent home help by region, type of benefits, age | 2006 | no |
| [VHLT04X](https://www.statbank.dk/VHLT04X) | Delivered hours per week for permanent home help by region, type of benefits, age | 2004 | no |
| [VHLT05X](https://www.statbank.dk/VHLT05X) | Delivered hours per week for permanent home help by region, type of benefits, age | 2005 | no |
| [VHP](https://www.statbank.dk/VHP) | Number of recipients of permanent home help by region, type of benefits, age, scope | 2006 | no |
| [VHP04X](https://www.statbank.dk/VHP04X) | Number of recipients of permanent home help by region, type of benefits, age, scope | 2004 | no |
| [VHP05X](https://www.statbank.dk/VHP05X) | Number of recipients of permanent home help by region, type of benefits, age, scope | 2005 | no |
| [VHPX](https://www.statbank.dk/VHPX) | Number of recipients of permanent home help by region, type of benefits, age, scope | 1999–2003 | no |
| [VHTT](https://www.statbank.dk/VHTT) | Allotted hours per week for permanent home help by region, type of benefits, age | 1999–2003 | no |
| [BIL1](https://www.statbank.dk/BIL1) | Number of private cars by region, size of car, manufacture, job title | 1991–1996 | no |
| [BIL1A](https://www.statbank.dk/BIL1A) | Number of private cars by region, size of car, manufacture, job title | 1997–2004 | no |
| [BIL3](https://www.statbank.dk/BIL3) | Number of households by region, use of cars, type of household | 1992–2004 | no |
| [BIL4](https://www.statbank.dk/BIL4) | Number of households by region, use of cars, income interval | 1991–2004 | no |
| [BIL60](https://www.statbank.dk/BIL60) | Families purchase of vehicles by region, type of purchase, patteren of purchase | 1999–2006 | no |
| [BIL61](https://www.statbank.dk/BIL61) | Families purchase of vehicles by region, unit, type of purchase, patteren of purchase | 1999–2006 | no |
| [BIL7](https://www.statbank.dk/BIL7) | Stock of vehicles per 1 January by region, type of vehicle | 1993–2007 | no |
| [BIL80](https://www.statbank.dk/BIL80) | Families disposal of vehicles by region, pattern of availability | 2000–2007 | no |
| [BIL81](https://www.statbank.dk/BIL81) | Families disposal of vehicles by region, unit, pattern of availability | 2000–2007 | no |
| [BIL9](https://www.statbank.dk/BIL9) | Stock on trailers per 1 January by region, ownership | 1993–2007 | no |
| [UHELD1](https://www.statbank.dk/UHELD1) | Injured and killed in road traffic accidents by region, casualty, motor vehicles involved, age, sex | 1993–2006 | no |
| [UHELD7](https://www.statbank.dk/UHELD7) | Road traffic accidents by type of accident, municipality, urban area, accident situation | 1997–2006 | no |

</details>

<details><summary>deanery: 11 tables (10 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [KM11](https://www.statbank.dk/KM11) | Population at the first day of the quarter by deanary, member of the National Church | 2007Q1–2026Q3 | yes |
| [KM22](https://www.statbank.dk/KM22) | Registration and resignation from the national church by deanary, age, member of the National Church | 2007Q1–2026Q2 | yes |
| [KM33](https://www.statbank.dk/KM33) | Live births and deaths by deanary, movement | 2007Q1–2026Q2 | yes |
| [KM44](https://www.statbank.dk/KM44) | Religious ceremonies by deanary, movement | 2006–2025 | yes |
| [KM55](https://www.statbank.dk/KM55) | Population 1. January by deanary, sex, age, member of the National Church | 2007–2026 | yes |
| [KMST008A](https://www.statbank.dk/KMST008A) | Population 1. October (15 years+) by deanary, member of the National Church, highest education completed | 2015–2025 | yes |
| [KMSTA002](https://www.statbank.dk/KMSTA002) | Population 1. January by deanary, ancestry, member of the National Church | 2008–2026 | yes |
| [KMSTA004](https://www.statbank.dk/KMSTA004) | Summary vital statistics by deanary, movements | 2015–2025 | yes |
| [KMSTA006](https://www.statbank.dk/KMSTA006) | Population 1. January (15 years+) by deanary, socioeconomic status, member of the National Church | 2016–2025 | yes |
| [KMSTA010](https://www.statbank.dk/KMSTA010) | Population 1. January (15 years+) by deanary, member of the National Church, commuting | 2016–2025 | yes |
| [KMSTA008](https://www.statbank.dk/KMSTA008) | Population 1. January (15 years+) by deanary, member of the National Church, highest education completed | 2016–2019 | no |

</details>

<details><summary>multi-member constituency: 6 tables (1 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [FV26KAND](https://www.statbank.dk/FV26KAND) | Personal votes of the candidates to the Danish Parliament by candidates, result of the election, political party, region | 2026 | yes |
| [FV07KAND](https://www.statbank.dk/FV07KAND) | Personal votes of the candidates by candidates, result of the election, political party, region | 2007 | no |
| [FV11KAND](https://www.statbank.dk/FV11KAND) | Personal votes of the candidates by candidates, result of the election, political party, region | 2011 | no |
| [FV15KAND](https://www.statbank.dk/FV15KAND) | Personal votes of the candidates by candidates, result of the election, political party, region | 2015 | no |
| [FV19KAND](https://www.statbank.dk/FV19KAND) | Personal votes of the candidates by candidates, result of the election, political party, region | 2019 | no |
| [FV22KAND](https://www.statbank.dk/FV22KAND) | Personal votes of the candidates by candidates, result of the election, political party, region | 2022 | no |

</details>

<details><summary>county (pre-2007): 99 tables (1 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [BDF1974](https://www.statbank.dk/BDF1974) | Farms (historical) by county, area | 1970–1981 | yes |
| [AFG](https://www.statbank.dk/AFG) | Cultivated area by county, unit, crop | 1982–2006 | no |
| [AFG2](https://www.statbank.dk/AFG2) | Farms and area with selected crops by region, Area with the crop, unit | 1982–2006 | no |
| [AGRO3](https://www.statbank.dk/AGRO3) | Winter green fields by region, crop | 1988:1989–2003:2004 | no |
| [AGRO7](https://www.statbank.dk/AGRO7) | Storage facilities for manure by region, type | 1996–2006 | no |
| [BDF](https://www.statbank.dk/BDF) | Farms by county, type, type of farm, area | 1982–2006 | no |
| [BDF1](https://www.statbank.dk/BDF1) | Farms by county, type, age | 1982–2006 | no |
| [BDF2](https://www.statbank.dk/BDF2) | Farms with area in tenancy by county, type, area | 1982–2006 | no |
| [BDF3](https://www.statbank.dk/BDF3) | Employment in agriculture by county, unit, type, hours of work | 1999–2005 | no |
| [BDF8](https://www.statbank.dk/BDF8) | Holdings by region, work outside the farm | 1999–2005 | no |
| [BDF9](https://www.statbank.dk/BDF9) | Farms with non-agricultural activities by county, activity | 1998–2005 | no |
| [BRUG2](https://www.statbank.dk/BRUG2) | Livestock farms by region, type of farm, kind | 1990–2006 | no |
| [BRUG4](https://www.statbank.dk/BRUG4) | Livestock units by region, category | 1990–2006 | no |
| [BRUG6](https://www.statbank.dk/BRUG6) | Farms by region, type of farm, kind | 1990–2006 | no |
| [DEMO4X](https://www.statbank.dk/DEMO4X) | Business Demography by county, industry (9-grouping), unit | 2001–2006 | no |
| [ERH4](https://www.statbank.dk/ERH4) | Workplaces by region, industry, size | 1980–1992 | no |
| [FRED](https://www.statbank.dk/FRED) | The yearly preservations by region and sea water. by region | 1917-1980–2000 | no |
| [FRED1](https://www.statbank.dk/FRED1) | Protected nature by region, type | 1996 | no |
| [FRED2](https://www.statbank.dk/FRED2) | Bird protection areas by region, type | 1995 | no |
| [GF4X](https://www.statbank.dk/GF4X) | General enterprise statistics by region, industry (9-grouping), unit | 1999–2006 | no |
| [HALM](https://www.statbank.dk/HALM) | Straw yield and use by region, crop, unit, use | 1997–2006 | no |
| [HDYR](https://www.statbank.dk/HDYR) | Livestock by county, unit, type | 1982–2006 | no |
| [HST7](https://www.statbank.dk/HST7) | Harvest by region, crop, unit | 1990–2006 | no |
| [KOMB](https://www.statbank.dk/KOMB) | Livestock combination by county, type, unit | 1982–2006 | no |
| [LHUS1](https://www.statbank.dk/LHUS1) | Agricultural household income by region, full-time/part-time, type of income | 2000–2004 | no |
| [MASK](https://www.statbank.dk/MASK) | Machines and farms with machines by county, area, unit, type | 1982–2005 | no |
| [MOMS10](https://www.statbank.dk/MOMS10) | Business units registered for VAT settlement: stock changes by industry, region, movement | 1992–1999 | no |
| [MOMS4](https://www.statbank.dk/MOMS4) | Momsregistrerede virksomheders bevægelser efter branche, område, bevægelse og tid | 1980–1992 | no |
| [REGN4](https://www.statbank.dk/REGN4) | Accounts statistics by region, industry, items | 1995–2006 | no |
| [SKOV5](https://www.statbank.dk/SKOV5) | Felling in forest and plantation in Denmark by region, species of wood | 1990–2006 | no |
| [TUR1](https://www.statbank.dk/TUR1) | Nights spent at hotels and holiday resorts by region, citizenship, type | 2005M01–2006M12 | no |
| [TUR11](https://www.statbank.dk/TUR11) | Nights spent at hotels and holiday resorts by region, citizenship | 1988M01–2006M12 | no |
| [TUR2](https://www.statbank.dk/TUR2) | Hotels and holiday resorts by region, capacity, type | 2005M01–2006M12 | no |
| [TUR22](https://www.statbank.dk/TUR22) | Hotels and holiday resorts by region, capacity | 1988M01–2006M12 | no |
| [TUR3](https://www.statbank.dk/TUR3) | Nights spent at camping sites by region, citizenship | 1988M03–2006M12 | no |
| [TUR6](https://www.statbank.dk/TUR6) | Contracts, weeks of rental and nights spent in holiday dwellings by region, citizenship, type | 1989:1990–1996:1997 | no |
| [TUR7](https://www.statbank.dk/TUR7) | Contracts, weeks of rental and nights spent in holiday dwellings by region, citizenship, type | 1998–2006 | no |
| [TUR8](https://www.statbank.dk/TUR8) | Nights spent at marinas with overnight accommodations by region, citizenship, season | 1994–2006 | no |
| [TUR9](https://www.statbank.dk/TUR9) | Nights spent in Youth Hostels by region, citizenship | 1997M01–2006M12 | no |
| [EJEN7](https://www.statbank.dk/EJEN7) | Sales of real property by region, category of real property, key figures, type of transfer | 2002Q1–2006Q4 | no |
| [EJEN8](https://www.statbank.dk/EJEN8) | Sales of real property by region, category of real property, key figures, type of transfer | 2002–2006 | no |
| [EJEN9](https://www.statbank.dk/EJEN9) | Price index for one-family houses by region | 1992–2006 | no |
| [RNAT1](https://www.statbank.dk/RNAT1) | GDP (DKK million) and GDP per capita (DKK 1000) by region, type, price unit | 1993–2006 | no |
| [RNAT1X](https://www.statbank.dk/RNAT1X) | GDP (DKK million) and GDP per capita (DKK 1000) by region, type, price unit | 1993–2003 | no |
| [RNAT2](https://www.statbank.dk/RNAT2) | Gross value added (DKK million) by region, industry, price unit | 1993–2006 | no |
| [RNAT2X](https://www.statbank.dk/RNAT2X) | Gross value added (DKK million) by region, industry, price unit | 1993–2003 | no |
| [RNAT3](https://www.statbank.dk/RNAT3) | Compensation of employees and total employment (DKK million/persons) by region, industry, type | 1993–2006 | no |
| [RNAT3X](https://www.statbank.dk/RNAT3X) | Compensation of employees and total employment (DKK million/persons) by region, industry, type | 1993–2003 | no |
| [AFGANG1](https://www.statbank.dk/AFGANG1) | From primary and lower secondary school to further education by cohort, school leaving certificate, county district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2004–2005 | no |
| [AFGANG2](https://www.statbank.dk/AFGANG2) | From general upper secondary school leaving certificate to further education by cohort, school leaving certificate, county district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2004–2005 | no |
| [AFGANG3](https://www.statbank.dk/AFGANG3) | From vocational upper secondary school leaving certificate to further education by cohort, school leaving certificate, county district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2004–2005 | no |
| [ELEV](https://www.statbank.dk/ELEV) | Enrolled at folk high schools and youth folk high schools by region, highest education completed, type of course, age, sex | 1982–2001 | no |
| [EUD1X](https://www.statbank.dk/EUD1X) | Enrolled, vocational education and training by county, education, age, enrolment type, ancestry, sex | 1997–2006 | no |
| [EUD2X](https://www.statbank.dk/EUD2X) | Entrants, vocational education and training by county, education, age, enrolment type, ancestry, sex | 1997–2006 | no |
| [EUD3X](https://www.statbank.dk/EUD3X) | Number of drop-outs in vocational education and training by county, education, age, enrolment type, ancestry, sex | 1997–2006 | no |
| [EUD4X](https://www.statbank.dk/EUD4X) | Graduates, vocational education and training by county, education, age, enrolment type, ancestry, sex | 1997–2006 | no |
| [U191](https://www.statbank.dk/U191) | Enrolled, upper secondary school by education, region, ancestry, national origin, sex | 2001–2005 | no |
| [U291](https://www.statbank.dk/U291) | Entrants, upper secondary school by education, region, ancestry, national origin, sex | 2001–2005 | no |
| [U391](https://www.statbank.dk/U391) | Graduates, upper secondary school by education, region, ancestry, national origin, sex | 2001–2005 | no |
| [VUC1](https://www.statbank.dk/VUC1) | Kursusdeltagelse, VUC efter fag, område, resultat, køn og tid | 1979–1998 | no |
| [VUC2](https://www.statbank.dk/VUC2) | Persons by region, level of education, age, sex | 1979–1998 | no |
| [MREG3](https://www.statbank.dk/MREG3) | Expenditure by type, kind | 1992–2004 | no |
| [VAND1](https://www.statbank.dk/VAND1) | Consumption of drinking water by region, use | 1982–2005 | no |
| [VAND2](https://www.statbank.dk/VAND2) | Quality of drinking water from waterworks by region, nitrate content | 1982–2006 | no |
| [VAND3](https://www.statbank.dk/VAND3) | Quality of drinking water from water supply borings (pesticides) by region, drilling | 1993–2004 | no |
| [AB123](https://www.statbank.dk/AB123) | Unemployed persons by region, category of insurance, citizenship, marital status, age, sex | 1995Q1–2001Q3 | no |
| [AB612](https://www.statbank.dk/AB612) | Average number of unemployed (seasonally adjusted) by region, persons/pct. | 1996M01–1999M12 | no |
| [AB612X](https://www.statbank.dk/AB612X) | Average number of unemployed (seasonally adjusted) by region, persons/pct. | 1988M01–1995M12 | no |
| [IA811A](https://www.statbank.dk/IA811A) | Income (personal) by region, age, sex, type of income | 1999–2003 | no |
| [LON03](https://www.statbank.dk/LON03) | Earnings for employees in the private sector by region, group of employees, components, sex | 1997–2006 | no |
| [LON33](https://www.statbank.dk/LON33) | Earnings for central government employees by region, components, sex | 1996–2006 | no |
| [LON43](https://www.statbank.dk/LON43) | Earnings for local government employees by region, components, sex | 1996–2006 | no |
| [RAS34X](https://www.statbank.dk/RAS34X) | Labour force aged 16-66 by region, citizenship, marital status, age, sex | 1981–1999 | no |
| [AKVA3X](https://www.statbank.dk/AKVA3X) | Elections to county councils by region, political party, votes cast/candidates/sex | 1989–2001 | no |
| [FLY5](https://www.statbank.dk/FLY5) | Internal migration between counties by sex, age, final county, county of departure | 1980–2005 | no |
| [FOD5](https://www.statbank.dk/FOD5) | Deaths by region, cause of death, age, sex | 1981–2006 | no |
| [FOD6](https://www.statbank.dk/FOD6) | Abortions by region, age | 1981–2006 | no |
| [PA2](https://www.statbank.dk/PA2) | Hospital patients by region, cause of hospitalization, job title, age, sex | 1991–1996 | no |
| [PA2A](https://www.statbank.dk/PA2A) | Hospital patients by region, cause of hospitalization, job title, age, sex | 1997–2005 | no |
| [PA3](https://www.statbank.dk/PA3) | Hospital patients by region, cause of hospitalization, family attachment, age, sex | 1991–2005 | no |
| [PA4](https://www.statbank.dk/PA4) | Hospital patients by region, cause of hospitalization, education, age, sex | 1991–1997 | no |
| [PA4A](https://www.statbank.dk/PA4A) | Hospital patients by region, cause of hospitalization, education, age, sex | 1998–2005 | no |
| [PA5](https://www.statbank.dk/PA5) | Hospital patients by region, cause of hospitalization, income interval, age, sex | 1991–2005 | no |
| [RES9](https://www.statbank.dk/RES9) | Childcare guarantee by region, child care | 2004 | no |
| [UD1](https://www.statbank.dk/UD1) | Admissions by diagnosis, emergency/non-emergency, region, age, sex | 1991–2005 | no |
| [UD2](https://www.statbank.dk/UD2) | Admissions by diagnosis, emergency/non-emergency, region, age, sex | 1991–2005 | no |
| [UD3A](https://www.statbank.dk/UD3A) | Admissions, hospital patients and bed-days by region, key figures, age, sex, diagnosis | 2002–2005 | no |
| [BIS6](https://www.statbank.dk/BIS6) | Children and young persons 31st December by county, age, total duration of placement | 2001–2005 | no |
| [BIS7](https://www.statbank.dk/BIS7) | Children and young persons ,concluded cases, by county, age, duration of last placement | 2001–2005 | no |
| [BIS8](https://www.statbank.dk/BIS8) | Children and young persons with social assistance 31st December by region, age, Measure | 2001–2005 | no |
| [BIS9](https://www.statbank.dk/BIS9) | Children and young persons placed outside of own home 31st December by county, Measure | 2001–2005 | no |
| [BANE23](https://www.statbank.dk/BANE23) | National rail transport of passengers between regions by region(1), region(2) | 1996–2002 | no |
| [BANE4](https://www.statbank.dk/BANE4) | National rail transport of goods by unit, region of loading, region of  unloading | 2000–2006 | no |
| [NVG2](https://www.statbank.dk/NVG2) | National transport of goods by road between regions by unit, region of loading, region of  unloading, type of goods | 1999–2006 | no |
| [NVG3](https://www.statbank.dk/NVG3) | National transport of dangerous goods by road by unit, region of loading, region of  unloading, type of goods | 1999–2006 | no |
| [SKIB46](https://www.statbank.dk/SKIB46) | Throughput of goods in national traffic in Danish ports by seaport, direction, region | 1997–2006 | no |
| [SKIB48](https://www.statbank.dk/SKIB48) | Maritime transport of goods between Danish counties by region of loading, region of  unloading, unit | 1998–2006 | no |
| [UHELD2](https://www.statbank.dk/UHELD2) | Injured and killed in alcohol accidents by county, casualty, age, sex | 1993–2006 | no |
| [VEJ1](https://www.statbank.dk/VEJ1) | Road network 1st January by county, type of road | 1990–2007 | no |

</details>

<details><summary>province (landsdel): 274 tables (113 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [AFG207](https://www.statbank.dk/AFG207) | Farms and area with selected crops by region, Area with the crop, unit | 2006–2025 | yes |
| [AFG5](https://www.statbank.dk/AFG5) | Cultivated area by region, unit, crop | 2006–2026 | yes |
| [BDF107](https://www.statbank.dk/BDF107) | Farms by region, type, age | 2006–2025 | yes |
| [BDF11](https://www.statbank.dk/BDF11) | Farms by region, unit, type of farm, area | 2010–2025 | yes |
| [BDF207](https://www.statbank.dk/BDF207) | Farms with area in tenancy by region, type, area | 2006–2025 | yes |
| [BDF307](https://www.statbank.dk/BDF307) | Employment in agriculture and horticulture by region, unit, type, hours of work | 2007–2023 | yes |
| [BDF807](https://www.statbank.dk/BDF807) | Farms by region, work outside the farm | 2007–2023 | yes |
| [BDF907](https://www.statbank.dk/BDF907) | Farms with non-agricultural activities by region, activity | 2007–2023 | yes |
| [BEST11](https://www.statbank.dk/BEST11) | Board members and managers by type, sex, education, age, residence province | 2019–2024 | yes |
| [FERIEH3](https://www.statbank.dk/FERIEH3) | Letting of holiday houses by region, nationality of the guest, unit | 1992–2025 | yes |
| [FERIEH6](https://www.statbank.dk/FERIEH6) | Letting of holiday houses, monthly by region, nationality of the guest, unit, period | 2017–2026 | yes |
| [GROV88](https://www.statbank.dk/GROV88) | Harvest of forage by province, crop, unit | 2025 | yes |
| [HALM2](https://www.statbank.dk/HALM2) | Straw yield and straw use by province, crop, unit, use | 2025 | yes |
| [HDYR07](https://www.statbank.dk/HDYR07) | Farms with livestock by region, unit, type | 2006–2025 | yes |
| [HOTEL1](https://www.statbank.dk/HOTEL1) | Nights spent at hotels and holiday resorts by region, nationality of the guest, unit, period | 1992–2026 | yes |
| [HOTEL3](https://www.statbank.dk/HOTEL3) | Hotels and holiday resorts by region, capacity | 1992M01–2026M08 | yes |
| [HOTEL4](https://www.statbank.dk/HOTEL4) | Hotels and holiday resorts by region, capacity | 1992–2025 | yes |
| [HOTEL7](https://www.statbank.dk/HOTEL7) | Nights spent at hotels and holiday resorts by region, purpose of visit, period | 2004–2026 | yes |
| [HST88](https://www.statbank.dk/HST88) | Harvesting of grain, rapeseed and pulses by province, crop, unit | 2025 | yes |
| [JORD1](https://www.statbank.dk/JORD1) | Profit and loss accounts for all farms (average) by type of farm region standard output, quartile group, items | 2008–2025 | yes |
| [JORD6](https://www.statbank.dk/JORD6) | Key indicators for all farms (average) by type of farm region standard output, quartile group, items | 2008–2025 | yes |
| [KOMB07](https://www.statbank.dk/KOMB07) | Livestock combination by region, type, unit | 2006–2025 | yes |
| [KVAEG5](https://www.statbank.dk/KVAEG5) | Number of cattle by region, type | 2008Q1–2026Q2 | yes |
| [LYST1](https://www.statbank.dk/LYST1) | Nights spent at marinas with overnight accommodations by region, nationality of the guest, period | 1992–2026 | yes |
| [LYST10](https://www.statbank.dk/LYST10) | Nights spent at marinas with overnight accommodations by region, nationality of the guest, period, type of overnight accommodations | 1992–2025 | yes |
| [LYST13](https://www.statbank.dk/LYST13) | Marians by region, capacity | 1992–2025 | yes |
| [REGN80](https://www.statbank.dk/REGN80) | Accounts statistics (DB07) by region, industry, items | 2019–2024 | yes |
| [SKOV11](https://www.statbank.dk/SKOV11) | Forestry area by region, forest area | 1990–2023 | yes |
| [SKOV55](https://www.statbank.dk/SKOV55) | Felling in forest and plantation in Denmark by region, species of wood | 2006–2024 | yes |
| [TURIST](https://www.statbank.dk/TURIST) | Overnight stay by type of overnight accommodations, region, nationality of the guest, period | 1992–2026 | yes |
| [TURIST2](https://www.statbank.dk/TURIST2) | Guests by type of overnight accommodations, region, nationality of the guest, period | 2018–2026 | yes |
| [TURIST4](https://www.statbank.dk/TURIST4) | Overnight stay by type of overnight accommodations, region, nationality of the guest | 2016–2025 | yes |
| [VANDRER](https://www.statbank.dk/VANDRER) | Nights spent in Youth Hostels by region and citizenship by region, nationality of the guest, period | 1998–2026 | yes |
| [VHUS1](https://www.statbank.dk/VHUS1) | Greenhouses by region, structure | 1993–2023 | yes |
| [ARKIV02B](https://www.statbank.dk/ARKIV02B) | Activity and staffing of the city and local archives by region, key figures | 2016–2025 | yes |
| [BIO9](https://www.statbank.dk/BIO9) | Cinemas by region, key figures, size of cinema | 2014–2025 | yes |
| [KUBS02B](https://www.statbank.dk/KUBS02B) | Payments by the Ministry of Culture by region, cultural domains, financing type, state institution, unit | 2017–2023 | yes |
| [KUBS04B](https://www.statbank.dk/KUBS04B) | Payments by the Ministry of Culture targeted children and young people by region, cultural domains, financing type, state institution, unit | 2017–2023 | yes |
| [KUBS09B](https://www.statbank.dk/KUBS09B) | Payments by the Ministry of Culture targeted research by region, cultural domains, financing type, state institution, unit | 2017–2023 | yes |
| [KUBS10B](https://www.statbank.dk/KUBS10B) | Payments by the Ministry of Culture targeted education by region, cultural domains, financing type, state institution, unit | 2017–2023 | yes |
| [KUIV2](https://www.statbank.dk/KUIV2) | Cultural Business Demography by area, unit | 2008–2023 | yes |
| [LIVMUS04](https://www.statbank.dk/LIVMUS04) | Number of Concert Organizers by organizertype, sector, province | 2018–2024 | yes |
| [MUS3](https://www.statbank.dk/MUS3) | Activity at Danish museum sites by region, category of museum, type of museum, activity | 2016–2025 | yes |
| [SCENE09A](https://www.statbank.dk/SCENE09A) | Danish theatres tour in Denmark by region, category of theatre, activity, genre | 2020/2021–2024/2025 | yes |
| [EJ56](https://www.statbank.dk/EJ56) | Price index for sales of property by region, category of real property, unit | 1992Q1–2026Q2 | yes |
| [EJ67](https://www.statbank.dk/EJ67) | Price index for sales property by region, category of real property, unit | 1992–2025 | yes |
| [EJ99](https://www.statbank.dk/EJ99) | Price index for housing cooperatives and owner-occupied housing by region, type of dwelling, unit | 2015Q1–2026Q2 | yes |
| [EJEN77](https://www.statbank.dk/EJEN77) | Sales of real property by region, category of real property, key figures, type of transfer | 1992Q1–2026Q2 | yes |
| [EJEN88](https://www.statbank.dk/EJEN88) | Sales of real property by region, category of real property, key figures, type of transfer | 1992–2025 | yes |
| [NRBB10](https://www.statbank.dk/NRBB10) | Employment (10a3-grouping) by region, socioeconomic status, industry | 1993–2024 | yes |
| [NRBI10](https://www.statbank.dk/NRBI10) | Gross fixed capital formation (10a3-grouping) by region, industry, price unit | 2000–2023 | yes |
| [NRBP10](https://www.statbank.dk/NRBP10) | 1-2.1.1 Production  and generation of income (10a3-grouping) by region, transaction, industry, price unit | 1993–2024 | yes |
| [NRHB](https://www.statbank.dk/NRHB) | Population by region, socioeconomic status | 1993–2024 | yes |
| [NRHP](https://www.statbank.dk/NRHP) | 1-2.1.1 Production, GDP and generation of income by region, transaction, price unit | 1993–2024 | yes |
| [NRS](https://www.statbank.dk/NRS) | Households' income by region, transaction, price unit | 2000–2024 | yes |
| [VNRBB10](https://www.statbank.dk/VNRBB10) | Versionstable NABB10 - Employment (10a3-grouping) by version, region, socioeconomic status, industry | 1993–2024 | yes |
| [VNRBP10](https://www.statbank.dk/VNRBP10) | Versionstable NRBP10 Production  and generation of income (10a3-grouping) by version, region, transaction, industry, price unit | 1993–2024 | yes |
| [VNRHP](https://www.statbank.dk/VNRHP) | Versionstable NRHP - Production, GDP and generation of income by version, region, transaction, price unit | 1993–2024 | yes |
| [VNRS](https://www.statbank.dk/VNRS) | Versionstable NRS - Households' income by version, region, transaction, price unit | 2000–2024 | yes |
| [FOHOJ04](https://www.statbank.dk/FOHOJ04) | Participation at folk high schools by type of course, residence province, sex, institution, unit, points in time | 2016–2025 | yes |
| [AREALAN1](https://www.statbank.dk/AREALAN1) | Land use by industry (19a2-grouping), region, unit | 2016 | yes |
| [AUL03](https://www.statbank.dk/AUL03) | Full-time unemployed persons by region, country of origin, sex | 2007–2025 | yes |
| [AUL08](https://www.statbank.dk/AUL08) | Full-time unemployed persons by region, persons/pct., highest education completed, age, sex | 2007–2025 | yes |
| [AULK03](https://www.statbank.dk/AULK03) | Full-time unemployed persons by region, country of origin, sex | 2007Q1–2026Q2 | yes |
| [AULP03](https://www.statbank.dk/AULP03) | Full-time unemployed persons in per cent of the labour force by region, country of origin, sex | 2007–2024 | yes |
| [INDKF102](https://www.statbank.dk/INDKF102) | Income by region, unit, owner/ tenant of dwelling, family type, income interval | 2000–2024 | yes |
| [INDKP104](https://www.statbank.dk/INDKP104) | Income, persons by part of the country, unit, sex, socioeconomic status, type of income | 1994–2024 | yes |
| [INDKP109](https://www.statbank.dk/INDKP109) | Income for people (14 years+) by region/province, unit, sex, age, ancestry, type of income | 2008–2025 | yes |
| [INDKP111](https://www.statbank.dk/INDKP111) | Income by region/province, unit, sex, age, type of income | 1992–2025 | yes |
| [LBESK30](https://www.statbank.dk/LBESK30) | Employees (seasonally adjusted) by unit, workplace regionpart | 2008Q1–2025Q3 | yes |
| [LBESK300](https://www.statbank.dk/LBESK300) | Employees  (seasonally adjusted) by unit, workplace regionpart, sector | 2018Q1–2026Q2 | yes |
| [LBESK31](https://www.statbank.dk/LBESK31) | Employees by unit, workplace regionpart, industry (DB07 10-grouping) | 2008Q1–2025Q4 | yes |
| [LBESK312](https://www.statbank.dk/LBESK312) | Employees by unit, residence province, industry (DB25 10- and 20-grouping), sex | 2018Q1–2026Q2 | yes |
| [LBESK33](https://www.statbank.dk/LBESK33) | Employees by unit, workplace regionpart, sector | 2008Q1–2025Q4 | yes |
| [LBESK332](https://www.statbank.dk/LBESK332) | Employees by unit, residence province, sex, sector | 2018Q1–2026Q2 | yes |
| [LBESK333](https://www.statbank.dk/LBESK333) | Employees by unit, workplace regionpart, sector, sex | 2018Q1–2026Q2 | yes |
| [LBESK350](https://www.statbank.dk/LBESK350) | Employees by unit, workplace regionpart, sex, age | 2018Q1–2026Q2 | yes |
| [LBESK351](https://www.statbank.dk/LBESK351) | Employees by unit, workplace regionpart, sex, ancestry | 2018Q1–2026Q2 | yes |
| [LBESK352](https://www.statbank.dk/LBESK352) | Employees by unit, residence province, sex, age | 2018Q1–2026Q2 | yes |
| [LBESK353](https://www.statbank.dk/LBESK353) | Employees by unit, residence province, sex, ancestry | 2018Q1–2026Q2 | yes |
| [LBESK44](https://www.statbank.dk/LBESK44) | Employees by unit, residence province, sex, age | 2008Q1–2025Q4 | yes |
| [LBESK45](https://www.statbank.dk/LBESK45) | Employees by unit, residence province, sex, ancestry | 2008Q1–2025Q4 | yes |
| [LBESK63](https://www.statbank.dk/LBESK63) | Employees by unit, workplace regionpart, sex, age | 2008Q1–2025Q4 | yes |
| [LBESK64](https://www.statbank.dk/LBESK64) | Employees by unit, workplace regionpart, sex, ancestry | 2008Q1–2025Q4 | yes |
| [LBESK67](https://www.statbank.dk/LBESK67) | Employees by unit, residence province, sector, sex, age | 2008Q1–2025Q4 | yes |
| [LBESK68](https://www.statbank.dk/LBESK68) | Employees by unit, residence province, industry (DB07 19-grouping), sex, age | 2008Q1–2025Q4 | yes |
| [RASIE22](https://www.statbank.dk/RASIE22) | Labour force to calculate unemployment rates (ultimo november) by ancestry, country of origin, region | 2007–2024 | yes |
| [FLYUNG3](https://www.statbank.dk/FLYUNG3) | Migration among young people (15-29 years) by type of move, out-migration province, age groups | 2007–2025 | yes |
| [FLYUNG4](https://www.statbank.dk/FLYUNG4) | Migration among young people (15-29 years) by type of move, in-migration province, age groups | 2007–2025 | yes |
| [FLYUNG5](https://www.statbank.dk/FLYUNG5) | Migration among young people (15-29 years) by type of move, out-migration province, in-migration province | 2007–2025 | yes |
| [FRLD126](https://www.statbank.dk/FRLD126) | Population projections 2026 by region/province, age, sex | 2026–2050 | yes |
| [FRLD226](https://www.statbank.dk/FRLD226) | Key figures 2026: Summary components of changes according to population projecti by province, type of movement | 2026–2050 | yes |
| [HISB77](https://www.statbank.dk/HISB77) | Life expectancy for new born babies by region, sex | 2000:2001–2024:2025 | yes |
| [NEETDIA2](https://www.statbank.dk/NEETDIA2) | Hospital utilisation in the population (16-29 years) by NEET status, key figures, primary diagnosis groups, region, sex | 2019–2024 | yes |
| [NEETLPR2](https://www.statbank.dk/NEETLPR2) | Hospital utilisation in the population (16-29 years) by NEET status, key figures, duration of hospital stay, region, sex | 2019–2024 | yes |
| [NEETMED2](https://www.statbank.dk/NEETMED2) | Purchase of prescription medicine in the population (16-29 years) by NEET status, key figures, type of medicine, region, sex | 2019–2024 | yes |
| [NEETSYG2](https://www.statbank.dk/NEETSYG2) | Consultations with physicians in the population (16-29 years) by NEET status, key figures, health professional, region, sex | 2019–2024 | yes |
| [ANBAAR10](https://www.statbank.dk/ANBAAR10) | Decisive causes related to initiated placement outside own home by part of the country, cause for placement outside the home, age, sex | 2018–2025 | yes |
| [AUH04](https://www.statbank.dk/AUH04) | Persons receiving public benefits by region, type of benefits, country of origin, sex | 2007–2025 | yes |
| [AUK04](https://www.statbank.dk/AUK04) | Persons receiving public benefits by region, type of benefits, country of origin, sex | 2007Q1–2026Q2 | yes |
| [BARSEL06](https://www.statbank.dk/BARSEL06) | Non-cohabiting parents leave before birth and in the child's first year of life by unit, benefit rights, existence, educational combination, region | 2015–2024 | yes |
| [BU04A](https://www.statbank.dk/BU04A) | Support to children and young people per 31st December (net statement) by region, measure, age, sex | 2011–2025 | yes |
| [HANDBIL3](https://www.statbank.dk/HANDBIL3) | Reconsidered cases concerning support for disability vehicles by province, unit | 2025 | yes |
| [HANDBU03](https://www.statbank.dk/HANDBU03) | Disability measures for children between 0-17 years by province, measure | 2022–2025 | yes |
| [ISBU03](https://www.statbank.dk/ISBU03) | Initiated intervention and support to children and young people during the year by province, measure | 2015–2025 | yes |
| [ISBU04](https://www.statbank.dk/ISBU04) | Active intervention and support to children and young people per 31 December by province, measure, age, sex | 2015–2025 | yes |
| [LIGEFB1](https://www.statbank.dk/LIGEFB1) | Parents by family relationship of the child, the parents entitlement to benefits, the highest education completed of the mother, the highest education completed of the father, region | 2016–2024 | yes |
| [LIGEFI1](https://www.statbank.dk/LIGEFI1) | Gender equality indicator on days of parental benefits to parents by indicator, the highest education completed of the mother, the highest education completed of the father, the parents level of education, region | 2016–2024 | yes |
| [NVG23](https://www.statbank.dk/NVG23) | National transport of goods by road between regions by unit, region of loading, region of  unloading, type of goods | 2008–2025 | yes |
| [NVG33](https://www.statbank.dk/NVG33) | National transport of dangerous goods by road by unit, region of loading, region of  unloading, type of goods | 2007–2025 | yes |
| [SKIB461](https://www.statbank.dk/SKIB461) | Throughput of goods in national traffic in Danish ports by seaport, direction, part of the country | 2007–2025 | yes |
| [UHELDK2](https://www.statbank.dk/UHELDK2) | Injured and killed in alcohol accidents by region, casualty, age, sex | 1998–2025 | yes |
| [VEJ11](https://www.statbank.dk/VEJ11) | Road network 1st January by part of the country, type of road | 2007–2024 | yes |
| [AFG07](https://www.statbank.dk/AFG07) | Cultivated area by region, unit, crop | 2006–2019 | no |
| [AGRO11](https://www.statbank.dk/AGRO11) | Livestock farms by region, harmonization requirements, kind | 2006–2009 | no |
| [AGRO77](https://www.statbank.dk/AGRO77) | Storage facilities for manure by region, type | 2006–2008 | no |
| [BDF07](https://www.statbank.dk/BDF07) | Farms by region, type, type of farm, area | 2006–2009 | no |
| [BEST1](https://www.statbank.dk/BEST1) | Board members and managers by type, sex, education, age, residence province | 2014–2021 | no |
| [BRUG22](https://www.statbank.dk/BRUG22) | Livestock farms by region, type of farm, kind | 2006–2009 | no |
| [BRUG44](https://www.statbank.dk/BRUG44) | Livestock units by region, category | 2006–2009 | no |
| [BRUG55](https://www.statbank.dk/BRUG55) | Farms by region, harmonization requirements, kind | 2006–2009 | no |
| [BRUG66](https://www.statbank.dk/BRUG66) | Farms by region, type of farm, kind | 2006–2009 | no |
| [FRUGT1](https://www.statbank.dk/FRUGT1) | Holdings with apples and pears by region, kind | 2002–2012 | no |
| [GARTN1](https://www.statbank.dk/GARTN1) | Production of fruit and vegetables by region, unit, crop | 2003–2024 | no |
| [GF4](https://www.statbank.dk/GF4) | General enterprise statistics by region, industry (DB07 10-grouping), unit | 2000–2010 | no |
| [GF4LX](https://www.statbank.dk/GF4LX) | General enterprise statistics by region, industry (9-grouping), unit | 2007 | no |
| [HALM1](https://www.statbank.dk/HALM1) | Straw yield and use by region, crop, unit, use | 2006–2024 | no |
| [HST77](https://www.statbank.dk/HST77) | Harvest by region, crop, unit | 2006–2024 | no |
| [KOMPSEL1](https://www.statbank.dk/KOMPSEL1) | Compensation - self-employment (experimental statistics) by part of the country, unit | 2020 | no |
| [LONKOMP2](https://www.statbank.dk/LONKOMP2) | Wage compensation to date (experimental statistics) by part of the country, unit | 2020 | no |
| [LONKOMPB](https://www.statbank.dk/LONKOMPB) | Wage compensation (experimental statistics) by part of the country, unit | 2020U25–2020U35 | no |
| [PELS2](https://www.statbank.dk/PELS2) | Furred animals by region, unit, type of farm | 2007–2009 | no |
| [PELS22](https://www.statbank.dk/PELS22) | Farms with furred animals by region, farm information | 2010–2020 | no |
| [REGN8](https://www.statbank.dk/REGN8) | Accounts statistics (DB07) by region, industry, items | 2007–2021 | no |
| [REGN8X](https://www.statbank.dk/REGN8X) | Accounts statistics by region, industry, items | 2007 | no |
| [SKOV33](https://www.statbank.dk/SKOV33) | Forestry farms by region, size of the forestry farm, cultivation and felling | 2012–2022 | no |
| [TURL11](https://www.statbank.dk/TURL11) | Nights spent at hotels and holiday resorts by region/province, citizenship | 2006M01–2007M12 | no |
| [TURL22](https://www.statbank.dk/TURL22) | Hotels and holiday resorts by region/province, capacity | 2006M01–2007M12 | no |
| [TURL3](https://www.statbank.dk/TURL3) | Nights spent at camping sites by region/province, citizenship | 2006M03–2007M12 | no |
| [TURL8](https://www.statbank.dk/TURL8) | Nights spent at marinas with overnight accommodations by region, citizenship, season | 2006–2007 | no |
| [TURL9](https://www.statbank.dk/TURL9) | Nights spent in Youth Hostels by region/province, citizenship | 2006M01–2007M12 | no |
| [ARKIV02](https://www.statbank.dk/ARKIV02) | Activity and staffing of the city and local archives by region, key figures | 2011–2017 | no |
| [BIO3](https://www.statbank.dk/BIO3) | Cinemas by region, key figures, size of cinema | 2010–2015 | no |
| [KVU31](https://www.statbank.dk/KVU31) | Adults participation in outgoing cultural activities (per cent of the sample) by cultural activity, part of the country | 2004 | no |
| [KVUARGEO](https://www.statbank.dk/KVUARGEO) | Individuals use of cultural activities (year) within the past three months by cultural activity, area | 2018–2022 | no |
| [KVUH1GEO](https://www.statbank.dk/KVUH1GEO) | Cultural activities (year) within the last three months by cultural activity, area, frequency | 2018–2022 | no |
| [KVUH2GEO](https://www.statbank.dk/KVUH2GEO) | Cultural activities (year) within the last week by cultural activity, area, frequency | 2018–2022 | no |
| [TEAT14](https://www.statbank.dk/TEAT14) | Economic performance of state-subsidised theatres by region, theatre/type of theatre, key figures | 2009/2010–2014/2015 | no |
| [TEAT7](https://www.statbank.dk/TEAT7) | Theatre activity by region, theatre/type of theatre, category of theatre, activity | 2009/2010–2014/2015 | no |
| [TEAT8](https://www.statbank.dk/TEAT8) | Theatre activity by region, theatre/type of theatre, primary audience, genre, activity | 2009/2010–2014/2015 | no |
| [VIR332](https://www.statbank.dk/VIR332) | Enterprises by type of company, part of the country, turnover | 2006–2007 | no |
| [ZOO2](https://www.statbank.dk/ZOO2) | Activity in Zoos and Aquariums by region, type of zoo, activity | 2016–2021 | no |
| [EJ55](https://www.statbank.dk/EJ55) | Price index for sales of property by region, category of real property, unit | 1992Q1–2023Q3 | no |
| [EJ66](https://www.statbank.dk/EJ66) | Price index for sales property by region, category of real property, unit | 1992–2022 | no |
| [EJEN55](https://www.statbank.dk/EJEN55) | Price index for sales of property by region, property category | 1992Q1–2018Q4 | no |
| [EJEN66](https://www.statbank.dk/EJEN66) | Price index for sales of property by region, property category | 1992–2017 | no |
| [NATREL1](https://www.statbank.dk/NATREL1) | 1 Production, part of the country, 10-grouping by part of the country, account, industry, price unit | 1993–2012 | no |
| [NATREL2](https://www.statbank.dk/NATREL2) | 211 Generation of income, part of the country, 10-grouping by part of the country, account, industry | 1993–2012 | no |
| [NATREL4](https://www.statbank.dk/NATREL4) | Employment, part of the country, 10-grouping by part of the country, type, industry | 1993–2012 | no |
| [NATRGBFL](https://www.statbank.dk/NATRGBFL) | Average population by part of the country, account | 1993–2012 | no |
| [NATRHL02](https://www.statbank.dk/NATRHL02) | 1 Production, regions, summary table by part of the country, account, price unit | 1993–2012 | no |
| [NATRHL03](https://www.statbank.dk/NATRHL03) | 211 Generation of income, regions, summary table by part of the country, account | 1993–2012 | no |
| [NATRSL03](https://www.statbank.dk/NATRSL03) | Allocation of primary income, household sector by part of the country, account | 2000–2012 | no |
| [NATRSL04](https://www.statbank.dk/NATRSL04) | Secondary distribution of income, household sector by part of the country, account | 2000–2012 | no |
| [NATRSLK3](https://www.statbank.dk/NATRSLK3) | Allocation of primary income pr. capita, household sector by part of the country, account | 2000–2012 | no |
| [NATRSLK4](https://www.statbank.dk/NATRSLK4) | Secondary distribution of income pr. capita, household sector by part of the country, account | 2000–2012 | no |
| [NRBB10X](https://www.statbank.dk/NRBB10X) | Employment (10a3-grouping) by region, socioeconomic status, industry | 1993–2014 | no |
| [NRBI10X](https://www.statbank.dk/NRBI10X) | Gross fixed capital formation (10a3-grouping) by region, industry, price unit | 2000–2012 | no |
| [NRBP10X](https://www.statbank.dk/NRBP10X) | 1-2.1.1 Production  and generation of income (10a3-grouping) by region, transaction, industry, price unit | 1993–2014 | no |
| [NRHBX](https://www.statbank.dk/NRHBX) | Population by region, socioeconomic status | 1993–2014 | no |
| [NRHPX](https://www.statbank.dk/NRHPX) | 1-2.1.1 Production, GDP and generation of income by region, transaction, price unit | 1993–2014 | no |
| [NRSX](https://www.statbank.dk/NRSX) | Households' income by region, transaction, price unit | 2000–2014 | no |
| [RNAT21](https://www.statbank.dk/RNAT21) | GDP (DKK million) and GDP per capita (DKK 1000) by part of the country, type, price unit | 1993–2012 | no |
| [RNAT21Z](https://www.statbank.dk/RNAT21Z) | GDP (DKK million) and GDP per capita (DKK 1000) by part of the country, type, price unit | 1993–2009 | no |
| [RNAT22](https://www.statbank.dk/RNAT22) | Gross value added (DKK million) by part of the country, industry, price unit | 1993–2009 | no |
| [RNAT22N](https://www.statbank.dk/RNAT22N) | Gross value added (DKK million) by part of the country, industry, price unit | 1993–2012 | no |
| [RNAT23](https://www.statbank.dk/RNAT23) | Compensation of employees and total employment (DKK million/persons) by part of the country, industry, type | 1993–2009 | no |
| [RNAT23N](https://www.statbank.dk/RNAT23N) | Compensation of employees and total employment (DKK million/persons) by part of the country, industry, type | 1993–2012 | no |
| [VERSEJ55](https://www.statbank.dk/VERSEJ55) | Versiontable EJ55 - Price index for sales of property by version, region, category of real property, unit | 1992Q1–2023Q3 | no |
| [VERSEJ66](https://www.statbank.dk/VERSEJ66) | Versiontable EJ66 - Price index for sales property by version, region, category of real property, unit | 1992–2022 | no |
| [AREALDK1](https://www.statbank.dk/AREALDK1) | Land by land cover, region, unit | 2011–2016 | no |
| [AB61207](https://www.statbank.dk/AB61207) | Seasonally adjusted figures by region, persons/pct. | 2000M01–2007M12 | no |
| [ABIE207](https://www.statbank.dk/ABIE207) | Unemployed by ancestry, country of origin, region | 2007Q1–2007Q4 | no |
| [AUL03X](https://www.statbank.dk/AUL03X) | Full-time unemployed persons by region, country of origin, sex | 2001–2009 | no |
| [AUL06](https://www.statbank.dk/AUL06) | Net full-time unemployed persons by region, persons/pct., education, age, sex | 2001–2006 | no |
| [AUL07](https://www.statbank.dk/AUL07) | Net full-time unemployed persons by region, persons/pct., education, age, sex | 2007–2014 | no |
| [AULK03X](https://www.statbank.dk/AULK03X) | Full-time net unemployed persons by region, country of origin, sex | 2001Q1–2010Q3 | no |
| [AULK06](https://www.statbank.dk/AULK06) | Long-term unemployed persons by region, seasonal adjustment | 2009M02–2017M02 | no |
| [AUS02](https://www.statbank.dk/AUS02) | Seasonally adjusted figures (net unemployed) by region, persons/pct. | 2000M04–2006M12 | no |
| [FRA044](https://www.statbank.dk/FRA044) | Absence by sector, sex, cause of absence, region, indicator of absence | 2006–2013 | no |
| [INDKF2](https://www.statbank.dk/INDKF2) | Income by region, unit, owner/ tenant of dwelling, family type, income interval | 2000–2012 | no |
| [INDKF31](https://www.statbank.dk/INDKF31) | Disposable income by region, unit, family type, income interval | 2000–2012 | no |
| [INDKP4](https://www.statbank.dk/INDKP4) | Income, persons by part of the country, unit, sex, socioeconomic status, type of income | 2002–2012 | no |
| [INDKP8](https://www.statbank.dk/INDKP8) | Equivalence weighted income, persons by region/province, unit, sex, age, income interval, type of income | 2000–2012 | no |
| [LBESK2](https://www.statbank.dk/LBESK2) | Full-time employees by area of workplace, sector | 2008Q1–2012Q4 | no |
| [LBESK3](https://www.statbank.dk/LBESK3) | Full-time employees by area of workplace, industry (DB07 10-grouping) | 2008Q1–2014Q4 | no |
| [LBESK5](https://www.statbank.dk/LBESK5) | Full-time employees by area of workplace, sector | 2008Q1–2014Q4 | no |
| [RASIE207](https://www.statbank.dk/RASIE207) | Labour force, age group 16-66 years by ancestry, country of origin, region | 2006 | no |
| [AMB01](https://www.statbank.dk/AMB01) | Out-patient treatments by region, diagnosis, age, sex | 2006–2018 | no |
| [AMB02](https://www.statbank.dk/AMB02) | Out-patient treatments by region, diagnosis, age, sex | 2006–2018 | no |
| [AMB04](https://www.statbank.dk/AMB04) | Out-patient treatments and out-patients by region, key figures, diagnosis, age, sex | 2006–2018 | no |
| [AMB05](https://www.statbank.dk/AMB05) | Out-patient treatments and out-patients by region, key figures, out-patiens treatments, age, sex | 2006–2018 | no |
| [AMBP07](https://www.statbank.dk/AMBP07) | Rates for out-patient treatments by index type, region, age, sex | 2006–2018 | no |
| [AMBU001](https://www.statbank.dk/AMBU001) | Out-patient treatments (LPR3) by region, primary diagnosis groups, emergency/non-emergency, age, sex | 2019–2023 | no |
| [AMBU01](https://www.statbank.dk/AMBU01) | Out-patient treatments (LPR3) by region, diagnosis, emergency/non-emergency, age, sex | 2019–2023 | no |
| [AMBU02](https://www.statbank.dk/AMBU02) | Out-patient treatments (LPR3) by region, diagnosis, emergency/non-emergency, age, sex | 2019–2023 | no |
| [DODC2](https://www.statbank.dk/DODC2) | Deaths per week (experimental statistics) by region, sex, age | 2007U01–2023U43 | no |
| [FRLD113](https://www.statbank.dk/FRLD113) | Population projections by region, age, sex | 2013–2040 | no |
| [FRLD114](https://www.statbank.dk/FRLD114) | Population projections by region, age, sex | 2014–2040 | no |
| [FRLD115](https://www.statbank.dk/FRLD115) | Population projections 2015 by region, age, sex | 2015–2040 | no |
| [FRLD116](https://www.statbank.dk/FRLD116) | Population projections 2016 by region, age, sex | 2016–2045 | no |
| [FRLD117](https://www.statbank.dk/FRLD117) | Population projections 2017 by region, age, sex | 2017–2045 | no |
| [FRLD118](https://www.statbank.dk/FRLD118) | Population projections 2018 by region, age, sex | 2018–2045 | no |
| [FRLD119](https://www.statbank.dk/FRLD119) | Population projections 2019 by region, age, sex | 2019–2045 | no |
| [FRLD120](https://www.statbank.dk/FRLD120) | Population projections 2020 by region, age, sex | 2020–2045 | no |
| [FRLD121](https://www.statbank.dk/FRLD121) | Population projections 2021 by region, age, sex | 2021–2045 | no |
| [FRLD122](https://www.statbank.dk/FRLD122) | Population projections 2022 by region, age, sex | 2022–2045 | no |
| [FRLD123](https://www.statbank.dk/FRLD123) | Population projections 2023 by region, age, sex | 2023–2050 | no |
| [FRLD124](https://www.statbank.dk/FRLD124) | Population projections 2024 by region/province, age, sex | 2024–2050 | no |
| [FRLD125](https://www.statbank.dk/FRLD125) | Population projections 2025 by region/province, age, sex | 2025–2050 | no |
| [FRLD213](https://www.statbank.dk/FRLD213) | Key figures, provinces by region, type of movement | 2013–2040 | no |
| [FRLD214](https://www.statbank.dk/FRLD214) | Key figures, provinces by region, type of movement | 2014–2040 | no |
| [FRLD215](https://www.statbank.dk/FRLD215) | Key figures 2015: Summary components of changes according to population projecti by region, type of movement | 2015–2040 | no |
| [FRLD216](https://www.statbank.dk/FRLD216) | Key figures 2016: Summary components of changes according to population projecti by region, type of movement | 2016–2045 | no |
| [FRLD217](https://www.statbank.dk/FRLD217) | Key figures 2017: Summary components of changes according to population projecti by region, type of movement | 2017–2045 | no |
| [FRLD218](https://www.statbank.dk/FRLD218) | Key figures 2018: Summary components of changes according to population projecti by region, type of movement | 2018–2045 | no |
| [FRLD219](https://www.statbank.dk/FRLD219) | Key figures 2019: Summary components of changes according to population projecti by region, type of movement | 2019–2045 | no |
| [FRLD220](https://www.statbank.dk/FRLD220) | Key figures 2020: Summary components of changes according to population projecti by region, type of movement | 2020–2045 | no |
| [FRLD221](https://www.statbank.dk/FRLD221) | Key figures 2021: Summary components of changes according to population projecti by region, type of movement | 2021–2045 | no |
| [FRLD222](https://www.statbank.dk/FRLD222) | Key figures 2022: Summary components of changes according to population projecti by region, type of movement | 2022–2045 | no |
| [FRLD223](https://www.statbank.dk/FRLD223) | Key figures 2023: Summary components of changes according to population projecti by region, type of movement | 2023–2050 | no |
| [FRLD224](https://www.statbank.dk/FRLD224) | Key figures 2024: Summary components of changes according to population projecti by province, type of movement | 2024–2050 | no |
| [FRLD225](https://www.statbank.dk/FRLD225) | Key figures 2025: Summary components of changes according to population projecti by province, type of movement | 2025–2050 | no |
| [IND01](https://www.statbank.dk/IND01) | Admissions by region, diagnosis, emergency/non-emergency, age, sex | 2006–2018 | no |
| [IND02](https://www.statbank.dk/IND02) | Admissions by region, diagnosis, emergency/non-emergency, age, sex | 2006–2018 | no |
| [IND04](https://www.statbank.dk/IND04) | Admissions, bed-days and hospital patients by region, key figures, diagnosis, age, sex | 2006–2018 | no |
| [IND05](https://www.statbank.dk/IND05) | Admissions, bed-days and hospital patients by region, key figures, bed-days, age, sex | 2006–2018 | no |
| [INDL001](https://www.statbank.dk/INDL001) | Admissions (LPR3) by region, primary diagnosis groups, emergency/non-emergency, age, sex | 2019–2023 | no |
| [INDL01](https://www.statbank.dk/INDL01) | Admissions (LPR3) by region, diagnosis, emergency/non-emergency, age, sex | 2019–2023 | no |
| [INDL02](https://www.statbank.dk/INDL02) | Admissions (LPR3) by region, diagnosis, emergency/non-emergency, age, sex | 2019–2023 | no |
| [INDP07](https://www.statbank.dk/INDP07) | Rates for admissions by index type, region, age, sex | 2006–2018 | no |
| [NEETDIAG](https://www.statbank.dk/NEETDIAG) | Hospital utilisation in the population (16-24 years) by NEET status, key figures, primary diagnosis groups, region, sex | 2019–2023 | no |
| [NEETLPR](https://www.statbank.dk/NEETLPR) | Hospital utilisation in the population (16-24 years) by NEET status, key figures, type of contact, region, sex | 2019–2023 | no |
| [NEETMED](https://www.statbank.dk/NEETMED) | Purchase of prescription medicine in the population (16-24 years) by NEET status, key figures, type of medicine, region, sex | 2019–2023 | no |
| [NEETSYG](https://www.statbank.dk/NEETSYG) | Consultations with physicians in the population (16-24 years) by NEET status, key figures, health professional, region, sex | 2019–2023 | no |
| [SKAD01](https://www.statbank.dk/SKAD01) | Emergency department visits by region, diagnosis, age, sex | 2006–2018 | no |
| [SKAD02](https://www.statbank.dk/SKAD02) | Emergency department visits by region, diagnosis, age, sex | 2006–2018 | no |
| [SKAD04](https://www.statbank.dk/SKAD04) | Emergency department visits and emergency patients by region, key figures, diagnosis, age, sex | 2006–2018 | no |
| [SKAD05](https://www.statbank.dk/SKAD05) | Emergency department visits and emergency patients by region, key figures, reason for contact, age, sex | 2006–2018 | no |
| [SKADP07](https://www.statbank.dk/SKADP07) | Index for emergency treatments by index type, region, age, sex | 2006–2018 | no |
| [SMIT3](https://www.statbank.dk/SMIT3) | Confirmed cases of COVID-19 per day (experimental statistics) by key figures, part of the country | 2020M03D21–2021M06D29 | no |
| [ANBAAR16](https://www.statbank.dk/ANBAAR16) | Children and young persons placed outside of own home per 31st december by part of the country, place of accommodation, measure, age, sex | 2011–2024 | no |
| [ANBAAR17](https://www.statbank.dk/ANBAAR17) | Initiated placement outside of own home of children and young persons by part of the country, place of accommodation, age, sex | 2011–2024 | no |
| [ANBAAR6](https://www.statbank.dk/ANBAAR6) | Children and young persons placed outside of own home per 31st december by part of the country, place of accommodation, measure, age, sex | 2011–2018 | no |
| [ANBAAR7](https://www.statbank.dk/ANBAAR7) | Initiated placement outside of own home of children and young persons by part of the country, place of accommodation, age, sex | 2011–2018 | no |
| [ANBAAR8](https://www.statbank.dk/ANBAAR8) | Initiated placement outside of own home of children and young persons by part of the country, measure, age, sex | 2011–2024 | no |
| [BARSEL01](https://www.statbank.dk/BARSEL01) | Parental leave (calculated after days of entitlement to benefits) by unit, benefit rights, leave, educational combination, region | 2003–2015 | no |
| [BARSEL02](https://www.statbank.dk/BARSEL02) | Parental leave, cohabitants (calculated after days) by unit, benefit rights, leave, educational combination, region | 2003–2015 | no |
| [BARSEL03](https://www.statbank.dk/BARSEL03) | Parental leave, non cohabitants (calculated after days) by unit, benefit rights, existence, educational combination, region | 2003–2015 | no |
| [BARSEL22](https://www.statbank.dk/BARSEL22) | Parental leave during the child's second year of life by unit, entitlement, region, existence | 2015–2020 | no |
| [BU01AA](https://www.statbank.dk/BU01AA) | Children and young persons with preventive measures per 31st December by region, measure, age, sex | 2011–2018 | no |
| [BU04](https://www.statbank.dk/BU04) | Assistance to exposed children and young people (31st December) by region, measure, age, sex | 2006–2013 | no |
| [BU20](https://www.statbank.dk/BU20) | Decisions on placement where the decisive cause relates to the child by region, cause for placement outside the home, age, sex | 2006–2017 | no |
| [BU21](https://www.statbank.dk/BU21) | Decisions on placement where the decisive cause relates to the parents by region, cause for placement outside the home | 2006–2017 | no |
| [BU22](https://www.statbank.dk/BU22) | Crime commited by current or former exposed children and young people by region, type of offence, target/control group | 2009–2013 | no |
| [BU22A](https://www.statbank.dk/BU22A) | Crime commited by current or former exposed children and young people by region, type of offence, measure | 2010–2015 | no |
| [BU25](https://www.statbank.dk/BU25) | Changed circumstances in care placement by region, causes of change of placement, age, sex | 2014–2018 | no |
| [BU30](https://www.statbank.dk/BU30) | Level of education for 25 years by region, level of education, former disadvantaged/not disadvantaged | 2009–2014 | no |
| [BU30A](https://www.statbank.dk/BU30A) | Level of education for 25 years by region, level of education, measure | 2010–2015 | no |
| [BU32](https://www.statbank.dk/BU32) | Breakdown in placement by region, cause for breakdown of care, follow-up on breakdown of care, sex | 2013–2016 | no |
| [ELKS01](https://www.statbank.dk/ELKS01) | Full-time participants in retirement (Seasonally adjusted figures) by region, number and share, age | 2007Q1–2013Q4 | no |
| [LIGEFB1X](https://www.statbank.dk/LIGEFB1X) | Parents by family relationship of the child, the parents entitlement to benefits, the highest education completed of the mother, the highest education completed of the father, region | 2003–2015 | no |
| [LIGEFI1X](https://www.statbank.dk/LIGEFI1X) | Gender equality indicator on days of parental benefits to parents by indicator, the highest education completed of the mother, the highest education completed of the father, the parents level of education, region | 2003–2015 | no |
| [NVG22](https://www.statbank.dk/NVG22) | National transport of goods by road between regions by unit, region of loading, region of  unloading, type of goods | 2007 | no |

</details>

<details><summary>region: 186 tables (77 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [CAMP1](https://www.statbank.dk/CAMP1) | Nights spend on camping sites by region, nationality of the guest, unit, period | 1992–2026 | yes |
| [CAMP2](https://www.statbank.dk/CAMP2) | Camping sites by region, capacity | 1992M03–2026M08 | yes |
| [CAMP3](https://www.statbank.dk/CAMP3) | Camping sites by region, capacity | 1992–2025 | yes |
| [DEMO14](https://www.statbank.dk/DEMO14) | Business Demography by region, industry (DB07 10-grouping), unit | 2019–2024 | yes |
| [EJJORD1](https://www.statbank.dk/EJJORD1) | Ownership of Danish agricultural land by region, unit, country | 2020–2025 | yes |
| [FDEMO4](https://www.statbank.dk/FDEMO4) | Preliminary Business Demography by region, industry (DB07 10-grouping), unit | 2024 | yes |
| [FGF6](https://www.statbank.dk/FGF6) | Preliminary general enterprise statistics by region, industry (DB07 10-grouping), unit | 2024 | yes |
| [FISK1](https://www.statbank.dk/FISK1) | Danish vessels by region, unit, type of vessels, length, tonnage | 1996–2025 | yes |
| [GF14](https://www.statbank.dk/GF14) | General enterprise statistics by region, unit, enterprise size (full time equivalents) | 2019–2024 | yes |
| [HOTEL2](https://www.statbank.dk/HOTEL2) | Nights spent at hotels and holiday resorts by region, nationality of the guest, type, unit, period | 1992–2026 | yes |
| [HOTEL5](https://www.statbank.dk/HOTEL5) | Hotels and holiday resorts by region, capacity, type | 1992M01–2026M08 | yes |
| [HOTEL6](https://www.statbank.dk/HOTEL6) | Hotels and holiday resorts by region, capacity, type | 1992–2025 | yes |
| [HOTEL8](https://www.statbank.dk/HOTEL8) | Nights spent at hotels and holiday resorts by region, purpose of visit, type, period | 2004–2026 | yes |
| [JOEK2](https://www.statbank.dk/JOEK2) | Economic accounts for agriculture by region, product | 2022–2023 | yes |
| [LPRIS37](https://www.statbank.dk/LPRIS37) | Prices for agricultural land and tenancy by region, product, unit | 2015–2025 | yes |
| [LS02](https://www.statbank.dk/LS02) | Job vacancies by region, unit | 2010–2025 | yes |
| [LSK12](https://www.statbank.dk/LSK12) | Job vacancies by region, unit, sector | 2026Q1–2026Q2 | yes |
| [LSK13](https://www.statbank.dk/LSK13) | Job vacancies by region, unit, industry (DB25 10-grouping) | 2026Q1–2026Q2 | yes |
| [KFRED1](https://www.statbank.dk/KFRED1) | Protected buildings by region, type of building, year of construction | 2012–2025 | yes |
| [KFRED2](https://www.statbank.dk/KFRED2) | Protected ancient monuments by region, monument category  | 2010–2025 | yes |
| [KFRED3](https://www.statbank.dk/KFRED3) | New protections and de-protections by unit, region | 2012–2025 | yes |
| [KUBESK55](https://www.statbank.dk/KUBESK55) | Employment (end November) by education institution, education, work place region, sex | 2019–2024 | yes |
| [KUNST2](https://www.statbank.dk/KUNST2) | Artist by type of art, region of residence | 2022–2024 | yes |
| [MUSIK2](https://www.statbank.dk/MUSIK2) | Purchase of rights for recording music by industry (DB07), region | 2008–2025 | yes |
| [MUSIK3](https://www.statbank.dk/MUSIK3) | Income by sale of music by type of owner of rights, region | 2012–2025 | yes |
| [MUSIK4](https://www.statbank.dk/MUSIK4) | Authors income from music rights by sex, age, region | 2012–2025 | yes |
| [SKOLM04C](https://www.statbank.dk/SKOLM04C) | Employees at the music schools by sex, age, work place region | 2021:2022–2024:2025 | yes |
| [BUDR1](https://www.statbank.dk/BUDR1) | Region budgets (DKK 1.000) by region, main account, dranst, kind, price unit | 2007–2026 | yes |
| [BUDR32](https://www.statbank.dk/BUDR32) | Region budgets (DKK 1.000) by region, function, dranst, kind, price unit | 2007–2026 | yes |
| [EJ121](https://www.statbank.dk/EJ121) | Seasonally adjusted sales of property by region, property category, unit | 2005Q1–2026Q2 | yes |
| [EJ131](https://www.statbank.dk/EJ131) | Sales of real property by region, category of real property, key figures | 2006M01–2025M07 | yes |
| [HUS1](https://www.statbank.dk/HUS1) | Rent indices for housing by region, category of real property, unit | 2021Q1–2026Q2 | yes |
| [REGR11](https://www.statbank.dk/REGR11) | Regions accounts by main accounts by region, main account, dranst, kind, price unit | 2007–2025 | yes |
| [REGR31](https://www.statbank.dk/REGR31) | Regions accounts by region, main account, dranst, kind, price unit | 2007–2025 | yes |
| [REGR4](https://www.statbank.dk/REGR4) | Regionernes balance (1.000 kr.) efter område, funktion og tid | 2007–2025 | yes |
| [REGR55](https://www.statbank.dk/REGR55) | Region accounts by region, main account, authorized group, kind | 2007–2025 | yes |
| [FORLOB10](https://www.statbank.dk/FORLOB10) | From primary and lower secondary school to further education by cohort, school leaving certificate, region district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2022–2025 | yes |
| [FORLOB15](https://www.statbank.dk/FORLOB15) | From upper secondary education to further education by cohort, school leaving certificate, region district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2022–2025 | yes |
| [FORSK01](https://www.statbank.dk/FORSK01) | Enterprises expenses for own research and development (R&D) by industry - size class - region etc., expenses for own R&D | 2007–2024 | yes |
| [FORSK02](https://www.statbank.dk/FORSK02) | Business expenditure on purchased research and development (R&D) by industry - size class - region etc., type of supplier | 2007–2024 | yes |
| [FORSK09](https://www.statbank.dk/FORSK09) | Enterprises running costs for research and development R&D by industry - size class - region etc., research type | 2013–2023 | yes |
| [FORSK110](https://www.statbank.dk/FORSK110) | Enterprises financing of expenses for own research and development (R&D) by industry - size class - region etc., source of funding | 2013–2023 | yes |
| [FORSK111](https://www.statbank.dk/FORSK111) | Business financing of expenditure on purchased research and development (R&D) by industry - size class - region etc., source of funding | 2013–2023 | yes |
| [FORSK112](https://www.statbank.dk/FORSK112) | Enterprises expenses for own scientific research and devepment (R&D) by industry - size class - region etc., field of science | 2017–2023 | yes |
| [FORSK113](https://www.statbank.dk/FORSK113) | Research and development personnel (R&D) in enterprises by industry - size class - region etc., type of staff, sex | 2013–2024 | yes |
| [FORSK114](https://www.statbank.dk/FORSK114) | Research and development full-time employees (R&D) in enterprises by industry - size class - region etc., type of staff, sex | 2013–2024 | yes |
| [INN21](https://www.statbank.dk/INN21) | Enterprises expenses for own R&D by industry and size class, region, type of expenses | 2020–2024 | yes |
| [INN22](https://www.statbank.dk/INN22) | Innovative enterprises by industry and size class, region, type of innovation | 2020–2024 | yes |
| [INN23](https://www.statbank.dk/INN23) | Product innovative enterprises by industry and size class, region, product innovation type | 2020–2024 | yes |
| [INN24](https://www.statbank.dk/INN24) | Procesinnovative enterprises by industry and size class, region, proces innovation type | 2020–2024 | yes |
| [INN25](https://www.statbank.dk/INN25) | Enterprises by industry and size class, region, cooperation subject | 2020–2024 | yes |
| [UDDAKT30](https://www.statbank.dk/UDDAKT30) | Educational activity in upper secondary school by education, region of residence, ancestry, national origin, sex, status | 2005–2025 | yes |
| [SKOVRG03](https://www.statbank.dk/SKOVRG03) | Forest area (Kyoto) (physical account) by balance items, region | 1990–2025 | yes |
| [SKOVRG05](https://www.statbank.dk/SKOVRG05) | Growing stock (physical account) by balance items, species of wood, region | 1990–2025 | yes |
| [SKOVRG06](https://www.statbank.dk/SKOVRG06) | Growing stock (monetary account) by balance items, species of wood, region | 2019–2025 | yes |
| [AKU120K](https://www.statbank.dk/AKU120K) | Labour force status by employment status, region | 2008Q1–2026Q2 | yes |
| [AKU121K](https://www.statbank.dk/AKU121K) | Labour force status in percentage by employment status, region | 2008Q1–2026Q2 | yes |
| [AKU221K](https://www.statbank.dk/AKU221K) | Employed by industry (DB25 10-grouping), region, sex | 2008Q1–2026Q2 | yes |
| [AKU230K](https://www.statbank.dk/AKU230K) | Employed (in thousands) by region, age, sex | 2008Q1–2026Q2 | yes |
| [FRA023](https://www.statbank.dk/FRA023) | Absence by sector, sex, cause of absence, region, indicator of absence | 2013–2024 | yes |
| [FRA025](https://www.statbank.dk/FRA025) | Absence in governmental sector by region, sex, cause of absence, industry (DB07), indicator of absence | 2013–2024 | yes |
| [FRA026](https://www.statbank.dk/FRA026) | Absence in the governmental sector by region, sex, cause of absence, occupation, indicator of absence | 2013–2024 | yes |
| [FRA028](https://www.statbank.dk/FRA028) | Absence in the regional sector by region, sex, cause of absence, occupation, indicator of absence | 2013–2024 | yes |
| [INDKFPP3](https://www.statbank.dk/INDKFPP3) | Disposable income by region, unit, sex, income interval | 1987–2024 | yes |
| [INDKP102](https://www.statbank.dk/INDKP102) | Income, total by region, unit, sex, income interval | 1987–2025 | yes |
| [LONS30](https://www.statbank.dk/LONS30) | Earnings by region, sector, salary, salary earners, components, sex | 2013–2025 | yes |
| [AKVA3](https://www.statbank.dk/AKVA3) | Elections to region councils by region, political party, votes cast/candidates/sex | 2005–2025 | yes |
| [FLY55](https://www.statbank.dk/FLY55) | Internal migration between regions by sex, age, in-migration region, out-migration region | 2006–2025 | yes |
| [HISBR](https://www.statbank.dk/HISBR) | Life expectancy for new born babies by region, sex | 2000:2001–2024:2025 | yes |
| [SYGK2](https://www.statbank.dk/SYGK2) | Contacts covered by the public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGKS2](https://www.statbank.dk/SYGKS2) | Contacts covered by the public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGP2](https://www.statbank.dk/SYGP2) | Number of persons with contacts covered by public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGPS2](https://www.statbank.dk/SYGPS2) | Recievers og public health insurance by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGU2](https://www.statbank.dk/SYGU2) | Public health insurance expenses by region, type of benefits, age, sex | 2006–2025 | yes |
| [SYGUS2](https://www.statbank.dk/SYGUS2) | Public health insurance expenses by region, type of benefits, age, sex | 2006–2025 | yes |
| [KRISE1](https://www.statbank.dk/KRISE1) | Stays and residents at crisis shelters by region of residence, duration, resident status | 2017–2025 | yes |
| [BANE401](https://www.statbank.dk/BANE401) | National rail transport of goods by unit, region of loading, region of  unloading | 2007–2025 | yes |
| [DEMO4](https://www.statbank.dk/DEMO4) | Business Demography by region, industry (DB07 10-grouping), unit | 2007–2021 | no |
| [FDEMO4X](https://www.statbank.dk/FDEMO4X) | Preliminary Business Demography by region, industry (DB07 10-grouping), unit | 2016–2021 | no |
| [FGF6X](https://www.statbank.dk/FGF6X) | Preliminary general enterprise statistics by region, industry (DB07 10-grouping), unit | 2016–2021 | no |
| [GF6](https://www.statbank.dk/GF6) | General enterprise statistics by region, industry (DB07 10-grouping), unit | 2000–2021 | no |
| [GF8](https://www.statbank.dk/GF8) | General enterprise statistics by region, unit, enterprise size (full time equivalents) | 2001–2021 | no |
| [KONK2](https://www.statbank.dk/KONK2) | Bankruptcies by industry and region | 2005M01–2009M12 | no |
| [LBFI2](https://www.statbank.dk/LBFI2) | Gross domestic product at factor cost for agriculture by region, type | 2007–2023 | no |
| [LSK02](https://www.statbank.dk/LSK02) | Job vacancies by region, unit | 2010Q1–2025Q4 | no |
| [PELS33](https://www.statbank.dk/PELS33) | Farms with furred animals by region, farm information | 2010–2020 | no |
| [TURR1](https://www.statbank.dk/TURR1) | Nights spent at hotels and holiday resorts by region, citizenship, type | 2006M01–2007M12 | no |
| [TURR2](https://www.statbank.dk/TURR2) | Hotels and holiday resorts by region, capacity, type | 2006M01–2007M12 | no |
| [KUBESK5](https://www.statbank.dk/KUBESK5) | Employment (end November) by education institution, education, work place region, sex | 2010–2018 | no |
| [KUBESK5X](https://www.statbank.dk/KUBESK5X) | Employment by education institution, work place region, sex | 2007–2010 | no |
| [TEAT4](https://www.statbank.dk/TEAT4) | Activities on Danish theatres by region, activity, type of subsidizing | 2002/2003–2014/2015 | no |
| [EJ12](https://www.statbank.dk/EJ12) | Seasonally adjusted sales of property by region, property category, unit | 2005Q1–2023Q3 | no |
| [EJ13](https://www.statbank.dk/EJ13) | Sales of real property by region, category of real property, key figures | 2006M01–2022M01 | no |
| [EJ14](https://www.statbank.dk/EJ14) | Price index for sales of property by region, category of real property, unit | 2006M01–2022M01 | no |
| [EJ141](https://www.statbank.dk/EJ141) | Price index for sales of property by region, category of real property, unit | 2006M01–2022M12 | no |
| [NATRER1](https://www.statbank.dk/NATRER1) | 1 Production, regions, 10-grouping by region, account, industry, price unit | 1993–2012 | no |
| [NATRER2](https://www.statbank.dk/NATRER2) | 211 Generation of income, regions, 10-grouping by region, account, industry | 1993–2012 | no |
| [NATRER3](https://www.statbank.dk/NATRER3) | Capital formation, regions, 10-grouping by region, type, industry, price unit | 2000–2012 | no |
| [NATRER4](https://www.statbank.dk/NATRER4) | Employment, regions, 10-grouping by region, type, industry | 1993–2012 | no |
| [NATRGBF](https://www.statbank.dk/NATRGBF) | Average population by region, account | 1993–2012 | no |
| [NATRHR02](https://www.statbank.dk/NATRHR02) | 1 Production, regions, summary table by region, account, price unit | 1993–2012 | no |
| [NATRHR03](https://www.statbank.dk/NATRHR03) | 211 Generation of income, regions, summary table by region, account | 1993–2012 | no |
| [NATRSR03](https://www.statbank.dk/NATRSR03) | Allocation of primary income, household sector by region, account | 2000–2012 | no |
| [NATRSR04](https://www.statbank.dk/NATRSR04) | Secondary distribution of income, household sector by region, account | 2000–2012 | no |
| [NATRSRK3](https://www.statbank.dk/NATRSRK3) | Allocation of primary income pr. capita, household sector by region, account | 2000–2012 | no |
| [NATRSRK4](https://www.statbank.dk/NATRSRK4) | Secondary distribution of income pr. capita, household sector by region, account | 2000–2012 | no |
| [REGR41](https://www.statbank.dk/REGR41) | Regionernes åbningsbalance (1.000 kr.) efter område, funktion og tid | 2007 | no |
| [RNAT11](https://www.statbank.dk/RNAT11) | GDP (DKK million) and GDP per capita (DKK 1000) by region, type, price unit | 1993–2012 | no |
| [RNAT11Z](https://www.statbank.dk/RNAT11Z) | GDP (DKK million) and GDP per capita (DKK 1000) by region, type, price unit | 1993–2009 | no |
| [RNAT12](https://www.statbank.dk/RNAT12) | Gross value added (DKK million) by region, industry, price unit | 1993–2009 | no |
| [RNAT12N](https://www.statbank.dk/RNAT12N) | Gross value added (DKK million) by region, industry, price unit | 1993–2012 | no |
| [RNAT13](https://www.statbank.dk/RNAT13) | Compensation of employees and total employment (DKK million/persons) by region, industry, type | 1993–2009 | no |
| [RNAT13N](https://www.statbank.dk/RNAT13N) | Compensation of employees and total employment (DKK million/persons) by region, industry, type | 1993–2012 | no |
| [RNAT14](https://www.statbank.dk/RNAT14) | Capital formation (DKK million) by region, industry, price unit | 2000–2009 | no |
| [RNAT14N](https://www.statbank.dk/RNAT14N) | Capital formation (DKK million) by region, industry, price unit | 2000–2012 | no |
| [VERSEJ12](https://www.statbank.dk/VERSEJ12) | Versionstable EJ12 - Seasonally adjusted sales of property by version, region, property category, unit | 2005Q1–2023Q3 | no |
| [VERSEJ14](https://www.statbank.dk/VERSEJ14) | Versionstable EJ14 - Price index for sales of property by version, region, category of real property, unit | 2006M01–2022M01 | no |
| [AFG33T](https://www.statbank.dk/AFG33T) | From vocational education to labour by education, region, socioeconomic status, graduation statement at certain periods, sex, ancestry | 2001–2012 | no |
| [AFGANG11](https://www.statbank.dk/AFGANG11) | From primary and lower secondary school to further education by cohort, school leaving certificate, region district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2006–2014 | no |
| [AFGANG21](https://www.statbank.dk/AFGANG21) | From general upper secondary to further education by cohort, school leaving certificate, county district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2006–2014 | no |
| [AFGANG31](https://www.statbank.dk/AFGANG31) | From vocational upper secondary school leaving certificate to further education by cohort, school leaving certificate, county district of graduation institutions, educational graduation statement, graduation statement at certain periods, education, sex, ancestry | 2006–2014 | no |
| [AFGANG45](https://www.statbank.dk/AFGANG45) | 18-25 year-olds by status for upper secondary school and vocational education, age, sex, basic school location, ancestry | 2001–2014 | no |
| [AFGANG50](https://www.statbank.dk/AFGANG50) | 25-45 year-olds by status for higher education, age, sex, basic school location, ancestry | 2002–2014 | no |
| [CFA71](https://www.statbank.dk/CFA71) | Expenditure on Research and Development by region | 2003–2006 | no |
| [CFA82](https://www.statbank.dk/CFA82) | Shares of businesses with innovation expenditures by region | 2004–2007 | no |
| [EUD1](https://www.statbank.dk/EUD1) | Enrolled, vocational education and training by region, education, age, enrolment type, ancestry, sex | 2005–2014 | no |
| [EUD2](https://www.statbank.dk/EUD2) | Entrants, vocational education and training by region, education, age, enrolment type, ancestry, sex | 2005–2014 | no |
| [EUD3](https://www.statbank.dk/EUD3) | Number of drop-outs in vocational education and training by region, education, age, enrolment type, ancestry, sex | 2005–2014 | no |
| [EUD4](https://www.statbank.dk/EUD4) | Graduates, vocational education and training by region, education, age, enrolment type, ancestry, sex | 2005–2014 | no |
| [FORLOB51](https://www.statbank.dk/FORLOB51) | From vocational education to labour by region, socioeconomic status, graduation statement at certain periods, sex, ancestry | 2001–2014 | no |
| [FORSK03](https://www.statbank.dk/FORSK03) | Research and development (R&D)-personel in enterprises by industry - size class - region etc., type of staff, sex | 2007–2010 | no |
| [FORSK04](https://www.statbank.dk/FORSK04) | Research and developmentpersonel (R&D) (researchers) in enterprises by industry - size class - region etc., ph.d.-degree, sex | 2007–2010 | no |
| [FORSK05](https://www.statbank.dk/FORSK05) | Research and development full-time employees (R&D) in enterprises by industry - size class - region etc., type of staff, sex | 2007–2011 | no |
| [FORSK06](https://www.statbank.dk/FORSK06) | Research and development full-time employees (R&D) (researchers) in enterprises by industry - size class - region etc., type of staff, sex | 2007–2010 | no |
| [FORSK07](https://www.statbank.dk/FORSK07) | Enterprises own research and development expenses (R&D) by industry - size class - region etc., expenses by end product | 2009 | no |
| [FORSK08](https://www.statbank.dk/FORSK08) | Enterprises  reseaurch and development expenses (R&D) by industry - size class - region etc., expenses by end product | 2009 | no |
| [INN01](https://www.statbank.dk/INN01) | Enterprises expenses for own R&D by industry - size class - region etc., type of cost | 2007–2016 | no |
| [INN02](https://www.statbank.dk/INN02) | Innovative enterprises by industry - size class - region etc., type of innovation | 2007–2016 | no |
| [INN03](https://www.statbank.dk/INN03) | Primary developer of product innovations by industry - size class - region etc., type of company | 2007–2010 | no |
| [INN04](https://www.statbank.dk/INN04) | Product innovative enterprises by industry - size class - region etc., type of product innovation | 2007–2016 | no |
| [INN05](https://www.statbank.dk/INN05) | Productinnovative enterprises turnover from goods and services by industry - size class - region etc., degree of novelty | 2007–2016 | no |
| [INN06](https://www.statbank.dk/INN06) | Procesinnovative enterprises by industry - size class - region etc., procesinnovation | 2007–2016 | no |
| [INN07](https://www.statbank.dk/INN07) | Primary developer of process innovations by industry - size class - region etc., procesinnovation | 2007–2010 | no |
| [INN09](https://www.statbank.dk/INN09) | Innovative enterprises with innovation cooperation by industry - size class - region etc., cooperation concerning innovation activities | 2007–2016 | no |
| [INN11](https://www.statbank.dk/INN11) | Enterprises expenses for own R&D by industry and size class, region, type of expenses | 2018 | no |
| [INN12](https://www.statbank.dk/INN12) | Innovative enterprises by industry and size class, region, type of innovation | 2018 | no |
| [INN13](https://www.statbank.dk/INN13) | Product innovative enterprises by industry and size class, region, product innovation type | 2018 | no |
| [INN14](https://www.statbank.dk/INN14) | Procesinnovative enterprises by industry and size class, region, proces innovation type | 2018 | no |
| [INN15](https://www.statbank.dk/INN15) | Enterprises by industry and size class, region, cooperation subject | 2018 | no |
| [STATUS22](https://www.statbank.dk/STATUS22) | 18-25 year-olds by status for upper secondary school and vocational education, age, sex, basic school location, ancestry | 2005–2022 | no |
| [STATUS50](https://www.statbank.dk/STATUS50) | 25-45 year-olds by status for higher education, age, sex, basic school location, ancestry | 2005–2022 | no |
| [U19107](https://www.statbank.dk/U19107) | Enrolled, upper secondary school by education, region, ancestry, national origin, sex | 2005–2014 | no |
| [U29107](https://www.statbank.dk/U29107) | Entrants, upper secondary school by education, region, ancestry, national origin, sex | 2005–2014 | no |
| [U39107](https://www.statbank.dk/U39107) | Graduates, upper secondary school by education, region, ancestry, national origin, sex | 2005–2014 | no |
| [SKOVRG01](https://www.statbank.dk/SKOVRG01) | Growing stock (physical account) by balance items, species of wood, region | 1990–2023 | no |
| [SKOVRG02](https://www.statbank.dk/SKOVRG02) | Growing stock (monetary account) by balance items, species of wood, region | 1990–2023 | no |
| [AKU102](https://www.statbank.dk/AKU102) | Labour force status by employment status, region | 2007Q1–2019Q1 | no |
| [AKU122](https://www.statbank.dk/AKU122) | Labour force status in percentage by employment status, region | 2007Q1–2019Q1 | no |
| [AKU200](https://www.statbank.dk/AKU200) | Employed (in thousands) by industry (DB07 10-grouping), region, sex | 2007Q1–2019Q1 | no |
| [AKU201](https://www.statbank.dk/AKU201) | Employed (in thousands) by region, age, sex | 2007Q1–2019Q1 | no |
| [AKU220K](https://www.statbank.dk/AKU220K) | Employed (in thousands) by industry (DB07 10-grouping), region, sex | 2008Q1–2025Q4 | no |
| [AKU23](https://www.statbank.dk/AKU23) | Population by employment status, region | 2007Q1–2011Q2 | no |
| [AKU24](https://www.statbank.dk/AKU24) | Population by employment status, region | 2007Q1–2011Q2 | no |
| [AKU33](https://www.statbank.dk/AKU33) | Employed (in thousands) by industry (DB07 10-grouping), region, sex | 2007Q1–2011Q2 | no |
| [AKU44](https://www.statbank.dk/AKU44) | Employed (in thousands) by region, age, sex | 2007Q1–2011Q2 | no |
| [FRA06](https://www.statbank.dk/FRA06) | Absence due to own sickness (municipalities) by region, occupation, sex, age, indicator of absence | 2007–2009 | no |
| [FRA10](https://www.statbank.dk/FRA10) | Absence in governmental sector by region, sex, cause of absence, industry (DB07), indicator of absence | 2010–2013 | no |
| [FRA11](https://www.statbank.dk/FRA11) | Absence in the governmental sector by region, sex, cause of absence, occupation, indicator of absence | 2010–2013 | no |
| [FRA13](https://www.statbank.dk/FRA13) | Absence in the regional sector by region, sex, cause of absence, occupation, indicator of absence | 2010–2013 | no |
| [INDKP2](https://www.statbank.dk/INDKP2) | Income, total by region, unit, sex, income interval | 2000–2012 | no |
| [INDKP3](https://www.statbank.dk/INDKP3) | Persons by region, unit, sex, income interval, type of income | 2000–2012 | no |
| [LON033](https://www.statbank.dk/LON033) | Earnings for employees in the private sector by region, group of employees, components, sex | 2006–2010 | no |
| [LON333](https://www.statbank.dk/LON333) | Earnings for central government employees by region, components, sex | 2006–2010 | no |
| [LON433](https://www.statbank.dk/LON433) | Earnings for local government employees by region, components, sex | 2006–2010 | no |
| [SLON30](https://www.statbank.dk/SLON30) | Earnings by region, sector, salary, salary earners, components, sex | 2009–2013 | no |
| [AMBU002](https://www.statbank.dk/AMBU002) | Out-patients in somatics and psychiatry by region of residence, type of hospital service, treatments, age, sex | 2019–2023 | no |
| [AMBU003](https://www.statbank.dk/AMBU003) | Out-patients in public and private hospitals by region of residence, type of hospital, age, sex | 2019–2023 | no |
| [FOD507](https://www.statbank.dk/FOD507) | Deaths by region, cause of death, age, sex | 2007–2019 | no |
| [INDL002](https://www.statbank.dk/INDL002) | Hospital patients in somatics and psychiatry by region of residence, type of hospital service, admissions, age, sex | 2019–2023 | no |
| [INDL003](https://www.statbank.dk/INDL003) | Hospital patients in public and private hospitals by region of residence, type of hospital, age, sex | 2019–2023 | no |
| [MEDI1A](https://www.statbank.dk/MEDI1A) | Sale of prescription drugs (experimental statistics) by region, type of medicine, key figures, sex, age | 2016–2021 | no |
| [BU24](https://www.statbank.dk/BU24) | Alcohol- and substance abuse among isadvantaged by region of residence, treatment, target/control group | 2009–2015 | no |
| [RESANDHJ](https://www.statbank.dk/RESANDHJ) | Household receiving other care to terminal care by region, age | 2014–2021 | no |
| [RESDHJCE](https://www.statbank.dk/RESDHJCE) | Special day-care institution by region, visitation | 2016–2022 | no |
| [RESPLEJV](https://www.statbank.dk/RESPLEJV) | Allowance to terminal care by region, duration, recipients, age | 2014–2021 | no |
| [RESSBU2](https://www.statbank.dk/RESSBU2) | Special institutions for children and juveniles by region, age | 2019–2022 | no |

</details>

<details><summary>part of country: 16 tables (7 active)</summary>

| Code | Contents | Period | Active |
|---|---|---|---|
| [AFG3](https://www.statbank.dk/AFG3) | Farms and area with selected crops by region, Area with the crop, unit | 1982–2025 | yes |
| [AFG4](https://www.statbank.dk/AFG4) | Farms with cereals by region(2), type of farm, area | 1982–2025 | yes |
| [BDF6](https://www.statbank.dk/BDF6) | Farm workers by region, number of employees, type of farm | 1982–2023 | yes |
| [SKOV55A](https://www.statbank.dk/SKOV55A) | Felling in forest and plantation in Denmark by region, species of wood | 1950–1989 | yes |
| [SKOV6](https://www.statbank.dk/SKOV6) | Felling in forests and plantation in Denmark by region, species of wood, area | 1990–2024 | yes |
| [IDRFU16](https://www.statbank.dk/IDRFU16) | Sports consumption by group of consumption, region | 2015–2024 | yes |
| [FU17](https://www.statbank.dk/FU17) | Consumption by group of consumption, region, price unit | 2015–2024 | yes |
| [BAER](https://www.statbank.dk/BAER) | Production of berries and stone fruit by region, crop, unit | 1997–2010 | no |
| [FL1](https://www.statbank.dk/FL1) | Area and production of outdoor vegetables by region, unit, type of farming, crop | 2000–2009 | no |
| [GAARD1](https://www.statbank.dk/GAARD1) | Farms with farm shop by region, type of farm | 2012–2017 | no |
| [SKOV10](https://www.statbank.dk/SKOV10) | Sale of beech and conifer by region, species of wood, area | 2006–2014 | no |
| [VHUS](https://www.statbank.dk/VHUS) | Crops in green house by region, crop, unit | 1982–2017 | no |
| [IDRFU06](https://www.statbank.dk/IDRFU06) | Sports consumption by group of consumption, region | 2014–2022 | no |
| [FU07](https://www.statbank.dk/FU07) | Consumption by group of consumption, region, price unit | 1994–2022 | no |
| [AKU3](https://www.statbank.dk/AKU3) | Employed (in thousands) by industry, region, sex | 1995Q1–2006Q4 | no |
| [AKU4](https://www.statbank.dk/AKU4) | Employed (in thousands) by region, age, sex | 1995Q1–2006Q4 | no |

</details>
