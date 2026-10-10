import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { TranslocoPipe } from '@jsverse/transloco';
import { DEFAULT_VIEW, ViewState } from '@boligmaskinen/engine';
import { I18n } from '../i18n/i18n';
import { PilotData } from '../data/pilot-data';
import { PALETTES, rampGradient } from '../map/colours';
import { HeatService } from '../map/heat.service';
import { Store } from '../state/store';
import { ThemeService } from '../theme/theme.service';
import { Histogram } from './histogram';

/**
 * The map panel, the upper of the two that float over the map: which cells it shows and from how
 * many points, the points as a histogram, and the map's settings.
 */
@Component({
  selector: 'app-map-panel',
  imports: [
    MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatExpansionModule, MatFormFieldModule, MatIconModule, MatProgressBarModule,
    MatSelectModule, MatSliderModule, TranslocoPipe, Histogram,
  ],
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  protected readonly store = inject(Store);
  protected readonly data = inject(PilotData);
  private readonly heat = inject(HeatService);
  private readonly i18n = inject(I18n);
  private readonly theme = inject(ThemeService);
  /** On a phone the panel has no head: it is a card at the top, with the weighting in the sheet below. */
  readonly compact = input(false);
  readonly closePanel = output<void>();
  /** The app's logo, a house with a magnifying glass, drawn from Material Symbols' home and search; the same as public/favicon.svg. */
  protected readonly logo = 'M480-840L160-600L160-120L487.9-120A250 250 0 0 1 430-280A250 250 0 0 1 680-530A250 250 0 0 1 800-499.3L800-600L480-840zM646.4-447.7C609.3-447.7 577.8-434.7 551.8-408.7C525.8-382.7 512.8-351.3 512.8-314.6C512.8-277.9 525.8-246.5 551.8-220.5C577.8-194.5 609.5-181.5 647-181.5C662.6-181.5 677.3-184 691.2-189C705-194 717.2-201.1 727.6-210.1L864.3-73.3L887.2-96.2L749.9-232.4C759.6-244.6 766.9-257.6 771.8-271.4C776.6-285.3 779-299.7 779-314.6C779-351.3 766.1-382.7 740.3-408.7C714.5-434.7 683.2-447.7 646.4-447.7zM646.4-416.5C674.5-416.5 698.4-406.6 718.2-386.6C738-366.7 747.8-342.7 747.8-314.6C747.8-286.5 738-262.5 718.2-242.6C698.4-222.6 674.5-212.7 646.4-212.7C618-212.7 593.8-222.6 573.9-242.6C554-262.5 544-286.5 544-314.6C544-342.7 554-366.7 573.9-386.6C593.8-406.6 618-416.5 646.4-416.5z';

  protected readonly stats = this.heat.stats;
  protected readonly view = this.store.view;

  /** The size of a data cell, as the panel describes it. */
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);
  protected readonly region = computed(() => this.data.grid()?.meta.region?.name ?? '');
  /** "200 m cells", and with detail tiles "200 m cells, 100 m up close". */
  protected readonly cells = computed(() => {
    const tiles = this.data.grid()?.meta.tiles;
    return tiles && tiles.cellMetres < this.cell()
      ? this.i18n.t('mapPanel.cellsUpClose', { size: this.cell(), close: tiles.cellMetres })
      : this.i18n.t('mapPanel.cells', { size: this.cell() });
  });

  /** There are preferences, but none of them counts: their groups are off, or their weight is 0. */
  protected readonly allOff = computed(() =>
    this.store.blocks().some((b) => b.role === 'want') && !this.store.activeBlocks().some((b) => b.role === 'want' && b.weight > 0));

  /**
   * The result in words, for screen readers: the panel shows the histogram, not the numbers. The
   * histogram's canvas carries it as its label.
   */
  protected readonly resultDescription = computed(() => {
    const s = this.stats();
    if (!s?.hasPreferences) return '';
    const cells = (n: number) => n.toLocaleString(this.i18n.locale());
    if (this.view().show === 'all') return this.i18n.t('mapPanel.describeAll', { considered: cells(s.considered), median: s.median });
    return this.i18n.t('mapPanel.describeLimit', { shown: cells(s.shown), considered: cells(s.considered), limit: s.limit });
  });

  protected readonly mapSummary = computed(() => {
    const v = this.view();
    const palette = this.palette().name;
    const colours = v.palette === DEFAULT_VIEW.palette && v.bands === 'smooth' ? '' : ` · ${v.bands === 'steps' ? this.i18n.t('mapPanel.inSteps', { palette }) : palette}`;
    return `${this.i18n.t(`mapPanel.summaryCells.${v.cells}`)} · ${this.i18n.t(`mapPanel.summarySmooth.${v.smooth}`)}${colours}`;
  });

  // The heatmap's colours, each with a swatch in the current light or dark mode
  protected readonly palettes = computed(() => PALETTES.map((p) => ({
    ...p,
    name: this.i18n.t(`palettes.${p.id}.name`),
    note: p.note && this.i18n.t(`palettes.${p.id}.note`),
    swatch: rampGradient(p.id, this.theme.scheme(), this.view().bands),
  })));
  protected readonly palette = computed(() => this.palettes().find((p) => p.id === this.view().palette) ?? this.palettes()[0]);

  protected setView(patch: Partial<ViewState>): void {
    this.store.setView(patch);
  }

  protected onLimit(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.store.setView(this.view().show === 'top' ? { top: value } : { abs: value });
  }

  protected onOpacity(event: Event): void {
    this.store.setView({ opacity: Number((event.target as HTMLInputElement).value) });
  }

  protected percent = (value: number) => `${Math.round(value * 100)} %`;
  protected best = (value: number) => this.i18n.t('mapPanel.topFormat', { value });
}
