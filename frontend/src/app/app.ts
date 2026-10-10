import { Component, DestroyRef, ElementRef, HostListener, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PilotData } from './data/pilot-data';
import { MapView } from './map/map-view';
import { MapPanel } from './panel/map-panel';
import { Panel } from './panel/panel';
import { BottomSheet, PEEK_HEIGHT, SheetState } from './sheet/bottom-sheet';
import { ShareService } from './state/share.service';
import { Store } from './state/store';

/** The floating panels' width, and their distance from the window's edges, on a larger screen. */
const PANEL_WIDTH = 380;
const PANEL_GAP = 12;
const PHONE = '(max-width: 700px)';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, BottomSheet, MapPanel, MapView, Panel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly data = inject(PilotData);
  protected readonly store = inject(Store);
  private readonly injector = inject(Injector);
  private readonly floating = viewChild<ElementRef<HTMLElement>>('floating');
  private readonly openButton = viewChild('openButton', { read: ElementRef<HTMLElement> });
  private readonly mapCard = viewChild<ElementRef<HTMLElement>>('mapCard');

  protected readonly mobile = toSignal(inject(BreakpointObserver).observe(PHONE).pipe(map((state) => state.matches)), {
    initialValue: window.matchMedia(PHONE).matches,
  });
  /** Whether the floating panels are open, on a larger screen. */
  protected readonly panelOpen = signal(true);
  /** How far up the bottom sheet is, on a phone. It starts down, so the map shows. */
  protected readonly sheet = signal<SheetState>('peek');
  protected readonly sheetHeight = signal(PEEK_HEIGHT);
  /** The height of the map panel's card at the top, on a phone. */
  private readonly mapCardHeight = signal(0);

  /**
   * What the panels cover of the map, which keeps its view in the rest: the floating panels' width, or
   * on a phone the card at the top and the sheet (at most half the screen, so a raised sheet does not
   * push the view away).
   */
  protected readonly mapInset = computed(() => this.mobile()
    ? { top: this.mapCardHeight() ? this.mapCardHeight() + 8 : 0, left: 0, bottom: Math.min(this.sheetHeight(), Math.round(window.innerHeight / 2)) }
    : { top: 0, left: this.panelOpen() ? PANEL_WIDTH + 2 * PANEL_GAP : 0, bottom: 0 });

  constructor() {
    void this.data.load();
    // A link to a shared map offers to add it
    void inject(ShareService).openLink();
    // The card at the top changes height as its settings fold out
    const observer = new ResizeObserver(([entry]) => this.mapCardHeight.set(Math.round(entry.target.getBoundingClientRect().height)));
    effect(() => {
      const card = this.mapCard()?.nativeElement;
      observer.disconnect();
      if (card) observer.observe(card);
      else this.mapCardHeight.set(0);
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
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

  @HostListener('document:keydown.escape', ['$event'])
  protected escape(event: Event): void {
    if (this.store.placing()) {
      this.store.placing.set(false);
      return;
    }
    // Escape inside the floating panels closes them, as it did the side panel. A menu or dialog
    // closes on its own Escape, which leaves the panels open, though the focus is back in them by now
    const floating = this.floating()?.nativeElement;
    if (!this.mobile() && this.panelOpen() && !event.defaultPrevented && floating?.contains(event.target as Node)) this.closePanel();
  }
}
