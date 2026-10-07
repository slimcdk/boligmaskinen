import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule, MatSelectionList } from '@angular/material/list';
import { BlockTemplate, EXAMPLES, LIBRARY } from '../scoring/library';
import { CRITERION_GROUPS } from '../scoring/types';

export interface CatalogData {
  /** Predefined blocks already in use. */
  inUse: string[];
}

export interface CatalogResult {
  /** The catalogue blocks to keep or add. */
  catalogue: string[];
  /** Examples to add as new blocks. */
  examples: string[];
}

/** Pick the blocks of the weighting: predefined ones from the catalogue, or examples to start code from. */
@Component({
  selector: 'app-catalog-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatListModule],
  template: `
    <h2 mat-dialog-title>What matters to you?</h2>
    <mat-dialog-content>
      <p class="intro">Every choice becomes a block. Blocks are code: their sliders are in the side panel, and you can read and change the code.</p>
      <mat-selection-list #list multiple aria-label="Blocks">
        @for (group of groups; track group) {
          <div mat-subheader>{{ group }}</div>
          @for (t of inGroup(group); track t.id) {
            <mat-list-option [value]="t.id" [selected]="data.inUse.includes(t.id)" togglePosition="before">
              <span matListItemTitle>{{ t.name }}</span>
              <span matListItemLine>{{ t.description }}</span>
            </mat-list-option>
          }
        }
        <div mat-subheader>Examples of code</div>
        @for (t of examples; track t.id) {
          <mat-list-option [value]="'example:' + t.id" togglePosition="before">
            <span matListItemTitle>{{ t.name }}</span>
            <span matListItemLine>{{ t.description }}</span>
          </mat-list-option>
        }
      </mat-selection-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="done(list)">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`.intro { margin: 0 0 4px; color: var(--mat-sys-on-surface-variant); }`],
})
export class CatalogDialog {
  protected readonly data = inject<CatalogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CatalogDialog, CatalogResult>);
  protected readonly groups = CRITERION_GROUPS;
  protected readonly examples = EXAMPLES;

  protected inGroup(group: string): BlockTemplate[] {
    return LIBRARY.filter((t) => t.group === group);
  }

  protected done(list: MatSelectionList): void {
    const values = list.selectedOptions.selected.map((option) => option.value as string);
    this.ref.close({
      catalogue: values.filter((v) => !v.startsWith('example:')),
      examples: values.filter((v) => v.startsWith('example:')).map((v) => v.slice(8)),
    });
  }
}
