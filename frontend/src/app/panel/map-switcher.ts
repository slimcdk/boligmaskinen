import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18n } from '../i18n/i18n';
import { Texts } from '../i18n/texts';
import { ShareService } from '../state/share.service';
import { Store } from '../state/store';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';
import { NameDialog, NameDialogData } from './name-dialog';

/**
 * The open map, and a menu to switch to another, start a new one, or duplicate, rename, share or
 * delete this one. Each map has its own blocks; the places are shared.
 */
@Component({
  selector: 'app-map-switcher',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, TranslocoPipe],
  template: `
    <button mat-button class="current" [matMenuTriggerFor]="menu" [attr.aria-label]="'maps.switcher' | transloco: { name: texts.mapName(store.map().name) }">
      <mat-icon>map</mat-icon>
      <span class="name">{{ texts.mapName(store.map().name) }}</span>
      <mat-icon iconPositionEnd>arrow_drop_down</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @for (map of store.maps(); track map.id) {
        @let open = map.id === store.map().id;
        <button mat-menu-item role="menuitemradio" [attr.aria-checked]="open" [class.picked]="open" (click)="store.openMap(map.id)">
          <mat-icon>{{ open ? 'check' : '' }}</mat-icon>
          <span>{{ texts.mapName(map.name) }}</span>
        </button>
      }
      <mat-divider />
      <button mat-menu-item (click)="newMap()"><mat-icon>add</mat-icon><span>{{ 'maps.new' | transloco }}</span></button>
      <button mat-menu-item (click)="duplicate()"><mat-icon>content_copy</mat-icon><span>{{ 'maps.duplicateThis' | transloco }}</span></button>
      <button mat-menu-item (click)="rename()"><mat-icon>edit</mat-icon><span>{{ 'maps.renameThis' | transloco }}</span></button>
      <button mat-menu-item (click)="share.shareOpenMap()"><mat-icon>share</mat-icon><span>{{ 'maps.shareThis' | transloco }}</span></button>
      <button mat-menu-item (click)="remove()" [disabled]="store.maps().length < 2"><mat-icon>delete</mat-icon><span>{{ 'maps.deleteThis' | transloco }}</span></button>
    </mat-menu>
  `,
  styles: [`
    :host { display: inline-flex; min-width: 0; }
    .current { max-width: 100%; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .picked { --mat-menu-item-label-text-color: var(--mat-sys-primary); }
  `],
})
export class MapSwitcher {
  protected readonly store = inject(Store);
  protected readonly share = inject(ShareService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);
  protected readonly texts = inject(Texts);

  private askName(data: NameDialogData, then: (name: string) => void): void {
    this.dialog.open<NameDialog, NameDialogData, string>(NameDialog, { data, width: '400px', maxWidth: '92vw', autoFocus: 'first-tabbable' })
      .afterClosed().subscribe((name) => name && then(name));
  }

  protected newMap(): void {
    const t = (key: string) => this.i18n.t(key);
    this.askName({ title: t('maps.new'), label: t('maps.name'), value: this.store.freeMapName(t('maps.base')), action: t('maps.create') }, (name) => this.store.newMap(name));
  }

  protected duplicate(): void {
    const t = (key: string) => this.i18n.t(key);
    const value = this.store.freeMapName(this.i18n.t('maps.copy', { name: this.texts.mapName(this.store.map().name) }));
    this.askName({ title: t('maps.duplicateTitle'), label: t('maps.name'), value, action: t('maps.duplicate') }, (name) => this.store.duplicateMap(name));
  }

  protected rename(): void {
    const map = this.store.map();
    const t = (key: string) => this.i18n.t(key);
    this.askName({ title: t('maps.renameTitle'), label: t('maps.name'), value: this.texts.mapName(map.name), action: t('maps.rename') }, (name) => this.store.renameMap(map.id, name));
  }

  protected remove(): void {
    const map = this.store.map();
    const data: ConfirmDialogData = {
      title: this.i18n.t('maps.deleteTitle', { name: this.texts.mapName(map.name) }),
      text: this.i18n.t('maps.deleteText'),
      action: this.i18n.t('maps.delete'),
    };
    this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data, width: '400px', maxWidth: '92vw' })
      .afterClosed().subscribe((yes) => yes && this.store.deleteMap(map.id));
  }
}
