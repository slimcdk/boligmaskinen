import { Component, computed, inject, input } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '../state/store';
import { capitalise, formatWithUnit, FormulaParam } from '@boligmaskinen/engine';
import { Texts } from '../i18n/texts';

const ICONS: Record<string, string> = { car: 'directions_car', bike: 'directions_bike', walk: 'directions_walk', train: 'directions_transit' };

/** One value a block's code exposes, as a slider, a checkbox or a choice. Changing it rewrites the code. */
@Component({
  selector: 'app-param-control',
  imports: [MatButtonToggleModule, MatCheckboxModule, MatIconModule, MatSliderModule, MatTooltipModule],
  template: `
    @let p = param();
    @switch (p.kind) {
      @case ('number') {
        <div class="label"><span>{{ label() }}</span><strong>{{ format(p.value) }}</strong></div>
        @if (squared()) {
          <mat-slider discrete min="0" [max]="STEPS" step="1" [displayWith]="formatPosition">
            <input matSliderThumb [value]="position(p.value)" (input)="onPosition($event)" [attr.aria-label]="label()">
          </mat-slider>
        } @else {
          <mat-slider discrete [min]="p.min" [max]="p.max" [step]="p.step" [displayWith]="format">
            <input matSliderThumb [value]="p.value" (input)="onSlider($event)" [attr.aria-label]="label()">
          </mat-slider>
        }
      }
      @case ('flag') {
        <mat-checkbox [checked]="p.value === 1" (change)="set($event.checked ? 1 : 0)">{{ label() }}</mat-checkbox>
      }
      @case ('choice') {
        <div class="label choice">
          <span>{{ label() }}</span>
          <mat-button-toggle-group class="toggles" hideSingleSelectionIndicator [value]="p.value" (change)="set($event.value)" [attr.aria-label]="label()">
            @for (option of p.options; track $index) {
              <mat-button-toggle [value]="$index + 1" [matTooltip]="title(option)" [aria-label]="title(option)">
                @if (icon(option); as name) {
                  <mat-icon>{{ name }}</mat-icon>
                } @else {
                  {{ title(option) }}
                }
              </mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; }
    /* The label and its value on one line, the value in the type the weight has */
    .label { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .label strong { color: var(--mat-sys-on-surface); font: var(--mat-sys-label-large); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .choice { align-items: center; min-height: 40px; }
    .toggles mat-icon { width: 18px; height: 18px; font-size: 18px; }
    /* The slider right under its label, its track as wide as the label's line */
    mat-slider { display: block; width: 100%; margin: -8px 0 -4px; }
  `],
})
export class ParamControl {
  private readonly store = inject(Store);
  private readonly texts = inject(Texts);
  readonly param = input.required<FormulaParam>();
  /** The block the value belongs to. */
  readonly block = input.required<string>();

  /** Its label from the code; a predefined block's in the language in use. */
  protected readonly label = computed(() => this.texts.word(this.param().label));
  protected readonly format = (value: number) => formatWithUnit(value, this.param().unit, this.texts.wording());

  /** Distances from 0 move on a square-root scale, so the short distances get most of the slider. */
  protected readonly squared = computed(() => this.param().unit === 'm' && this.param().min === 0 && this.param().max > 0);
  protected readonly STEPS = 1000;

  protected position(value: number): number {
    return Math.round(Math.sqrt(Math.max(0, value) / this.param().max) * this.STEPS);
  }

  private valueAt(position: number): number {
    const { max, step } = this.param();
    return Math.min(max, Math.round((max * (position / this.STEPS) ** 2) / step) * step);
  }

  protected readonly formatPosition = (position: number) => this.format(this.valueAt(position));

  protected onPosition(event: Event): void {
    this.set(this.valueAt(Number((event.target as HTMLInputElement).value)));
  }

  protected icon(option: string): string | null {
    return ICONS[option] ?? null;
  }

  protected title(option: string): string {
    return capitalise(this.texts.word(option).replace(/_/g, ' '));
  }

  protected onSlider(event: Event): void {
    this.set(Number((event.target as HTMLInputElement).value));
  }

  protected set(value: number): void {
    this.store.setParam(this.block(), this.param().name, value);
  }
}
