import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18n, LANGUAGES } from './i18n';

/** Footer button that picks the language of the app. */
@Component({
  selector: 'app-language-menu',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" [matTooltip]="title()" [attr.aria-label]="title()">
      <mat-icon>translate</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before" yPosition="above">
      @for (language of languages; track language.id) {
        @let picked = language.id === i18n.language();
        <!-- Each language is named in itself, so it can be found from the other -->
        <button mat-menu-item role="menuitemradio" [attr.aria-checked]="picked" [class.picked]="picked" [attr.lang]="language.id" (click)="i18n.use(language.id)">
          <span class="label">{{ language.name }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .picked {
      background: var(--mat-sys-secondary-container);
      --mat-menu-item-label-text-color: var(--mat-sys-on-secondary-container);
    }
  `],
})
export class LanguageMenu {
  protected readonly i18n = inject(I18n);
  protected readonly languages = LANGUAGES;
  protected readonly title = computed(() => this.i18n.t('footer.language', { name: LANGUAGES.find((l) => l.id === this.i18n.language())!.name }));
}
