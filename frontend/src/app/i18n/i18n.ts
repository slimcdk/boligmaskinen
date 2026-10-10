import { computed, effect, EnvironmentProviders, inject, Injectable, isDevMode, makeEnvironmentProviders, provideEnvironmentInitializer, signal } from '@angular/core';
import { provideTransloco, Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import DA from '../../i18n/da.json';
import EN from '../../i18n/en.json';

export type Language = 'en' | 'da';

/** Values put into a text, as {{ name }}. */
export type TextParams = Record<string, string | number>;

/** The languages, each named in itself. */
export const LANGUAGES: { id: Language; name: string }[] = [{ id: 'da', name: 'Dansk' }, { id: 'en', name: 'English' }];

/** Every text of the app, by language (src/i18n). They are in the bundle, so switching waits for nothing. */
export const TRANSLATIONS: Record<Language, Translation> = { en: EN, da: DA };

const STORAGE = 'boligmaskinen.language';

class BundledLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(TRANSLATIONS[lang as Language] ?? EN);
  }
}

/** Transloco with the app's texts, ready before the first view. */
export function provideI18n(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
      config: {
        availableLangs: ['en', 'da'], defaultLang: 'en', fallbackLang: 'en', reRenderOnLangChange: true,
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() }, prodMode: !isDevMode(),
      },
      loader: BundledLoader,
    }),
    makeEnvironmentProviders([provideEnvironmentInitializer(() => {
      const transloco = inject(TranslocoService);
      for (const [lang, translation] of Object.entries(TRANSLATIONS)) transloco.setTranslation(translation, lang);
    })]),
  ];
}

/** The viewer's choice, or Danish for a browser that asks for it. */
function initial(): Language {
  try {
    const chosen = localStorage.getItem(STORAGE);
    if (chosen === 'en' || chosen === 'da') return chosen;
  } catch {
    // No storage: the browser decides
  }
  const asked = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  return asked.some((l) => l?.toLowerCase().startsWith('da')) ? 'da' : 'en';
}

/**
 * The language of the app: Danish or English. Templates use Transloco's pipe; code calls `t`,
 * and a computed that calls it follows the language.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly transloco = inject(TranslocoService);
  readonly language = signal<Language>(initial());
  /** For numbers and dates: a decimal comma in Danish. */
  readonly locale = computed(() => (this.language() === 'da' ? 'da-DK' : 'en-US'));

  constructor() {
    this.apply(this.language());
    effect(() => this.apply(this.language()));
  }

  use(language: Language): void {
    this.language.set(language);
    try {
      localStorage.setItem(STORAGE, language);
    } catch {
      // Kept for this visit only
    }
  }

  /** A text in the language in use. */
  t(key: string, params?: TextParams): string {
    return this.transloco.translate(key, params, this.language());
  }

  /** A text of the catalogue by its key, in English where this language has none, or null: for texts that may not be there. */
  lookup(key: string): string | null {
    for (const language of [this.language(), 'en'] as Language[]) {
      let node: unknown = TRANSLATIONS[language];
      for (const part of key.split('.')) node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
      if (typeof node === 'string') return node;
    }
    return null;
  }

  /** A text of this language's catalogue by its English words, such as a label in a block's code, or null. */
  phrase(group: string, english: string): string | null {
    const table = (TRANSLATIONS[this.language()] as Record<string, Record<string, string> | undefined>)[group];
    return table?.[english] ?? null;
  }

  /** A number as the language writes it: 3,5 in Danish. */
  number(value: number, digits = 0): string {
    return value.toLocaleString(this.locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  private apply(language: Language): void {
    this.transloco.setActiveLang(language);
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }
}
