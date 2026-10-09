import { Component, DestroyRef, computed, effect, inject, model, output, signal, untracked } from '@angular/core';

/** How far up the sheet is: just its head, half the screen, or nearly all of it. */
export type SheetState = 'peek' | 'half' | 'full';

/** The height of the sheet when it is down: its handle, the open map's name, and "What matters to you" with Add. */
export const PEEK_HEIGHT = 152;
/** The map left above the sheet when it is all the way up. */
const TOP_GAP = 56;
/** A pointer that moves less than this has tapped the handle rather than dragged it. */
const TAP_SLOP = 6;
/** A flick faster than this (px per ms) goes on to the next height. */
const FLICK = 0.5;

/**
 * An M3 standard bottom sheet for phones: it lies over the bottom of the map, which stays usable above
 * it. Drag its handle to any height, and it settles at the nearest of three; tap the handle, or use
 * Enter or Space on it, to raise it to half the screen or lower it to its head.
 */
@Component({
  selector: 'app-bottom-sheet',
  template: `
    <div class="handle" role="button" tabindex="0" [attr.aria-expanded]="state() !== 'peek'"
         [attr.aria-label]="state() === 'peek' ? 'Show the panel' : 'Show less of the panel'"
         (pointerdown)="dragStart($event)" (pointermove)="dragMove($event)" (pointerup)="dragEnd($event)" (pointercancel)="dragEnd($event)"
         (keydown.enter)="toggle(); $event.preventDefault()" (keydown.space)="toggle(); $event.preventDefault()">
      <span class="bar" aria-hidden="true"></span>
    </div>
    <div class="content">
      <ng-content />
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      max-width: 640px;
      margin: 0 auto;
      overflow: hidden;
      background: var(--mat-sys-surface-container-low);
      border-radius: var(--mat-sys-corner-extra-large) var(--mat-sys-corner-extra-large) 0 0;
      box-shadow: var(--mat-sys-level2);
      transition: height 250ms cubic-bezier(0.2, 0, 0, 1);
    }
    :host(.dragging) { transition: none; }
    @media (prefers-reduced-motion: reduce) { :host { transition: none; } }
    /* M3's drag handle: a 32 x 4 bar, in a target big enough for a finger */
    .handle {
      flex: none;
      display: grid;
      place-items: center;
      height: 40px;
      cursor: grab;
      touch-action: none;
      outline: none;
    }
    .handle:focus-visible .bar { outline: 2px solid var(--mat-sys-primary); outline-offset: 4px; }
    .bar {
      width: 32px;
      height: 4px;
      border-radius: 2px;
      background: var(--mat-sys-on-surface-variant);
      opacity: 0.4;
    }
    .content {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  `],
  host: {
    '[style.height.px]': 'height()',
    '[class.dragging]': 'dragging()',
  },
})
export class BottomSheet {
  readonly state = model<SheetState>('peek');
  /** The height the sheet settles at, for the map to keep its view above it. */
  readonly settledHeight = output<number>();

  private readonly viewport = signal(window.innerHeight);
  private readonly dragHeight = signal<number | null>(null);
  protected readonly dragging = computed(() => this.dragHeight() !== null);
  private readonly heights = computed<Record<SheetState, number>>(() => {
    const full = Math.max(PEEK_HEIGHT, this.viewport() - TOP_GAP);
    return { peek: PEEK_HEIGHT, half: Math.min(full, Math.max(PEEK_HEIGHT, Math.round(this.viewport() / 2))), full };
  });
  protected readonly height = computed(() => this.dragHeight() ?? this.heights()[this.state()]);

  private drag: { pointer: number; startY: number; startHeight: number; lastY: number; lastTime: number; speed: number; moved: boolean } | null = null;

  constructor() {
    const onResize = () => this.viewport.set(window.innerHeight);
    window.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', onResize));
    effect(() => {
      const settled = this.heights()[this.state()];
      untracked(() => this.settledHeight.emit(settled));
    });
  }

  /** Up to half the screen from the head, and back down from higher up. */
  toggle(): void {
    this.state.set(this.state() === 'peek' ? 'half' : 'peek');
  }

  protected dragStart(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { pointer: event.pointerId, startY: event.clientY, startHeight: this.height(), lastY: event.clientY, lastTime: event.timeStamp, speed: 0, moved: false };
  }

  protected dragMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.abs(event.clientY - drag.startY) < TAP_SLOP) return;
    drag.moved = true;
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    drag.speed = (drag.lastY - event.clientY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    const { peek, full } = this.heights();
    this.dragHeight.set(Math.min(full, Math.max(peek, drag.startHeight + drag.startY - event.clientY)));
  }

  protected dragEnd(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    this.drag = null;
    if (!drag.moved) {
      this.dragHeight.set(null);
      if (event.type === 'pointerup') this.toggle();
      return;
    }
    this.state.set(this.settle(this.dragHeight() ?? this.height(), drag.speed));
    this.dragHeight.set(null);
  }

  /** Where a drag that ends at this height, at this speed (up is positive), settles. */
  private settle(height: number, speed: number): SheetState {
    const order: SheetState[] = ['peek', 'half', 'full'];
    const heights = this.heights();
    if (Math.abs(speed) > FLICK) {
      // A flick goes on to the next height in its direction
      const above = order.find((s) => heights[s] > height + 1);
      const below = [...order].reverse().find((s) => heights[s] < height - 1);
      return (speed > 0 ? above : below) ?? (speed > 0 ? 'full' : 'peek');
    }
    return order.reduce((best, s) => (Math.abs(heights[s] - height) < Math.abs(heights[best] - height) ? s : best), order[0]);
  }
}
