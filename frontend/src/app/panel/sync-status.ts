import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProfileSync } from '../state/profile-sync';

/**
 * Whether the maps are saved on the server: a cloud beside the map's name, and words when they
 * cannot be. Nothing while there is no server to save on.
 */
@Component({
  selector: 'app-sync-status',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (state(); as s) {
      <span class="status" [class.offline]="s.offline" role="img" [attr.aria-label]="s.text" [matTooltip]="s.text" matTooltipTouchGestures="off">
        <mat-icon>{{ s.icon }}</mat-icon>
        @if (s.offline) {
          <span class="words" aria-hidden="true">Not saved on the server</span>
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
  protected readonly state = computed(() => {
    switch (this.sync.status()) {
      case 'saved':
        return { icon: 'cloud_done', text: 'Your maps are saved on the server', offline: false };
      case 'saving':
        return { icon: 'cloud_sync', text: 'Saving your maps on the server…', offline: false };
      case 'offline':
        return { icon: 'cloud_off', text: 'The server cannot be reached. Your changes are kept in this browser and saved when it can be.', offline: true };
      default:
        return null;
    }
  });
}
