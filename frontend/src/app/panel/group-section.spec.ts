import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../state/store';
import { GroupSection } from './group-section';

describe('GroupSection', () => {
  let store: Store;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [GroupSection] });
    store = TestBed.inject(Store);
    store.addTemplate('forest');
    store.addTemplate('water');
  });

  afterEach(() => TestBed.resetTestingModule());

  /** The first group, given the store's current state again on every update, as the panel does. */
  function render() {
    const fixture = TestBed.createComponent(GroupSection);
    const update = () => {
      const group = store.groups()[0];
      fixture.componentRef.setInput('group', group);
      fixture.componentRef.setInput('blocks', store.blocks().filter((b) => b.group === group.id));
      fixture.detectChanges();
    };
    update();
    return { element: fixture.nativeElement as HTMLElement, update };
  }

  it('shows its name and its blocks, and folds them away', () => {
    const { element, update } = render();
    expect(element.querySelector<HTMLInputElement>('input.name')!.value).toBe('Nature');
    expect([...element.querySelectorAll('app-block-row .name')].map((n) => n.textContent)).toEqual(['Forest', 'Lake or sea']);
    element.querySelector<HTMLButtonElement>('button.fold')!.click();
    update();
    expect(element.querySelectorAll('app-block-row')).toHaveLength(0);
    expect(element.querySelector('.count')!.textContent).toBe('2 blocks');
    expect(element.querySelector('button.fold')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('switches all its blocks off and on together', () => {
    const { element, update } = render();
    const toggle = element.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle.getAttribute('aria-label')).toBe('Use Nature');
    toggle.click();
    update();
    expect(store.activeBlocks()).toEqual([]);
    expect(element.querySelectorAll('app-block-row .line.off')).toHaveLength(2);
    toggle.click();
    update();
    expect(store.activeBlocks()).toHaveLength(2);
  });

  it('is renamed in place, and keeps its name when the field is emptied', () => {
    const { element, update } = render();
    const name = element.querySelector<HTMLInputElement>('input.name')!;
    name.value = 'Outdoors';
    name.dispatchEvent(new Event('change'));
    update();
    expect(store.groups()[0].name).toBe('Outdoors');
    name.value = '  ';
    name.dispatchEvent(new Event('change'));
    update();
    expect(store.groups()[0].name).toBe('Outdoors');
    expect(name.value).toBe('Outdoors');
  });
});
