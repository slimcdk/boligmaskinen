import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ShareDialogData {
  name: string;
  link: string;
  /** The places that go with the map, which the link shows to whoever opens it. */
  places: string[];
}

/**
 * The link to a map, to copy. The browser's clipboard only works over HTTPS, so where it does not
 * (an instance on a LAN), the link is selected for copying by hand.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Share “{{ data.name }}”</h2>
    <mat-dialog-content>
      <p>Whoever opens the link gets a copy of this map: its blocks and how the map shows them{{ data.places.length ? '' : '.' }}
        @if (data.places.length) {
          and {{ data.places.length === 1 ? 'the place' : 'the places' }} its blocks use: {{ data.places.join(', ') }}.
        }
        Your other maps and places stay with you.</p>
      <mat-form-field class="full" subscriptSizing="dynamic">
        <mat-label>Link</mat-label>
        <input #field matInput readonly [value]="data.link" (focus)="field.select()" aria-label="Link to the map">
      </mat-form-field>
      <p class="status" role="status">{{ status() }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-flat-button (click)="copy(field)">Copy link</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full { width: 100%; }
    p { margin: 0 0 16px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .status { margin: 8px 0 0; min-height: 20px; }
  `],
})
export class ShareDialog {
  protected readonly data = inject<ShareDialogData>(MAT_DIALOG_DATA);
  protected readonly status = signal('');

  protected async copy(field: HTMLInputElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.link);
      this.status.set('The link is copied.');
    } catch {
      field.focus();
      field.select();
      this.status.set('The link is selected: copy it with Ctrl+C or ⌘C.');
    }
  }
}
