import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FIRST_MAP, Store } from '../state/store';
import { MapSwitcher } from './map-switcher';

describe('MapSwitcher', () => {
  let store: Store;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MapSwitcher],
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
    store = TestBed.inject(Store);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(MapSwitcher);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const open = () => {
      button.click();
      fixture.detectChanges();
    };
    const label = (item: Element) => item.querySelector('.mat-mdc-menu-item-text')!.textContent!.trim();
    const items = () => [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')];
    const item = (text: string) => items().find((i) => label(i) === text)!;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, button, open, label, item, settle };
  }

  it('names the open map and switches to another', () => {
    store.newMap('Near the sea');
    const { fixture, button, open, label } = render();
    expect(button.getAttribute('aria-label')).toBe('Map: Near the sea. Switch, add or change maps');
    open();
    const maps = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    expect(maps.map(label)).toEqual([FIRST_MAP, 'Near the sea']);
    expect(maps.map((m) => m.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    maps[0].click();
    fixture.detectChanges();
    expect(store.map().name).toBe(FIRST_MAP);
    expect(button.getAttribute('aria-label')).toBe(`Map: ${FIRST_MAP}. Switch, add or change maps`);
  });

  it('starts a new map under the name given', async () => {
    const { open, item, settle } = render();
    open();
    item('New map').click();
    await settle();
    const input = document.querySelector<HTMLInputElement>('app-name-dialog input')!;
    expect(input.value).toBe('Map');
    input.value = 'Near the sea';
    input.dispatchEvent(new Event('input'));
    await settle();
    document.querySelector<HTMLButtonElement>('app-name-dialog button[type="submit"]')!.click();
    await settle();
    expect(store.maps().map((m) => m.name)).toEqual([FIRST_MAP, 'Near the sea']);
    expect(store.map().name).toBe('Near the sea');
  });

  it('asks before it deletes a map, and keeps the last one', async () => {
    store.newMap('Second');
    const { open, item, settle } = render();
    open();
    item('Delete this map').click();
    await settle();
    expect(document.querySelector('app-confirm-dialog h2')!.textContent).toBe('Delete "Second"?');
    [...document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')].find((b) => b.textContent!.trim() === 'Delete')!.click();
    await settle();
    expect(store.maps().map((m) => m.name)).toEqual([FIRST_MAP]);
    open();
    expect(item('Delete this map').disabled).toBe(true);
  });
});
