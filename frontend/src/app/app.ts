import { Component, ElementRef, HostListener, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PilotData } from './data/pilot-data';
import { MapView } from './map/map-view';
import { Panel } from './panel/panel';
import { BottomSheet, PEEK_HEIGHT, SheetState } from './sheet/bottom-sheet';
import { Store } from './state/store';

/** The floating panel's width, and its distance from the window's edges, on a larger screen. */
const PANEL_WIDTH = 380;
const PANEL_GAP = 12;
const PHONE = '(max-width: 700px)';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, BottomSheet, MapView, Panel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly data = inject(PilotData);
  protected readonly store = inject(Store);
  private readonly injector = inject(Injector);
  private readonly floating = viewChild<ElementRef<HTMLElement>>('floating');
  private readonly openButton = viewChild('openButton', { read: ElementRef<HTMLElement> });

  protected readonly mobile = toSignal(inject(BreakpointObserver).observe(PHONE).pipe(map((state) => state.matches)), {
    initialValue: window.matchMedia(PHONE).matches,
  });
  /** Whether the floating panel is open, on a larger screen. */
  protected readonly panelOpen = signal(true);
  /** How far up the bottom sheet is, on a phone. It starts down, so the map shows. */
  protected readonly sheet = signal<SheetState>('peek');
  protected readonly sheetHeight = signal(PEEK_HEIGHT);

  /**
   * What the panel covers of the map, which keeps its view in the rest: the floating panel's width,
   * or the sheet's height (at most half the screen, so a raised sheet does not push the view away).
   */
  protected readonly mapInset = computed(() => this.mobile()
    ? { left: 0, bottom: Math.min(this.sheetHeight(), Math.round(window.innerHeight / 2)) }
    : { left: this.panelOpen() ? PANEL_WIDTH + 2 * PANEL_GAP : 0, bottom: 0 });

  constructor() {
    void this.data.load();
    // On a phone the sheet goes down while a place is dropped, and comes back up after
    let before: SheetState | null = null;
    effect(() => {
      const placing = this.store.placing();
      untracked(() => {
        if (placing && this.mobile() && this.sheet() !== 'peek') {
          before = this.sheet();
          this.sheet.set('peek');
        } else if (!placing && before) {
          this.sheet.set(before);
          before = null;
        }
      });
    });
  }

  protected openPanel(): void {
    this.panelOpen.set(true);
    afterNextRender(() => this.floating()?.nativeElement.focus(), { injector: this.injector });
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
    afterNextRender(() => this.openButton()?.nativeElement.focus(), { injector: this.injector });
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    if (this.store.placing()) {
      this.store.placing.set(false);
      return;
    }
    // Escape inside the floating panel closes it, as it did as a side panel; menus and dialogs close first
    const floating = this.floating()?.nativeElement;
    if (!this.mobile() && this.panelOpen() && floating?.contains(document.activeElement)) this.closePanel();
  }
}
