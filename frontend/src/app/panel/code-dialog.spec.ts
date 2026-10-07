import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../state/store';
import { blockFrom, LIBRARY } from '../scoring/library';
import { CodeDialog } from './code-dialog';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CodeDialog', () => {
  let store: Store;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CodeDialog], providers: [{ provide: MAT_DIALOG_DATA, useValue: { blockId: 'b1' } }] });
    store = TestBed.inject(Store);
    store.addBlock({ ...blockFrom(LIBRARY.find((t) => t.id === 'forest')!), id: 'b1' });
  });

  function render() {
    const fixture = TestBed.createComponent(CodeDialog);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (code: string) => {
      const area = element.querySelector<HTMLTextAreaElement>('textarea')!;
      area.value = code;
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const status = () => element.querySelector('.status')!.textContent!.trim();
    return { fixture, element, type, status };
  }

  it('shows the code and the values it can use', () => {
    const { element } = render();
    expect(element.querySelector('textarea')!.value).toContain('ramp(forest, full, zero)');
    const names = [...element.querySelectorAll('.entry code')].map((c) => c.textContent);
    expect(names).toEqual(expect.arrayContaining(['forest', 'noise', 'zone', 'income_tax', 'ramp', 'BYZONE']));
  });

  it('checks the code as you type and applies it when you stop', async () => {
    const { fixture, type, status } = render();
    await type('ramp(forrest, 300, 3000)');
    expect(status()).toContain('Unknown name “forrest”. Did you mean forest?');
    await type('ramp(water, 300, 3000)');
    expect(status()).toContain('Checking');
    await wait(450);
    fixture.detectChanges();
    expect(store.blocks()[0].code).toBe('ramp(water, 300, 3000)');
    expect(status()).toContain('Valid');
  });

  it('puts a value name where the cursor is', () => {
    const { fixture, element } = render();
    const area = element.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'clamp(1 -  / 2000)';
    area.selectionStart = area.selectionEnd = 10;
    [...element.querySelectorAll<HTMLButtonElement>('.entry')].find((b) => b.querySelector('code')!.textContent === 'water')!.click();
    fixture.detectChanges();
    expect(area.value).toBe('clamp(1 - water / 2000)');
  });

  it('brings back the original code', async () => {
    const { fixture, element, type } = render();
    await type('ramp(water, 300, 3000)');
    await wait(450);
    fixture.detectChanges();
    [...element.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('Reset'))!.click();
    fixture.detectChanges();
    expect(store.blocks()[0].code).toContain('ramp(forest, full, zero)');
    expect(element.querySelector('textarea')!.value).toContain('ramp(forest, full, zero)');
  });
});
