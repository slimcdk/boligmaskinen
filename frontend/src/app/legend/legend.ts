import { Component, computed, inject } from '@angular/core';
import { rampGradient } from '../map/colours';
import { HeatService } from '../map/heat.service';
import { Store } from '../state/store';
import { ThemeService } from '../theme/theme.service';

/** Colour ramp with the point range currently shown. */
@Component({
  selector: 'app-legend',
  template: `
    @if (stats()?.hasPreferences) {
      <div class="legend" aria-label="Legend">
        <div class="title">Points</div>
        <div class="ramp" aria-hidden="true" [style.background]="gradient()"></div>
        <div class="ticks"><span>{{ lo() }}</span><span>{{ mid() }}</span><span>{{ hi() }}</span></div>
        <div class="caption">{{ caption() }}</div>
      </div>
    }
  `,
  styles: [`
    .legend {
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      border-radius: 12px;
      box-shadow: var(--mat-sys-level2);
      padding: 8px 12px;
      width: 230px;
      font: var(--mat-sys-body-small);
    }
    .title { font: var(--mat-sys-label-large); }
    .ramp { height: 10px; border-radius: 5px; margin: 6px 0 3px; }
    .ticks { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; color: var(--mat-sys-on-surface-variant); }
    .caption { color: var(--mat-sys-on-surface-variant); margin-top: 2px; }
  `],
})
export class Legend {
  private readonly heat = inject(HeatService);
  private readonly store = inject(Store);
  protected readonly stats = this.heat.stats;
  private readonly theme = inject(ThemeService);
  protected readonly gradient = computed(() => rampGradient(this.store.view().palette, this.theme.scheme(), this.store.view().bands));
  protected readonly lo = computed(() => Math.round(this.stats()?.lo ?? 0));
  protected readonly hi = computed(() => Math.round(this.stats()?.hi ?? 100));
  protected readonly mid = computed(() => Math.round(((this.stats()?.lo ?? 0) + (this.stats()?.hi ?? 100)) / 2));
  protected readonly caption = computed(() => {
    const smooth = ['', ' · smoothed', ' · strongly smoothed'][this.store.view().smooth];
    return `Colour stretched over the cells shown${smooth}`;
  });
}
