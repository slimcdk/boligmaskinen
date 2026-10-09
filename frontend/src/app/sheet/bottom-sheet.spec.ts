import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BottomSheet, PEEK_HEIGHT, SheetState } from './bottom-sheet';

@Component({
  imports: [BottomSheet],
  template: `<app-bottom-sheet [(state)]="state" (settledHeight)="settled.set($event)"><p class="inside">Panel</p></app-bottom-sheet>`,
})
class Host {
  readonly state = signal<SheetState>('peek');
  readonly settled = signal(0);
}

describe('BottomSheet', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Host] });
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const sheet = element.querySelector<HTMLElement>('app-bottom-sheet')!;
    const handle = element.querySelector<HTMLElement>('.handle')!;
    const pointer = (type: string, clientY: number, timeStamp?: number) => {
      const event = new PointerEvent(type, { pointerId: 1, clientY, bubbles: true });
      if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
      handle.dispatchEvent(event);
      fixture.detectChanges();
    };
    handle.setPointerCapture = () => undefined;
    return { fixture, host: fixture.componentInstance, sheet, handle, pointer };
  }

  it('starts down, with the panel inside, and says where its handle takes it', () => {
    const { host, sheet, handle } = render();
    expect(sheet.querySelector('.inside')!.textContent).toBe('Panel');
    expect(sheet.style.height).toBe(`${PEEK_HEIGHT}px`);
    expect(host.settled()).toBe(PEEK_HEIGHT);
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    expect(handle.getAttribute('aria-label')).toBe('Show the panel');
  });

  it('goes up to half the screen and back down with a tap or the keyboard', () => {
    const { fixture, host, handle, pointer } = render();
    pointer('pointerdown', 500);
    pointer('pointerup', 501);
    expect(host.state()).toBe('half');
    expect(host.settled()).toBe(Math.round(window.innerHeight / 2));
    expect(handle.getAttribute('aria-label')).toBe('Show less of the panel');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(host.state()).toBe('peek');
  });

  it('follows a drag, and settles at the nearest height, or the next one after a flick', () => {
    const { host, sheet, pointer } = render();
    const top = window.innerHeight - 56;
    // A slow drag nearly all the way up settles at the top
    pointer('pointerdown', 700, 0);
    pointer('pointermove', 400, 1000);
    expect(sheet.style.height).toBe(`${Math.min(top, PEEK_HEIGHT + 300)}px`);
    pointer('pointermove', 0, 2000);
    pointer('pointerup', 0, 2000);
    expect(host.state()).toBe('full');
    // A quick flick down from the top goes to the middle, not all the way
    pointer('pointerdown', 100, 3000);
    pointer('pointermove', 140, 3010);
    pointer('pointerup', 140, 3010);
    expect(host.state()).toBe('half');
  });
});
