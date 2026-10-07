import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/** What the viewer picked: follow the system, or always light or always dark. */
export type ThemeChoice = 'system' | 'light' | 'dark';
/** The colours in use. */
export type Scheme = 'light' | 'dark';

export const THEME_KEY = 'boligmaskinen.theme';

const asScheme = (value: string | null): Scheme | null => (value === 'light' || value === 'dark' ? value : null);

function storedChoice(): ThemeChoice {
  try {
    return asScheme(localStorage.getItem(THEME_KEY)) ?? 'system';
  } catch {
    return 'system';
  }
}

/**
 * Light and dark mode.
 *
 * The stylesheet follows the system with `color-scheme: light dark`. A page that embeds the app,
 * such as the artifact viewer, may pin a theme with data-theme on the root element. The viewer's
 * own choice in the app is set as data-scheme and wins over both. `scheme` is the outcome, for
 * what CSS cannot reach: the map style and the heatmap colours.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly choice = signal<ThemeChoice>(storedChoice());
  private readonly systemDark = signal(false);
  private readonly hostScheme = signal<Scheme | null>(null);

  readonly scheme = computed<Scheme>(() => {
    const choice = this.choice();
    if (choice !== 'system') return choice;
    return this.hostScheme() ?? (this.systemDark() ? 'dark' : 'light');
  });

  constructor() {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystem = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.systemDark.set(media?.matches ?? false);
    media?.addEventListener('change', onSystem);

    const readHost = () => this.hostScheme.set(asScheme(this.root.getAttribute('data-theme')));
    readHost();
    const observer = new MutationObserver(readHost);
    observer.observe(this.root, { attributes: true, attributeFilter: ['data-theme'] });

    this.apply(this.choice());
    inject(DestroyRef).onDestroy(() => {
      media?.removeEventListener('change', onSystem);
      observer.disconnect();
    });
  }

  set(choice: ThemeChoice): void {
    this.choice.set(choice);
    this.apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Storage can be blocked (private windows, embedded previews); the choice then lasts for this visit
    }
  }

  private apply(choice: ThemeChoice): void {
    if (choice === 'system') this.root.removeAttribute('data-scheme');
    else this.root.setAttribute('data-scheme', choice);
  }
}
