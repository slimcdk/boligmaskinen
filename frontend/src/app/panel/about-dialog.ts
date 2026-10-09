import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { BuildInfoService } from '../data/build-info';
import { PilotData } from '../data/pilot-data';

export interface DataSource {
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
  /** Further links, such as the tables a statistic comes from. */
  links?: { label: string; url: string }[];
}

const CC_BY = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

/**
 * Every source the map uses, each credited as it asks. Checked against the providers' own terms on
 * 2026-10-09 (docs/data-sources.md).
 */
export const SOURCES: DataSource[] = [
  {
    name: 'OpenStreetMap', url: 'https://www.openstreetmap.org',
    uses: 'Forests, lakes, the coast, beaches, supermarkets, stations, roads, address points and municipalities, and the basemap of Denmark (through Protomaps).',
    licence: { name: 'Open Database License 1.0 (ODbL)', url: 'https://www.openstreetmap.org/copyright' },
    credit: '© OpenStreetMap contributors',
    note: 'The data layers made from it are under the ODbL too.',
  },
  {
    name: 'Miljøstyrelsen', url: 'https://miljoegis.mim.dk',
    uses: 'Road noise from the strategic noise mapping 2022 (Lden).',
    licence: CC_BY,
    credit: 'Støjkortlægning 2022: Miljøstyrelsen',
    note: "Changed: put on the map's 100 m cells. Where it has no data, the noise is our own estimate.",
  },
  {
    name: 'Plandata.dk', url: 'https://www.plandata.dk',
    uses: 'Planning zones: byzone, landzone and sommerhusområde, from the zone map.',
    licence: CC_BY,
    credit: 'Zonekort: Plan- og Landdistriktsstyrelsen, Plandata.dk',
    note: "Changed: put on the map's 100 m cells.",
  },
  {
    name: 'STIL Institutionsregisteret', url: 'https://institutionsregisteret.stil.dk',
    uses: 'Folkeskoler, friskoler and private schools.',
    licence: { name: 'No licence stated; the register is public', url: null },
    credit: 'Source: Styrelsen for It og Læring, Institutionsregisteret',
  },
  {
    name: 'STIL Dagtilbudsregisteret', url: 'https://dagtilbudsregister.stil.dk',
    uses: 'Daycare units.',
    licence: { name: 'No licence stated; the data is free for everyone, says STIL', url: null },
    credit: 'Source: Styrelsen for It og Læring, Dagtilbudsregisteret',
  },
  {
    name: 'Energistyrelsen', url: 'https://ens.dk/analyser-og-statistik/data-oversigt-over-energisektoren',
    uses: 'Wind turbines in operation, from the master data register.',
    licence: { name: "Energistyrelsen's terms: free to use with the source named", url: 'https://ens.dk/om-os/datapolitik' },
    credit: 'Source: Energistyrelsen',
    note: 'The distance to the nearest turbine is our own calculation.',
  },
  {
    name: 'Danmarks Statistik', url: 'https://www.statistikbanken.dk',
    uses: 'Income tax and land tax, population and home burglaries per municipality.',
    licence: { name: 'Free to use with the source named, as CC BY 4.0', url: 'https://www.dst.dk/da/presse/kildeangivelse' },
    credit: 'Source: our own calculations based on figures from Danmarks Statistik',
    links: [
      { label: 'PSKAT', url: 'https://www.statistikbanken.dk/PSKAT' },
      { label: 'FOLK1A', url: 'https://www.statistikbanken.dk/FOLK1A' },
      { label: 'STRAF22', url: 'https://www.statistikbanken.dk/STRAF22' },
    ],
  },
  {
    name: 'Protomaps', url: 'https://github.com/protomaps/basemaps',
    uses: 'The basemap of Denmark: tiles made from OpenStreetMap, and the map style.',
    licence: { name: 'Tiles: ODbL (OpenStreetMap). Style: CC0. Code: BSD-3-Clause', url: 'https://docs.protomaps.com/basemaps/downloads' },
    credit: 'Protomaps © OpenStreetMap',
  },
  {
    name: 'ESA WorldCover', url: 'https://esa-worldcover.org',
    uses: "Land cover in the basemap when the map is zoomed out, part of Protomaps' tiles.",
    licence: CC_BY,
    credit: '© ESA WorldCover project 2020 / Contains modified Copernicus Sentinel data (2020) processed by ESA WorldCover consortium',
  },
  {
    name: 'Fonts and icons', url: 'https://github.com/protomaps/basemaps-assets',
    uses: "The map's labels and icons.",
    licence: { name: 'Noto fonts: SIL Open Font License 1.1. Icons: MIT', url: 'https://openfontlicense.org' },
    credit: 'Noto fonts © 2022 The Noto Project Authors. Icons © 2017 Mapzen.',
  },
  {
    name: 'Natural Earth', url: 'https://www.naturalearthdata.com',
    uses: 'The world map outside Denmark.',
    licence: { name: 'Public domain', url: 'https://www.naturalearthdata.com/about/terms-of-use/' },
    credit: 'Made with Natural Earth',
  },
];

/** How the map is made, and every source it uses with its licence and credit. */
@Component({
  selector: 'app-about-dialog',
  imports: [MatButtonModule, MatDialogModule, MatDividerModule],
  template: `
    <h2 mat-dialog-title class="head">About the data</h2>
    <mat-dialog-content class="body">
      <section class="how" aria-labelledby="about-how">
        <h3 id="about-how">How the map is made</h3>
        <p>Denmark is divided into {{ cell() }} m cells. Every cell gets a value for each data layer, and every block in your weighting turns those values into a score. The map shows the blocks averaged by their importance.</p>
        <p>Homes are approximated by address points from OpenStreetMap, which are imported from the national address register. Cells in industrial areas are left out.</p>
        <p>Road noise comes from Miljøstyrelsen's 2022 noise mapping where it exists: every road in Copenhagen, Aarhus, Odense and Aalborg, and the major roads elsewhere. Other places are estimated from road type and distance.</p>
        <p>Forests and lakes count from 5 ha. Schools are folkeskoler, friskoler and private schools. Wind turbines are those in operation. Tax and burglaries are per municipality.</p>
        <p>Travel times to your places are estimates from straight-line distance until a routing service is in place.</p>
        <p>Colours are stretched over the points currently shown, so the map always shows the differences that matter. Outside Denmark the map shows Natural Earth's world map.</p>
      </section>
      <mat-divider />
      <section aria-labelledby="about-sources">
        <h3 id="about-sources">Sources</h3>
        <p>Every source the map uses: what it gives, its licence, and how it asks to be credited.</p>
        <div class="sources">
          @for (s of sources; track s.name) {
            <section class="source" [attr.aria-label]="s.name">
              <h4><a [href]="s.url" target="_blank" rel="noopener">{{ s.name }}</a></h4>
              <p class="uses">{{ s.uses }}</p>
              <dl>
                <dt>Licence</dt>
                <dd>
                  @if (s.licence.url) {
                    <a [href]="s.licence.url" target="_blank" rel="noopener">{{ s.licence.name }}</a>
                  } @else {
                    {{ s.licence.name }}
                  }
                </dd>
                <dt>Credit</dt>
                <dd class="credit">{{ s.credit }}</dd>
                @if (s.links) {
                  <dt>Tables</dt>
                  <dd>
                    @for (link of s.links; track link.url; let last = $last) {
                      <a [href]="link.url" target="_blank" rel="noopener">{{ link.label }}</a>{{ last ? '' : ', ' }}
                    }
                  </dd>
                }
                @if (s.note) {
                  <dt>Note</dt>
                  <dd>{{ s.note }}</dd>
                }
              </dl>
            </section>
          }
        </div>
      </section>
      <p class="meta">Data built {{ built() }} · app {{ version().text }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
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
    /* A section per source, side by side where there is room: spacing groups them, not cards */
    .sources { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 24px 32px; margin-top: 16px; }
    h4 { margin: 0 0 4px; font: var(--mat-sys-title-small); }
    h4 a { text-decoration: none; }
    h4 a:hover { text-decoration: underline; }
    .uses { margin-bottom: 8px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; font: var(--mat-sys-body-small); }
    dt { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-medium); }
    dd { margin: 0; color: var(--mat-sys-on-surface); overflow-wrap: anywhere; }
    .meta { margin: 0; font: var(--mat-sys-body-small); }
  `],
})
export class AboutDialog {
  private readonly data = inject(PilotData);
  protected readonly sources = SOURCES;
  protected readonly version = inject(BuildInfoService).label;
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);
  protected readonly built = computed(() => this.data.grid()?.meta.built ?? 'unknown');
}
