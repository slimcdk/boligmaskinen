import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '../state/store';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';
import { NameDialog, NameDialogData } from './name-dialog';

/**
 * The open map, and a menu to switch to another, start a new one, or duplicate, rename or delete
 * this one. Each map has its own blocks; the places are shared.
 */
@Component({
  selector: 'app-map-switcher',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule],
  template: `
    <button mat-button class="current" [matMenuTriggerFor]="menu" [attr.aria-label]="'Map: ' + store.map().name + '. Switch, add or change maps'">
      <mat-icon>map</mat-icon>
      <span class="name">{{ store.map().name }}</span>
      <mat-icon iconPositionEnd>arrow_drop_down</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @for (map of store.maps(); track map.id) {
        @let open = map.id === store.map().id;
        <button mat-menu-item role="menuitemradio" [attr.aria-checked]="open" [class.picked]="open" (click)="store.openMap(map.id)">
          <mat-icon>{{ open ? 'check' : '' }}</mat-icon>
          <span>{{ map.name }}</span>
        </button>
      }
      <mat-divider />
      <button mat-menu-item (click)="newMap()"><mat-icon>add</mat-icon><span>New map</span></button>
      <button mat-menu-item (click)="duplicate()"><mat-icon>content_copy</mat-icon><span>Duplicate this map</span></button>
      <button mat-menu-item (click)="rename()"><mat-icon>edit</mat-icon><span>Rename this map</span></button>
      <button mat-menu-item (click)="remove()" [disabled]="store.maps().length < 2"><mat-icon>delete</mat-icon><span>Delete this map</span></button>
    </mat-menu>
  `,
  styles: [`
    .current { max-width: 100%; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .picked { --mat-menu-item-label-text-color: var(--mat-sys-primary); }
  `],
})
export class MapSwitcher {
  protected readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  private askName(data: NameDialogData, then: (name: string) => void): void {
    this.dialog.open<NameDialog, NameDialogData, string>(NameDialog, { data, width: '400px', maxWidth: '92vw', autoFocus: 'first-tabbable' })
      .afterClosed().subscribe((name) => name && then(name));
  }

  protected newMap(): void {
    this.askName({ title: 'New map', label: 'Name of the map', value: this.store.freeMapName('Map'), action: 'Create' }, (name) => this.store.newMap(name));
  }

  protected duplicate(): void {
    const value = this.store.freeMapName(`${this.store.map().name} (copy)`);
    this.askName({ title: 'Duplicate the map', label: 'Name of the map', value, action: 'Duplicate' }, (name) => this.store.duplicateMap(name));
  }

  protected rename(): void {
    const map = this.store.map();
    this.askName({ title: 'Rename the map', label: 'Name of the map', value: map.name, action: 'Rename' }, (name) => this.store.renameMap(map.id, name));
  }

  protected remove(): void {
    const map = this.store.map();
    const data: ConfirmDialogData = {
      title: `Delete "${map.name}"?`,
      text: 'Its blocks are deleted with it. Your places and the other maps stay.',
      action: 'Delete',
    };
    this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data, width: '400px', maxWidth: '92vw' })
      .afterClosed().subscribe((yes) => yes && this.store.deleteMap(map.id));
  }
}
