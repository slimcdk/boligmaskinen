import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../state/store';
import { BlockRow } from './block-row';

describe('BlockRow', () => {
  let store: Store;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [BlockRow] });
    store = TestBed.inject(Store);
  });

  function render(template: string) {
    store.addTemplate(template);
    const fixture = TestBed.createComponent(BlockRow);
    fixture.componentRef.setInput('block', store.blocks().at(-1)!);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the name, a summary of the controls and the weight', () => {
    const { element } = render('forest');
    expect(element.querySelector('.name')!.textContent).toBe('Forest');
    expect(element.querySelector('.rule')!.textContent!.trim()).toBe('Full points up to 300 m · No points from 3.0 km');
    const weight = element.querySelector<HTMLInputElement>('.weight input[type="range"]')!;
    expect(weight.getAttribute('aria-label')).toBe('Weight of Forest');
    expect([weight.min, weight.max, weight.value]).toEqual(['0', '10', '4']);
    expect(element.querySelector('.weight-value')!.textContent).toBe('4');
  });

  it('changes the weight with the slider', () => {
    const { fixture, element } = render('forest');
    const weight = element.querySelector<HTMLInputElement>('.weight input[type="range"]')!;
    weight.value = '7';
    weight.dispatchEvent(new Event('input'));
    fixture.componentRef.setInput('block', store.blocks()[0]);
    fixture.detectChanges();
    expect(store.blocks()[0].weight).toBe(7);
    expect(element.querySelector('.weight-value')!.textContent).toBe('7');
  });

  it('marks a requirement instead of showing a weight', () => {
    const { element } = render('zone');
    expect(element.querySelector('.required')!.textContent).toBe('Required');
    expect(element.querySelector('.weight')).toBeNull();
  });

  it('folds out the controls and the role', () => {
    const { fixture, element } = render('forest');
    element.querySelector<HTMLButtonElement>('button.expand')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('app-param-control')).toHaveLength(2);
    [...element.querySelectorAll<HTMLButtonElement>('.role button')].find((b) => b.textContent!.includes('Requirement'))!.click();
    expect(store.blocks()[0].role).toBe('must');
  });
});
