import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  afterEach(() => TestBed.resetTestingModule());

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

  it('gives a requirement a switch instead of a weight', () => {
    const { fixture, element } = render('zone');
    const toggle = element.querySelector<HTMLButtonElement>('.required [role="switch"]')!;
    expect(toggle.getAttribute('aria-label')).toBe('Required: Planning zone');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(element.querySelector('.weight')).toBeNull();
    toggle.click();
    fixture.componentRef.setInput('block', store.blocks()[0]);
    fixture.detectChanges();
    expect(store.activeBlocks()).toEqual([]);
    expect(element.querySelector('.line')!.classList).toContain('off');
  });

  it('moves the block to another group, or removes it, from its menu', () => {
    store.addTemplate('noise');
    const { fixture, element } = render('forest');
    const item = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')]
      .find((i) => i.querySelector('.mat-mdc-menu-item-text')!.textContent!.trim() === text)!;
    element.querySelector<HTMLButtonElement>('button.expand')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('button[aria-label="More for Forest"]')!.click();
    fixture.detectChanges();
    item('Move to group').click();
    fixture.detectChanges();
    expect(item('Nature').getAttribute('aria-checked')).toBe('true');
    item('Peace and quiet').click();
    expect(store.groups().map((g) => g.name)).toEqual(['Peace and quiet']);
    expect(store.blocks().map((b) => b.group)).toEqual([store.groups()[0].id, store.groups()[0].id]);
  });

  it('turns a block with a ramp around, and offers nothing to turn for one without', () => {
    const { fixture, element } = render('noise');
    element.querySelector<HTMLButtonElement>('button.expand')!.click();
    fixture.detectChanges();
    const button = element.querySelector<HTMLButtonElement>('button[aria-label="Turn around"]')!;
    button.click();
    fixture.componentRef.setInput('block', store.blocks()[0]);
    fixture.detectChanges();
    expect(element.querySelector('.name')!.textContent).toBe('Noisy');
    expect(element.querySelector('.rule')!.textContent!.trim()).toBe('No points below 45 dB · Full points from 65 dB');

    const zone = render('zone');
    zone.element.querySelector<HTMLButtonElement>('button.expand')!.click();
    zone.fixture.detectChanges();
    expect(zone.element.textContent).not.toContain('Turn around');
  });

  it('dims a preference that counts for nothing', () => {
    const { fixture, element } = render('forest');
    expect(element.querySelector('.line')!.classList).not.toContain('off');
    store.updateBlock(store.blocks()[0].id, { weight: 0 });
    fixture.componentRef.setInput('block', store.blocks()[0]);
    fixture.detectChanges();
    expect(element.querySelector('.line')!.classList).toContain('off');
  });

  it('folds out the controls, what the block gives, and its actions; the role is in its menu', () => {
    const { fixture, element } = render('forest');
    element.querySelector<HTMLButtonElement>('button.expand')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('app-param-control')).toHaveLength(2);
    expect([...element.querySelectorAll('.foot button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Turn around', 'Code', 'More for Forest']);
    element.querySelector<HTMLButtonElement>('button[aria-label="More for Forest"]')!.click();
    fixture.detectChanges();
    const item = [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')].find((i) => i.textContent!.includes('Use as a requirement'))!;
    item.click();
    expect(store.blocks()[0].role).toBe('must');
  });

  it('puts checkboxes that follow each other in one row', () => {
    const { fixture, element } = render('zone');
    element.querySelector<HTMLButtonElement>('button.expand')!.click();
    fixture.detectChanges();
    const rows = element.querySelectorAll('.flags');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelectorAll('mat-checkbox')).toHaveLength(3);
  });
});
