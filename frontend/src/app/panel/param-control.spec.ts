import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../state/store';
import { formulaParams } from '../scoring/formula';
import { ParamControl } from './param-control';

const values = (code: string) => Object.fromEntries(formulaParams(code).map((p) => [p.name, p.value]));

describe('ParamControl', () => {
  let store: Store;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ParamControl] });
    store = TestBed.inject(Store);
  });

  function render(template: string, name: string) {
    store.addTemplate(template);
    const block = store.blocks().at(-1)!;
    const fixture = TestBed.createComponent(ParamControl);
    fixture.componentRef.setInput('param', formulaParams(block.code).find((p) => p.name === name)!);
    fixture.componentRef.setInput('block', block.id);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, block: () => store.blocks().find((b) => b.id === block.id)! };
  }

  it('shows a number as a slider with its label and unit, and rewrites the code when it moves', () => {
    const { element, block } = render('forest', 'full');
    expect(element.textContent).toContain('Full points up to');
    expect(element.textContent).toContain('300 m');
    // Distances use a square-root scale: half way along the slider is a quarter of the 20 km range
    const input = element.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(input.max).toBe('1000');
    expect(input.value).toBe(String(Math.round(Math.sqrt(300 / 20000) * 1000)));
    input.value = '500';
    input.dispatchEvent(new Event('input'));
    expect(values(block().code)['full']).toBe(5000);
  });

  it('keeps other numbers on a straight scale', () => {
    const { element, block } = render('noise', 'zero');
    const input = element.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect([input.min, input.max]).toEqual(['35', '80']);
    input.value = '60';
    input.dispatchEvent(new Event('input'));
    expect(values(block().code)['zero']).toBe(60);
  });

  it('shows true and false as a checkbox', () => {
    const { element, block } = render('zone', 'sommerhus');
    const box = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.checked).toBe(false);
    box.click();
    expect(values(block().code)['sommerhus']).toBe(1);
  });

  it('shows a choice as toggles named after the options', () => {
    const place = store.addPlace(10, 56);
    const block = store.blocks().find((b) => b.template === `place:${place.id}`)!;
    const fixture = TestBed.createComponent(ParamControl);
    fixture.componentRef.setInput('param', formulaParams(block.code)[0]);
    fixture.componentRef.setInput('block', block.id);
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('mat-button-toggle button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Car', 'Bike', 'Walk', 'Train']);
    buttons[3].click();
    expect(values(store.blocks().find((b) => b.id === block.id)!.code)['travel']).toBe(4);
  });
});
