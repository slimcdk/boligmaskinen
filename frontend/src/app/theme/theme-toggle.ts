import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18n } from '../i18n/i18n';
import { ThemeChoice, ThemeService } from './theme.service';

/** The choices, with their names' keys in the catalogues. */
export const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'system', label: 'theme.system', icon: 'contrast' },
  { value: 'light', label: 'theme.light', icon: 'light_mode' },
  { value: 'dark', label: 'theme.dark', icon: 'dark_mode' },
];

/** Footer button that picks light or dark mode, or follows the system. */
@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, TranslocoPipe],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" [matTooltip]="title()" [attr.aria-label]="title()">
      <mat-icon>{{ current().icon }}</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before" yPosition="above">
      @for (option of options; track option.value) {
        @let picked = option.value === theme.choice();
        <button mat-menu-item role="menuitemradio" [attr.aria-checked]="picked" [class.picked]="picked" (click)="theme.set(option.value)">
          <mat-icon>{{ option.icon }}</mat-icon>
          <span class="label">{{ option.label | transloco }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .picked {
      background: var(--mat-sys-secondary-container);
      --mat-menu-item-label-text-color: var(--mat-sys-on-secondary-container);
      --mat-menu-item-icon-color: var(--mat-sys-on-secondary-container);
    }
  `],
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18n);
  protected readonly options = THEME_OPTIONS;
  protected readonly current = computed(() => THEME_OPTIONS.find((o) => o.value === this.theme.choice())!);
  protected readonly title = computed(() => this.i18n.t('theme.title', { name: this.i18n.t(this.current().label) }));
}
