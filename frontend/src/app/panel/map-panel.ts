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
import { DEFAULT_VIEW, ViewState } from '@boligmaskinen/engine';
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
    MatSelectModule, MatSliderModule, Histogram,
  ],
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  protected readonly store = inject(Store);
  protected readonly data = inject(PilotData);
  private readonly heat = inject(HeatService);
  private readonly theme = inject(ThemeService);
  /** On a phone the panel has no head: it is a card at the top, with the weighting in the sheet below. */
  readonly compact = input(false);
  readonly closePanel = output<void>();

  protected readonly stats = this.heat.stats;
  protected readonly view = this.store.view;

  /** The size of a data cell, as the panel describes it. */
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);
  protected readonly region = computed(() => this.data.grid()?.meta.region?.name ?? '');

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
    const cells = (n: number) => n.toLocaleString('en-US');
    if (this.view().show === 'all') return `Points of the ${cells(s.considered)} cells that meet your requirements, median ${s.median}`;
    return `${cells(s.shown)} of the ${cells(s.considered)} cells that meet your requirements, at least ${s.limit} points`;
  });

  protected readonly mapSummary = computed(() => {
    const v = this.view();
    const colours = v.palette === DEFAULT_VIEW.palette && v.bands === 'smooth' ? '' : ` · ${this.palette().name}${v.bands === 'steps' ? ' in steps' : ''}`;
    return `${v.cells === 'homes' ? 'Where homes are' : 'All land'} · ${['no smoothing', 'light smoothing', 'strong smoothing'][v.smooth]}${colours}`;
  });

  // The heatmap's colours, each with a swatch in the current light or dark mode
  protected readonly palettes = computed(() => PALETTES.map((p) => ({ ...p, swatch: rampGradient(p.id, this.theme.scheme(), this.view().bands) })));
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
  protected best = (value: number) => `Top ${value} %`;
}
