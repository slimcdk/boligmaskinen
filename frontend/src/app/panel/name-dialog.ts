import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface NameDialogData {
  title: string;
  /** The field's label, also its accessible name. */
  label: string;
  value: string;
  /** The button that confirms, e.g. "Create" or "Rename". */
  action: string;
}

/** Asks for a name, e.g. for a new map. Closes with the name, or nothing when cancelled. */
@Component({
  selector: 'app-name-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (submit)="$event.preventDefault(); done()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="field">
          <mat-label>{{ data.label }}</mat-label>
          <input matInput name="name" [(ngModel)]="name" [attr.aria-label]="data.label" cdkFocusInitial required>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-button type="submit" [disabled]="!name.trim()">{{ data.action }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: ['.field { width: 100%; }'],
})
export class NameDialog {
  protected readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<NameDialog, string>>(MatDialogRef);
  protected name = this.data.value;

  protected done(): void {
    if (this.name.trim()) this.ref.close(this.name.trim());
  }
}
