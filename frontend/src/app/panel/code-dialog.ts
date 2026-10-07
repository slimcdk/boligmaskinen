import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HeatService } from '../map/heat.service';
import { Store } from '../state/store';
import { compileFormula, CONSTANTS, describeError, FUNCTIONS } from '../scoring/formula';
import { templateOf } from '../scoring/library';
import { Role } from '../scoring/types';

export interface CodeDialogData {
  blockId: string;
}

/** Wait this long after typing before the map recalculates. */
const APPLY_AFTER_MS = 350;

/** Read and change a block's code, with the values and functions it can use. */
@Component({
  selector: 'app-code-dialog',
  imports: [MatButtonModule, MatButtonToggleModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './code-dialog.html',
  styleUrl: './code-dialog.scss',
})
export class CodeDialog {
  private readonly data = inject<CodeDialogData>(MAT_DIALOG_DATA);
  protected readonly store = inject(Store);
  private readonly heat = inject(HeatService);
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly block = computed(() => this.store.blocks().find((b) => b.id === this.data.blockId) ?? null);
  /** What is in the editor; it reaches the block shortly after typing stops. */
  protected readonly draft = signal(this.block()?.code ?? '');
  protected readonly functions = Object.entries(FUNCTIONS).map(([name, f]) => ({ name, help: f.help }));
  protected readonly constants = Object.entries(CONSTANTS).map(([name, c]) => ({ name, help: c.help }));

  protected readonly groups = computed(() => {
    const groups = new Map<string, { name: string; label: string }[]>();
    for (const v of this.heat.values()) {
      const list = groups.get(v.group) ?? [];
      list.push({ name: v.name, label: v.unit ? `${v.label} (${v.unit})` : v.label });
      groups.set(v.group, list);
    }
    return [...groups].map(([group, values]) => ({ group, values }));
  });

  /** Syntax and names are checked as you type; the score range comes from the last map update. */
  protected readonly status = computed(() => {
    const block = this.block();
    const compiled = compileFormula(this.draft(), this.heat.names());
    if (!compiled.ok) return { ok: false, text: describeError(compiled.error) };
    const applied = block?.code === this.draft();
    const issue = applied ? this.heat.issues().get(block!.id) : undefined;
    if (issue) return { ok: false, text: issue };
    const preview = applied ? this.heat.preview().get(block!.id) : undefined;
    const kind = block?.role === 'must' ? 'Valid requirement' : 'Valid: gives a score from 0 to 1';
    return { ok: true, text: preview ? `${kind} · ${preview}` : applied ? kind : 'Checking…' };
  });

  protected readonly canReset = computed(() => {
    const block = this.block();
    const template = block && templateOf(block, this.store.places());
    return !!template && template.code !== block!.code;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.apply());
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(), APPLY_AFTER_MS);
  }

  private apply(): void {
    clearTimeout(this.timer);
    const block = this.block();
    if (block && block.code !== this.draft()) this.store.updateBlock(block.id, { code: this.draft() });
  }

  /** Put a value or function name where the cursor is. */
  protected insert(text: string): void {
    const area = this.editor()?.nativeElement;
    if (!area) return;
    const { selectionStart, selectionEnd, value } = area;
    area.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    area.selectionStart = area.selectionEnd = selectionStart + text.length;
    area.focus();
    area.dispatchEvent(new Event('input'));
  }

  protected rename(event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    const block = this.block();
    if (name && block) this.store.updateBlock(block.id, { name });
  }

  protected setRole(role: Role): void {
    const block = this.block();
    if (block) this.store.updateBlock(block.id, { role });
  }

  protected reset(): void {
    const block = this.block();
    if (!block) return;
    this.store.resetBlock(block.id);
    this.draft.set(this.block()!.code);
  }
}
