import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Block, BlockGroup } from '@boligmaskinen/engine';
import { Store } from '../state/store';
import { BlockRow } from './block-row';

/** A group of blocks: its name, a switch for all of them together, and the blocks, which can be folded away. */
@Component({
  selector: 'app-group-section',
  imports: [MatButtonModule, MatIconModule, MatSlideToggleModule, BlockRow],
  templateUrl: './group-section.html',
  styleUrl: './group-section.scss',
})
export class GroupSection {
  protected readonly store = inject(Store);
  readonly group = input.required<BlockGroup>();
  readonly blocks = input.required<Block[]>();
  protected readonly collapsed = computed(() => !!this.group().collapsed);

  protected fold(): void {
    this.store.setGroupCollapsed(this.group().id, !this.collapsed());
  }

  protected rename(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) this.store.renameGroup(this.group().id, input.value);
    else input.value = this.group().name;
  }
}
