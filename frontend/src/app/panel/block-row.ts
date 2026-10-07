import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HeatService } from '../map/heat.service';
import { Store } from '../state/store';
import { Block, blockSummary, formulaParams, MAX_WEIGHT, Role } from '@boligmaskinen/engine';
import { CodeDialog, CodeDialogData } from './code-dialog';
import { ParamControl } from './param-control';

/** One block of the weighting: name, weight, and the controls its code exposes. */
@Component({
  selector: 'app-block-row',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatSliderModule, MatTooltipModule, ParamControl],
  templateUrl: './block-row.html',
  styleUrl: './block-row.scss',
})
export class BlockRow {
  protected readonly store = inject(Store);
  private readonly heat = inject(HeatService);
  private readonly dialog = inject(MatDialog);
  readonly block = input.required<Block>();
  protected readonly open = signal(false);
  protected readonly MAX_WEIGHT = MAX_WEIGHT;

  protected readonly params = computed(() => formulaParams(this.block().code));
  protected readonly summary = computed(() => blockSummary(this.block(), this.params()));
  protected readonly problem = computed(() => this.heat.issues().get(this.block().id) ?? null);
  protected readonly preview = computed(() => this.heat.preview().get(this.block().id) ?? '');

  protected onWeight(event: Event): void {
    this.store.updateBlock(this.block().id, { weight: Number((event.target as HTMLInputElement).value) });
  }

  protected setRole(role: Role): void {
    this.store.updateBlock(this.block().id, { role });
  }

  protected editCode(): void {
    const data: CodeDialogData = { blockId: this.block().id };
    this.dialog.open(CodeDialog, { data, width: '980px', maxWidth: '96vw', autoFocus: 'textarea' });
  }

  protected remove(): void {
    this.store.removeBlock(this.block().id);
  }
}
