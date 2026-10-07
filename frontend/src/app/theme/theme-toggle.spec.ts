import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './theme-toggle';
import { ThemeService } from './theme.service';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-scheme');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ThemeToggle] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function render() {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const items = () => [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    return { fixture, button, items };
  }

  it('names the current choice and offers system, light and dark', () => {
    const { fixture, button, items } = render();
    expect(button.getAttribute('aria-label')).toBe('Theme: System');
    button.click();
    fixture.detectChanges();
    expect(items().map((item) => item.querySelector('.label')!.textContent)).toEqual(['System', 'Light', 'Dark']);
    expect(items().map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });

  it('switches to the picked theme', () => {
    const { fixture, button, items } = render();
    button.click();
    fixture.detectChanges();
    items().find((item) => item.textContent!.includes('Dark'))!.click();
    fixture.detectChanges();
    expect(TestBed.inject(ThemeService).scheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Theme: Dark');
  });
});
