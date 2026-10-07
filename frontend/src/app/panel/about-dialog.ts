import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { BuildInfoService } from '../data/build-info';
import { PilotData } from '../data/pilot-data';

export interface DataSource {
  name: string;
  data: string;
  licence: string;
  url: string;
}

/** Where every layer of the map comes from. */
export const SOURCES: DataSource[] = [
  { name: 'OpenStreetMap', data: 'Forests, lakes, coast, beaches, supermarkets, stations, roads, address points, municipalities', licence: '© OpenStreetMap contributors, ODbL', url: 'https://www.openstreetmap.org/copyright' },
  { name: 'Miljøstyrelsen', data: 'Road noise, strategic noise maps 2022 (Lden)', licence: 'Open data', url: 'https://miljoegis.mim.dk' },
  { name: 'Plandata.dk', data: 'Planning zones: byzone, landzone and sommerhusområde', licence: 'Open data', url: 'https://www.plandata.dk' },
  { name: 'STIL Institutionsregisteret', data: 'Folkeskoler, friskoler and private schools', licence: 'Open data', url: 'https://institutionsregisteret.stil.dk' },
  { name: 'STIL Dagtilbudsregisteret', data: 'Daycare units', licence: 'Open data', url: 'https://dagtilbudsregister.stil.dk' },
  { name: 'Energistyrelsen', data: 'Wind turbines in operation', licence: 'Open data', url: 'https://ens.dk/analyser-og-statistik/data-oversigt-over-energisektoren' },
  { name: 'Danmarks Statistik', data: 'Income tax, land tax, population and home burglaries per municipality', licence: 'Open data', url: 'https://www.statistikbanken.dk' },
  { name: 'Protomaps', data: 'The basemap of Denmark, made from OpenStreetMap', licence: 'ODbL data, BSD style', url: 'https://protomaps.com' },
  { name: 'Natural Earth', data: 'The world map outside Denmark', licence: 'Public domain', url: 'https://www.naturalearthdata.com' },
];

/** How the map is made and where its data comes from. */
@Component({
  selector: 'app-about-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>About the data</h2>
    <mat-dialog-content class="content">
      <section>
        <h3>How the map is made</h3>
        <p>Denmark is divided into {{ cell() }} m cells. Every cell gets a value for each data layer, and every block in your weighting turns those values into a score. The map shows the blocks averaged by their importance.</p>
        <p>Homes are approximated by address points from OpenStreetMap, which are imported from the national address register. Cells in industrial areas are left out.</p>
        <p>Road noise comes from Miljøstyrelsen's 2022 noise mapping where it exists: every road in Copenhagen, Aarhus, Odense and Aalborg, and the major roads elsewhere. Other places are estimated from road type and distance.</p>
        <p>Forests and lakes count from 5 ha. Schools are folkeskoler, friskoler and private schools. Wind turbines are those in operation. Tax and burglaries are per municipality.</p>
        <p>Travel times to your places are estimates from straight-line distance until a routing service is in place.</p>
        <p>Colours are stretched over the points currently shown, so the map always shows the differences that matter. Outside Denmark the map shows Natural Earth's world map.</p>
      </section>
      <section>
        <h3>Where the data comes from</h3>
        <ul class="sources">
          @for (s of sources; track s.name) {
            <li>
              <a [href]="s.url" target="_blank" rel="noopener">{{ s.name }}</a>
              <span class="data">{{ s.data }}</span>
              <span class="licence">{{ s.licence }}</span>
            </li>
          }
        </ul>
        <p class="meta">Data built {{ built() }} · app {{ version().text }}</p>
      </section>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .content { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    h3 { margin: 0 0 8px; font: var(--mat-sys-title-small); }
    p { margin: 0 0 8px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .sources { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .sources li { display: flex; flex-direction: column; }
    .sources a { font: var(--mat-sys-title-small); color: var(--mat-sys-primary); }
    .data, .licence { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .meta { margin-top: 14px; font: var(--mat-sys-body-small); }
    @media (max-width: 720px) { .content { grid-template-columns: 1fr; } }
  `],
})
export class AboutDialog {
  private readonly data = inject(PilotData);
  protected readonly sources = SOURCES;
  protected readonly version = inject(BuildInfoService).label;
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);
  protected readonly built = computed(() => this.data.grid()?.meta.built ?? 'unknown');
}
