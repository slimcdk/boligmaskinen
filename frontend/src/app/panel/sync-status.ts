import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18n } from '../i18n/i18n';
import { ProfileSync } from '../state/profile-sync';

/**
 * Whether the maps are saved on the server: a cloud beside the map's name, and words when they
 * cannot be. Nothing while there is no server to save on.
 */
@Component({
  selector: 'app-sync-status',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (state(); as s) {
      <span class="status" [class.offline]="s.offline" role="img" [attr.aria-label]="s.text" [matTooltip]="s.text" matTooltipTouchGestures="off">
        <mat-icon>{{ s.icon }}</mat-icon>
        @if (s.offline) {
          <span class="words" aria-hidden="true">{{ 'sync.notSaved' | transloco }}</span>
        }
      </span>
    }
  `,
  styles: [`
    .status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .offline {
      color: var(--mat-sys-error);
    }
    mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
  `],
})
export class SyncStatus {
  private readonly sync = inject(ProfileSync);
  private readonly i18n = inject(I18n);
  protected readonly state = computed(() => {
    switch (this.sync.status()) {
      case 'saved':
        return { icon: 'cloud_done', text: this.i18n.t('sync.saved'), offline: false };
      case 'saving':
        return { icon: 'cloud_sync', text: this.i18n.t('sync.saving'), offline: false };
      case 'offline':
        return { icon: 'cloud_off', text: this.i18n.t('sync.offline'), offline: true };
      default:
        return null;
    }
  });
}
