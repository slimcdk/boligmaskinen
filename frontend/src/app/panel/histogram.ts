import { Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { rampOf, Rgb } from '../map/colours';
import { Store } from '../state/store';
import { ThemeService } from '../theme/theme.service';

/**
 * A theme colour the canvas can use. The theme's tokens hold light-dark() pairs, which only CSS
 * resolves, so the token is set on the element and read back as its computed colour.
 */
function themeColour(element: HTMLElement, token: string, fallback: string): string {
  element.style.color = `var(${token}, ${fallback})`;
  const colour = getComputedStyle(element).color;
  element.style.removeProperty('color');
  return colour || fallback;
}

/** Distribution of points across the cells considered, coloured like the map. */
@Component({
  selector: 'app-histogram',
  template: '<canvas #canvas role="img" [attr.aria-label]="description() || \'Distribution of points across the cells considered\'"></canvas>',
  styles: [':host { display: block; } canvas { width: 100%; height: 44px; display: block; }'],
})
export class Histogram {
  readonly histogram = input.required<Uint32Array>();
  readonly limit = input(0);
  readonly showLimit = input(false);
  readonly lo = input(0);
  readonly hi = input(100);
  /** The result in words, for screen readers. */
  readonly description = input('');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemeService);
  private readonly store = inject(Store);

  constructor() {
    effect(() => {
      const view = this.store.view();
      this.draw(this.histogram(), this.limit(), this.showLimit(), this.lo(), this.hi(), rampOf(view.palette, this.theme.scheme(), view.bands));
    });
  }

  private draw(histogram: Uint32Array, limit: number, showLimit: boolean, lo: number, hi: number, ramp: Rgb[]): void {
    const canvas = this.canvas().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 300;
    const height = 44;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    let max = 1;
    for (const v of histogram) max = Math.max(max, v);
    const barWidth = width / 101;
    const muted = themeColour(canvas, '--mat-sys-outline-variant', '#ccc');
    for (let score = 0; score <= 100; score++) {
      const barHeight = (histogram[score] / max) * (height - 12);
      const t = Math.max(0, Math.min(1, (score - lo) / Math.max(1, hi - lo)));
      const [r, gr, b] = ramp[Math.round(t * 100)];
      g.fillStyle = score >= limit ? `rgb(${r},${gr},${b})` : muted;
      g.fillRect(score * barWidth, height - 10 - barHeight, Math.max(1, barWidth - 0.5), barHeight);
    }
    if (showLimit) {
      g.fillStyle = themeColour(canvas, '--mat-sys-on-surface', '#000');
      g.fillRect(limit * barWidth, 0, 1.5, height - 8);
    }
    g.fillStyle = themeColour(canvas, '--mat-sys-on-surface-variant', '#666');
    g.font = '10px Roboto, system-ui, sans-serif';
    g.fillText('0', 0, height - 0.5);
    g.fillText('100 points', width - 50, height - 0.5);
  }
}
