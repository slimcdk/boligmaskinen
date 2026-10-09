import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BuildInfoService } from '../data/build-info';
import { PilotData } from '../data/pilot-data';
import { Store } from '../state/store';
import { PLACE_COLOURS, SUGGESTED } from '@boligmaskinen/engine';
import { AboutDialog } from './about-dialog';
import { CatalogData, CatalogDialog, CatalogResult } from './catalog-dialog';
import { ThemeToggle } from '../theme/theme-toggle';
import { GroupSection } from './group-section';
import { MapSwitcher } from './map-switcher';
import { SyncStatus } from './sync-status';

/**
 * The weighting panel, the lower of the two that float over the map (and the bottom sheet on a
 * phone): the open map, its blocks in groups, the places, and the footer.
 */
@Component({
  selector: 'app-panel',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, MatTooltipModule, GroupSection, MapSwitcher, SyncStatus, ThemeToggle],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  protected readonly store = inject(Store);
  private readonly data = inject(PilotData);
  private readonly dialog = inject(MatDialog);
  protected readonly version = inject(BuildInfoService).label;
  /** GitHub's mark (Octicons, MIT). */
  protected readonly githubMark = 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

  /** The open map's groups, each with its blocks. */
  protected readonly grouped = computed(() => {
    const blocks = this.store.blocks();
    return this.store.groups().map((group) => ({ group, blocks: blocks.filter((b) => b.group === group.id) }));
  });

  /** The open map has no preference yet, so the panel asks what matters and suggests some. */
  protected readonly noPreferences = computed(() => !this.store.blocks().some((b) => b.role === 'want'));

  protected readonly suggestions = computed(() => {
    const present = this.store.templatesInUse();
    return SUGGESTED.filter((id) => !present.has(id)).map((id) => this.store.catalogue.find((c) => c.id === id)!).filter(Boolean);
  });

  /** The size of a data cell, as the panel describes it. */
  protected readonly cell = computed(() => this.data.grid()?.meta.cellMetres ?? 100);

  protected openCatalog(): void {
    const data: CatalogData = { inUse: [...this.store.templatesInUse()], places: this.store.places() };
    this.dialog.open(CatalogDialog, { data, width: '460px', maxWidth: '95vw', autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((result?: CatalogResult) => {
        if (!result) return;
        this.store.setCatalogue(result.catalogue);
        this.store.setPlaceBlocks(result.places);
        for (const id of result.examples) this.store.addTemplate(id);
      });
  }

  /** The jobs list loads only when someone opens it. */
  protected async openJobs(): Promise<void> {
    const { JobsDialog } = await import('../admin/jobs-dialog');
    // A steady height, so switching between the tasks and the runs does not move the dialog
    this.dialog.open(JobsDialog, { width: '1180px', maxWidth: '96vw', height: 'min(880px, 92vh)', autoFocus: 'dialog' });
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
}
