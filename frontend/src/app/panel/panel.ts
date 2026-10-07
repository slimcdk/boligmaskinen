import { Component, computed, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BuildInfoService } from '../data/build-info';
import { PilotData } from '../data/pilot-data';
import { PALETTES, rampGradient } from '../map/colours';
import { HeatService } from '../map/heat.service';
import { ThemeService } from '../theme/theme.service';
import { Store } from '../state/store';
import { PLACE_COLOURS, SUGGESTED, ViewState } from '@boligmaskinen/engine';
import { AboutDialog } from './about-dialog';
import { BlockRow } from './block-row';
import { CatalogData, CatalogDialog, CatalogResult } from './catalog-dialog';
import { ThemeToggle } from '../theme/theme-toggle';
import { Histogram } from './histogram';

/** The side panel: result, the blocks of the weighting with their controls, own places and folded settings. */
@Component({
  selector: 'app-panel',
  imports: [
    MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatChipsModule, MatExpansionModule, MatIconModule,
    MatProgressBarModule, MatSliderModule, MatTooltipModule, MatFormFieldModule, MatSelectModule, BlockRow, Histogram, ThemeToggle,
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  protected readonly store = inject(Store);
  protected readonly data = inject(PilotData);
  protected readonly heat = inject(HeatService);
  private readonly dialog = inject(MatDialog);
  readonly closePanel = output<void>();
  protected readonly version = inject(BuildInfoService).label;
  /** GitHub's mark (Octicons, MIT). */
  protected readonly githubMark = 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

  protected readonly stats = this.heat.stats;
  protected readonly view = this.store.view;

  protected readonly suggestions = computed(() => {
    const present = this.store.templatesInUse();
    return SUGGESTED.filter((id) => !present.has(id)).map((id) => this.store.catalogue.find((c) => c.id === id)!).filter(Boolean);
  });

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


  /** The size of a data cell, as the panel describes it. */
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);
  protected readonly region = computed(() => this.data.grid()?.meta.region?.name ?? '');

  protected readonly mapSummary = computed(() => {
    const v = this.view();
    const colours = v.palette === 'orange' && v.bands === 'smooth' ? '' : ` · ${this.palette().name}${v.bands === 'steps' ? ' in steps' : ''}`;
    return `${v.cells === 'homes' ? 'Where homes are' : 'All land'} · ${['no smoothing', 'light smoothing', 'strong smoothing'][v.smooth]}${colours}`;
  });

  // The heatmap's colours, each with a swatch in the current light or dark mode
  private readonly theme = inject(ThemeService);
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

  protected openCatalog(): void {
    const data: CatalogData = { inUse: [...this.store.templatesInUse()] };
    this.dialog.open(CatalogDialog, { data, width: '460px', maxWidth: '95vw', autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((result?: CatalogResult) => {
        if (!result) return;
        this.store.setCatalogue(result.catalogue);
        for (const id of result.examples) this.store.addTemplate(id);
      });
  }

  /** The jobs list loads only when someone opens it. */
  protected async openJobs(): Promise<void> {
    const { JobsDialog } = await import('../admin/jobs-dialog');
    this.dialog.open(JobsDialog, { width: '1180px', maxWidth: '96vw', autoFocus: 'dialog' });
  }

  protected openAbout(): void {
    this.dialog.open(AboutDialog, { width: '880px', maxWidth: '96vw', autoFocus: 'dialog' });
  }

  protected togglePlacing(): void {
    this.store.placing.update((v) => !v);
  }

  protected rename(id: string, event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    if (name) this.store.updatePlace(id, { name });
  }

  protected colour(index: number): string {
    return PLACE_COLOURS[index % PLACE_COLOURS.length];
  }

  protected percent = (value: number) => `${Math.round(value * 100)} %`;
  protected best = (value: number) => `Top ${value} %`;
}
