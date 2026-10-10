import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule, MatSelectionList } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { BlockTemplate, CRITERION_GROUPS, EXAMPLES, LIBRARY, Place } from '@boligmaskinen/engine';
import { Texts } from '../i18n/texts';

export interface CatalogData {
  /** Predefined blocks already in use on the open map, by template id (`place:…` for places). */
  inUse: string[];
  /** The user's places, which every map shares; each can have a block on this map. */
  places: Place[];
}

export interface CatalogResult {
  /** The catalogue blocks to keep or add. */
  catalogue: string[];
  /** Examples to add as new blocks. */
  examples: string[];
  /** The places to keep or give a block on this map, by id. */
  places: string[];
}

/** Pick the blocks of the weighting: predefined ones from the catalogue, or examples to start code from. */
@Component({
  selector: 'app-catalog-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatListModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ 'catalog.title' | transloco }}</h2>
    <mat-dialog-content>
      <p class="intro">{{ 'catalog.intro' | transloco }}</p>
      <mat-selection-list #list multiple [attr.aria-label]="'catalog.blocks' | transloco">
        @for (group of groups; track group) {
          <div mat-subheader>{{ texts.groupName(group) }}</div>
          @for (t of inGroup(group); track t.id) {
            <mat-list-option [value]="t.id" [selected]="data.inUse.includes(t.id)" togglePosition="before">
              <span matListItemTitle>{{ texts.templateName(t) }}</span>
              <span matListItemLine>{{ texts.templateDescription(t) }}</span>
            </mat-list-option>
          }
        }
        @if (data.places.length) {
          <div mat-subheader>{{ 'panel.yourPlaces' | transloco }}</div>
          @for (p of data.places; track p.id) {
            <mat-list-option [value]="'place:' + p.id" [selected]="data.inUse.includes('place:' + p.id)" togglePosition="before">
              <span matListItemTitle>{{ p.name }}</span>
              <span matListItemLine>{{ 'catalog.travelTo' | transloco: { name: p.name } }}</span>
            </mat-list-option>
          }
        }
        <div mat-subheader>{{ 'catalog.examples' | transloco }}</div>
        @for (t of examples; track t.id) {
          <mat-list-option [value]="'example:' + t.id" togglePosition="before">
            <span matListItemTitle>{{ texts.templateName(t) }}</span>
            <span matListItemLine>{{ texts.templateDescription(t) }}</span>
          </mat-list-option>
        }
      </mat-selection-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
      <button mat-flat-button (click)="done(list)">{{ 'common.done' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: [`.intro { margin: 0 0 4px; color: var(--mat-sys-on-surface-variant); }`],
})
export class CatalogDialog {
  protected readonly data = inject<CatalogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CatalogDialog, CatalogResult>);
  protected readonly texts = inject(Texts);
  protected readonly groups = CRITERION_GROUPS;
  protected readonly examples = EXAMPLES;

  protected inGroup(group: string): BlockTemplate[] {
    return LIBRARY.filter((t) => t.group === group);
  }

  protected done(list: MatSelectionList): void {
    const values = list.selectedOptions.selected.map((option) => option.value as string);
    const prefixed = (prefix: string) => values.filter((v) => v.startsWith(prefix)).map((v) => v.slice(prefix.length));
    this.ref.close({
      catalogue: values.filter((v) => !v.includes(':')),
      examples: prefixed('example:'),
      places: prefixed('place:'),
    });
  }
}
