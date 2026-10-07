import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, ThemeService } from './theme.service';

/** A stand-in for the system's dark mode setting, which the tests can switch. */
function fakeSystem(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: dark,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => media);
  return {
    set(next: boolean) {
      media.matches = next;
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
  };
}

const root = document.documentElement;
const observed = () => new Promise((resolve) => setTimeout(resolve));

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-scheme');
    root.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('follows the system until the viewer picks a theme', () => {
    const system = fakeSystem(false);
    const theme = TestBed.inject(ThemeService);
    expect(theme.choice()).toBe('system');
    expect(theme.scheme()).toBe('light');
    expect(root.hasAttribute('data-scheme')).toBe(false);
    system.set(true);
    expect(theme.scheme()).toBe('dark');
  });

  it('sets the choice on the page, lets it win over the system and remembers it', () => {
    fakeSystem(false);
    const theme = TestBed.inject(ThemeService);
    theme.set('dark');
    expect(theme.scheme()).toBe('dark');
    expect(root.getAttribute('data-scheme')).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    // The next visit starts dark before anything is drawn
    TestBed.resetTestingModule();
    root.removeAttribute('data-scheme');
    const next = TestBed.inject(ThemeService);
    expect(next.choice()).toBe('dark');
    expect(root.getAttribute('data-scheme')).toBe('dark');

    next.set('system');
    expect(root.hasAttribute('data-scheme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(next.scheme()).toBe('light');
  });

  it('follows a theme the host page pins, unless the viewer picked one', async () => {
    fakeSystem(false);
    root.setAttribute('data-theme', 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.scheme()).toBe('dark');
    root.setAttribute('data-theme', 'light');
    await observed();
    expect(theme.scheme()).toBe('light');
    theme.set('dark');
    expect(theme.scheme()).toBe('dark');
    // The host's attribute is left alone
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('works when the browser blocks storage', () => {
    fakeSystem(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const theme = TestBed.inject(ThemeService);
    expect(theme.choice()).toBe('system');
    expect(() => theme.set('dark')).not.toThrow();
    expect(theme.scheme()).toBe('dark');
  });

  it('ignores a stored value it does not know', () => {
    fakeSystem(true);
    localStorage.setItem(THEME_KEY, 'sepia');
    const theme = TestBed.inject(ThemeService);
    expect(theme.choice()).toBe('system');
    expect(theme.scheme()).toBe('dark');
  });
});
