import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18n } from '../i18n/i18n';
import { Texts } from '../i18n/texts';
import { HeatService } from '../map/heat.service';
import { Store } from '../state/store';
import { Block, blockSummary, FormulaParam, formulaParams, MAX_WEIGHT, Role, turnAround } from '@boligmaskinen/engine';
import { CodeDialog, CodeDialogData } from './code-dialog';
import { NameDialog, NameDialogData } from './name-dialog';
import { ParamControl } from './param-control';

/** One block of the weighting: name, weight or switch, and the controls its code exposes. */
@Component({
  selector: 'app-block-row',
  imports: [
    MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatSlideToggleModule, MatSliderModule,
    MatTooltipModule, TranslocoPipe, ParamControl,
  ],
  templateUrl: './block-row.html',
  styleUrl: './block-row.scss',
})
export class BlockRow {
  protected readonly store = inject(Store);
  private readonly heat = inject(HeatService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);
  protected readonly texts = inject(Texts);
  readonly block = input.required<Block>();
  /** True when the block's group is switched off. */
  readonly groupOff = input(false);
  protected readonly open = signal(false);
  protected readonly MAX_WEIGHT = MAX_WEIGHT;

  protected readonly params = computed(() => formulaParams(this.block().code));
  /** The controls in rows: one per slider or choice, and the checkboxes that follow each other together. */
  protected readonly paramRows = computed(() => {
    const rows: FormulaParam[][] = [];
    for (const param of this.params()) {
      const last = rows.at(-1);
      if (param.kind === 'flag' && last?.[0].kind === 'flag') last.push(param);
      else rows.push([param]);
    }
    return rows;
  });
  /** Its name, a predefined block's in the language in use. */
  protected readonly name = computed(() => this.texts.blockName(this.block()));
  protected readonly summary = computed(() => blockSummary(this.block(), this.params(), this.texts.wording()));
  protected readonly problem = computed(() => this.heat.issues().get(this.block().id) ?? null);
  protected readonly preview = computed(() => this.heat.preview().get(this.block().id) ?? '');
  /** Blocks with a ramp (`full` and `zero`) can give full points at the other end instead. */
  protected readonly canTurnAround = computed(() => turnAround(this.block().code) !== null);
  /** Whether the block counts: a requirement that is switched on, or a preference with weight, in a group that is on. */
  protected readonly counts = computed(() => {
    const block = this.block();
    return !this.groupOff() && block.enabled !== false && (block.role === 'must' || block.weight > 0);
  });

  protected onWeight(event: Event): void {
    this.store.updateBlock(this.block().id, { weight: Number((event.target as HTMLInputElement).value) });
  }

  protected setRole(role: Role): void {
    this.store.setRole(this.block().id, role);
  }

  protected turnAround(): void {
    this.store.turnAround(this.block().id);
  }

  protected editCode(): void {
    const data: CodeDialogData = { blockId: this.block().id };
    this.dialog.open(CodeDialog, { data, width: '980px', maxWidth: '96vw', autoFocus: 'textarea' });
  }

  protected newGroup(): void {
    const id = this.block().id;
    const t = (key: string) => this.i18n.t(key);
    const data: NameDialogData = { title: t('blockRow.newGroupTitle'), label: t('blockRow.groupName'), value: this.store.freeGroupName(t('blockRow.newGroupName')), action: t('blockRow.move') };
    this.dialog.open<NameDialog, NameDialogData, string>(NameDialog, { data, width: '400px', maxWidth: '92vw', autoFocus: 'first-tabbable' })
      .beforeClosed().subscribe((name) => name && this.store.moveToNewGroup(id, name));
  }

  protected remove(): void {
    this.store.removeBlock(this.block().id);
  }
}
