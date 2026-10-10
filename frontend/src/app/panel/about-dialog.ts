import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoPipe } from '@jsverse/transloco';
import { BuildInfoService } from '../data/build-info';
import { PilotData } from '../data/pilot-data';
import { I18n } from '../i18n/i18n';

export interface DataSource {
  /** Names the source's Danish texts in da.json (about.sources). */
  id: string;
  name: string;
  /** Where to read about the source. */
  url: string;
  /** What the map takes from it. */
  uses: string;
  /** The licence or terms, with a link to them when there are any. */
  licence: { name: string; url: string | null };
  /** How the source asks to be credited, or a courtesy credit when it asks for none. */
  credit: string;
  /** What we changed, or anything else the licence wants said. */
  note?: string;
  /** Further links, such as the tables a statistic comes from; "pack:" links go to the data pack. */
  links?: { label: string; url: string }[];
  /** What the links are, when they are not tables: the key of its name. */
  linksTitle?: 'about.licenceTexts';
}

const CC_BY = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

/**
 * Every source the map uses, each credited as it asks. Checked against the providers' own terms on
 * 2026-10-09 (docs/data-sources.md). The English is here; the Danish is in da.json, by id.
 */
export const SOURCES: DataSource[] = [
  {
    id: 'osm', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org',
    uses: 'Forests, lakes, the coast, beaches, solar parks, overhead power lines, airports and airfields, supermarkets, stations, pharmacies, libraries, roads and paths, address points and municipalities, and the basemap of Denmark (through Protomaps).',
    licence: { name: 'Open Database License 1.0 (ODbL)', url: 'https://www.openstreetmap.org/copyright' },
    credit: '© OpenStreetMap contributors',
    note: 'The data layers made from it are under the ODbL too.',
  },
  {
    id: 'transit', name: 'Rejseplanen', url: 'https://www.rejseplanen.dk',
    uses: 'The timetables of every bus, train, metro, light rail and ferry, as a GTFS feed: for the travel times to your places by public transport, and the departures near every cell.',
    licence: CC_BY,
    credit: 'Køreplaner: Rejseplanen',
    note: 'Changed: travel times found on the timetable of a weekday.',
  },
  {
    id: 'water', name: 'GEUS', url: 'https://doi.org/10.22008/FK2/5OZV7W',
    uses: 'The hardness of the drinking water in the public waterworks’ supply areas, from the national borehole database Jupiter (samples up to 2023).',
    licence: CC_BY,
    credit: 'Drikkevandets hårdhed: GEUS',
    note: "Changed: put on the map's 100 m cells.",
  },
  {
    id: 'mst', name: 'Miljøstyrelsen', url: 'https://miljoegis.mim.dk',
    uses: 'Noise from roads, railways, airports and industry, from the strategic noise mapping 2022 (Lden).',
    licence: CC_BY,
    credit: 'Støjkortlægning 2022: Miljøstyrelsen',
    note: "Changed: put on the map's 100 m cells. Where it has no data, the noise is our own estimate.",
  },
  {
    id: 'dce', name: 'DCE, through Danmarks Miljøportal', url: 'https://arealdata.miljoeportal.dk',
    uses: 'Nitrogen dioxide (NO₂) and fine particles (PM2.5): yearly means for 2024 on a 1 km grid, from DCE’s model of the air.',
    licence: CC_BY,
    credit: 'Luftkvalitet 2024: DCE – Nationalt Center for Miljø og Energi, Aarhus Universitet',
    note: "Changed: put on the map's 100 m cells. A model, not a measurement at the address.",
  },
  {
    id: 'protected', name: 'Miljøstyrelsen and the regions, through Danmarks Miljøportal', url: 'https://arealdata.miljoeportal.dk',
    uses: 'Fredninger of land in force, which protect landscapes and nature, the Natura 2000 areas for habitats and birds, and the areas the regions’ raw material plans set aside for digging, now or later.',
    licence: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    credit: 'Fredede områder og Natura 2000: Miljøstyrelsen; råstofområder: regionerne; Danmarks Miljøportal',
    note: "Changed: put on the map's 100 m cells. CC0 asks for no credit; it is given as a courtesy.",
  },
  {
    id: 'plandata', name: 'Plandata.dk', url: 'https://www.plandata.dk',
    uses: 'Planning zones: byzone, landzone and sommerhusområde, from the zone map; the roads and railways the municipal plans lay out; the local plans of the last two years; the zones around businesses and plants; and the district heating areas of the heat plans.',
    licence: CC_BY,
    credit: 'Zonekort, planlagte trafikanlæg, lokalplaner, konsekvensområder og forsyningsområder: Plan- og Landdistriktsstyrelsen, Plandata.dk',
    note: "Changed: put on the map's 100 m cells.",
  },
  {
    id: 'schools', name: 'STIL Institutionsregisteret', url: 'https://institutionsregisteret.stil.dk',
    uses: 'Folkeskoler, friskoler and private schools.',
    licence: { name: 'No licence stated; the register is public', url: null },
    credit: 'Source: Styrelsen for It og Læring, Institutionsregisteret',
  },
  {
    id: 'daycare', name: 'STIL Dagtilbudsregisteret', url: 'https://dagtilbudsregister.stil.dk',
    uses: 'Daycare units.',
    licence: { name: 'No licence stated; the data is free for everyone, says STIL', url: null },
    credit: 'Source: Styrelsen for It og Læring, Dagtilbudsregisteret',
  },
  {
    id: 'ens', name: 'Energistyrelsen', url: 'https://ens.dk/analyser-og-statistik/data-oversigt-over-energisektoren',
    uses: 'Wind turbines in operation, with their height, from the master data register.',
    licence: { name: "Energistyrelsen's terms: free to use with the source named", url: 'https://ens.dk/om-os/datapolitik' },
    credit: 'Source: Energistyrelsen',
    note: 'The distance to the nearest turbine is our own calculation.',
  },
  {
    id: 'dst', name: 'Danmarks Statistik', url: 'https://www.statistikbanken.dk',
    uses: 'Income tax and land tax, population, home burglaries, mean disposable income, nursery rates and class sizes per municipality.',
    licence: { name: 'Free to use with the source named, as CC BY 4.0', url: 'https://www.dst.dk/da/presse/kildeangivelse' },
    credit: 'Source: our own calculations based on figures from Danmarks Statistik',
    links: [
      { label: 'PSKAT', url: 'https://www.statistikbanken.dk/PSKAT' },
      { label: 'FOLK1A', url: 'https://www.statistikbanken.dk/FOLK1A' },
      { label: 'STRAF22', url: 'https://www.statistikbanken.dk/STRAF22' },
      { label: 'INDKP101', url: 'https://www.statistikbanken.dk/INDKP101' },
      { label: 'RES88', url: 'https://www.statistikbanken.dk/RES88' },
      { label: 'KVOTIEN', url: 'https://www.statistikbanken.dk/KVOTIEN' },
    ],
  },
  {
    id: 'protomaps', name: 'Protomaps', url: 'https://github.com/protomaps/basemaps',
    uses: 'The basemap of Denmark: tiles made from OpenStreetMap, and the map style.',
    licence: { name: 'Tiles: ODbL (OpenStreetMap). Style: CC0. Code: BSD-3-Clause', url: 'https://docs.protomaps.com/basemaps/downloads' },
    credit: 'Protomaps © OpenStreetMap',
  },
  {
    id: 'worldcover', name: 'ESA WorldCover', url: 'https://esa-worldcover.org',
    uses: "Land cover in the basemap when the map is zoomed out, part of Protomaps' tiles.",
    licence: CC_BY,
    credit: '© ESA WorldCover project 2020 / Contains modified Copernicus Sentinel data (2020) processed by ESA WorldCover consortium',
  },
  {
    id: 'mapFonts', name: 'Fonts and icons', url: 'https://github.com/protomaps/basemaps-assets',
    uses: "The map's labels and icons.",
    licence: { name: 'Noto fonts: SIL Open Font License 1.1. Icons: MIT', url: 'https://openfontlicense.org' },
    credit: 'Noto fonts © 2022 The Noto Project Authors. Icons © 2017 Mapzen.',
    linksTitle: 'about.licenceTexts',
    links: [{ label: 'Noto fonts', url: 'pack:licences/noto-fonts-OFL.txt' }, { label: 'Icons', url: 'pack:licences/icons-MIT.md' }],
  },
  {
    id: 'appFonts', name: 'Roboto and Material Symbols', url: 'https://fonts.google.com',
    uses: "The app's own text and icons, served by this server, not by Google.",
    licence: { name: 'Roboto: SIL Open Font License 1.1. Material Symbols: Apache License 2.0', url: 'https://openfontlicense.org' },
    credit: 'Roboto © 2011 The Roboto Project Authors. Material Symbols © Google.',
    linksTitle: 'about.licenceTexts',
    links: [{ label: 'Roboto', url: 'licences/roboto/LICENSE' }, { label: 'Material Symbols', url: 'licences/material-symbols/LICENSE' }],
  },
  {
    id: 'naturalEarth', name: 'Natural Earth', url: 'https://www.naturalearthdata.com',
    uses: 'The world map outside Denmark.',
    licence: { name: 'Public domain', url: 'https://www.naturalearthdata.com/about/terms-of-use/' },
    credit: 'Made with Natural Earth',
  },
];

/** How the map is made, and every source it uses with its licence and credit. */
@Component({
  selector: 'app-about-dialog',
  imports: [MatButtonModule, MatDialogModule, MatDividerModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title class="head">{{ 'footer.about' | transloco }}</h2>
    <mat-dialog-content class="body">
      <section class="how" aria-labelledby="about-how">
        <h3 id="about-how">{{ 'about.how' | transloco }}</h3>
        <p>{{ (detail() ? 'about.cellsDetail' : 'about.cells') | transloco: { cell: cell(), detail: detail() ?? '' } }} {{ 'about.scores' | transloco }}</p>
        <p>{{ 'about.homes' | transloco }}</p>
        <p>{{ 'about.noise' | transloco }}</p>
        <p>{{ 'about.rules' | transloco }}</p>
        <p>{{ 'about.travel' | transloco }}</p>
        <p>{{ 'about.colours' | transloco }}</p>
      </section>
      <mat-divider />
      <section aria-labelledby="about-sources">
        <h3 id="about-sources">{{ 'about.sourcesTitle' | transloco }}</h3>
        <p>{{ 'about.sourcesIntro' | transloco }} {{ 'about.libraries' | transloco }} <a href="licences/third-party.txt" target="_blank" rel="noopener">{{ 'about.librariesLink' | transloco }}</a>.</p>
        <div class="sources">
          @for (s of sources; track s.id; let last = $last) {
            @let name = text(s, 'name');
            <section class="source" [attr.aria-label]="name">
              <div class="what">
                <h4><a [href]="s.url" target="_blank" rel="noopener">{{ name }}</a></h4>
                <p class="uses">{{ text(s, 'uses') }}</p>
              </div>
              <dl>
                <dt>{{ 'about.licence' | transloco }}</dt>
                <dd>
                  @if (s.licence.url) {
                    <a [href]="s.licence.url" target="_blank" rel="noopener">{{ text(s, 'licence') }}</a>
                  } @else {
                    {{ text(s, 'licence') }}
                  }
                </dd>
                <dt>{{ 'about.credit' | transloco }}</dt>
                <dd class="credit">{{ text(s, 'credit') }}</dd>
                @if (s.links) {
                  <dt>{{ (s.linksTitle ?? 'about.tables') | transloco }}</dt>
                  <dd>
                    @for (link of s.links; track link.url; let last = $last) {
                      <a [href]="href(link.url)" target="_blank" rel="noopener">{{ linkLabel(link.label) }}</a>{{ last ? '' : ', ' }}
                    }
                  </dd>
                }
                @if (s.note) {
                  <dt>{{ 'about.note' | transloco }}</dt>
                  <dd>{{ text(s, 'note') }}</dd>
                }
              </dl>
            </section>
            @if (!last) {
              <mat-divider />
            }
          }
        </div>
      </section>
      <p class="meta">{{ 'about.meta' | transloco: { built: built() ?? ('about.unknown' | transloco), version: version().text } }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.close' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    /* The headline as an M3 dialog has it, with room around it */
    .head { padding: 24px 24px 16px; font: var(--mat-sys-headline-small); color: var(--mat-sys-on-surface); }
    .head::before { display: none; }
    .body { display: flex; flex-direction: column; gap: 24px; }
    h3 { margin: 0 0 8px; font: var(--mat-sys-title-medium); color: var(--mat-sys-on-surface); }
    p { margin: 0 0 8px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .how { max-width: 72ch; }
    a { color: var(--mat-sys-primary); }
    /* A row per source across the dialog, with a divider between: what it is on the left, its terms on the right */
    .sources { margin-top: 8px; }
    .source { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 8px 32px; padding: 16px 0; }
    @media (max-width: 720px) { .source { grid-template-columns: minmax(0, 1fr); } }
    h4 { margin: 0 0 4px; font: var(--mat-sys-title-small); }
    h4 a { text-decoration: none; }
    h4 a:hover { text-decoration: underline; }
    .uses { margin: 0; }
    dl { display: grid; grid-template-columns: max-content 1fr; align-content: start; gap: 4px 12px; margin: 0; font: var(--mat-sys-body-small); }
    dt { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-medium); }
    dd { margin: 0; color: var(--mat-sys-on-surface); overflow-wrap: anywhere; }
    .meta { margin: 0; font: var(--mat-sys-body-small); }
  `],
})
export class AboutDialog {
  private readonly data = inject(PilotData);
  private readonly i18n = inject(I18n);
  protected readonly sources = SOURCES;
  protected readonly version = inject(BuildInfoService).label;
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);
  /** The detail tiles' cell size, when the pack has them. */
  protected readonly detail = computed(() => this.data.grid()?.meta.tiles?.cellMetres ?? null);
  protected readonly built = computed(() => this.data.grid()?.meta.built ?? null);

  /** A source's text in the language in use: the English of SOURCES, or its Danish in da.json. */
  protected text(source: DataSource, field: 'name' | 'uses' | 'licence' | 'credit' | 'note'): string {
    const english = field === 'licence' ? source.licence.name : (source[field] ?? '');
    return this.i18n.lookup(`about.sources.${source.id}.${field}`) ?? english;
  }

  protected linkLabel(label: string): string {
    return this.i18n.phrase('aboutLinks', label) ?? label;
  }

  /** A link as it is written, or in the data pack for "pack:". */
  protected href(url: string): string {
    return url.startsWith('pack:') ? `${this.data.base}${url.slice(5)}` : url;
  }
}
