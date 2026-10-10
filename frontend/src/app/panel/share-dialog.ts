import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18n } from '../i18n/i18n';

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
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ 'share.title' | transloco: { name: data.name } }}</h2>
    <mat-dialog-content>
      <p>{{ text | transloco: { places: data.places.join(', ') } }} {{ 'share.othersStay' | transloco }}</p>
      <mat-form-field class="full" subscriptSizing="dynamic">
        <mat-label>{{ 'share.link' | transloco }}</mat-label>
        <input #field matInput readonly [value]="data.link" (focus)="field.select()" [attr.aria-label]="'share.linkLabel' | transloco">
      </mat-form-field>
      <p class="status" role="status">{{ status() }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.close' | transloco }}</button>
      <button mat-flat-button (click)="copy(field)">{{ 'share.copy' | transloco }}</button>
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
  private readonly i18n = inject(I18n);
  protected readonly status = signal('');
  protected readonly text = ['share.text', 'share.textPlace'][this.data.places.length] ?? 'share.textPlaces';

  protected async copy(field: HTMLInputElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.link);
      this.status.set(this.i18n.t('share.copied'));
    } catch {
      field.focus();
      field.select();
      this.status.set(this.i18n.t('share.selected'));
    }
  }
}
