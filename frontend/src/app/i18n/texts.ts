import { computed, inject, Injectable } from '@angular/core';
import { type Block, DEFAULT_CRITERIA, ENGLISH, EXAMPLES, type Place, type ValueInfo, type Wording } from '@boligmaskinen/engine';
import { FIRST_MAP } from '../state/store';
import { I18n, TRANSLATIONS } from './i18n';

/**
 * The engine's texts in the language in use: the names of predefined blocks, groups and values,
 * the words written in their code, and the wording of the texts it makes (wording.ts). A name the
 * user has given stays as it is.
 */
@Injectable({ providedIn: 'root' })
export class Texts {
  private readonly i18n = inject(I18n);

  /** For the engine's formatting, also in the heat worker. */
  readonly wording = computed<Wording>(() => {
    const language = this.i18n.language();
    if (language === 'en') return ENGLISH;
    const catalogue = TRANSLATIONS[language] as { wording: Omit<Wording, 'locale' | 'words'>; words: Record<string, string> };
    return { ...ENGLISH, ...catalogue.wording, locale: this.i18n.locale(), words: catalogue.words };
  });

  /** A word written in code, a unit or a travel mode, by its English. */
  word(english: string): string {
    return this.i18n.phrase('words', english) ?? english;
  }

  /** A map's name; the first map's in the language in use, as long as the user has not renamed it. */
  mapName(name: string): string {
    return name === FIRST_MAP ? this.i18n.t('maps.first') : name;
  }

  groupName(name: string): string {
    return this.i18n.phrase('groups', name) ?? name;
  }

  /** A predefined block's name in the catalogue, as offered. */
  templateName(template: { id: string; name: string }): string {
    return this.known(`criteria.${template.id}.name`) ?? this.known(`examples.${template.id}.name`) ?? template.name;
  }

  templateDescription(template: { id: string; name: string; description?: string }): string {
    // A place's block is named after the place
    if (template.id.startsWith('place:')) return this.i18n.t('catalog.travelTime', { place: template.name });
    return this.known(`criteria.${template.id}.note`) ?? this.known(`examples.${template.id}.description`) ?? template.description ?? '';
  }

  /** A block's name: a predefined one's in the language in use, as long as the user has not renamed it. */
  blockName(block: Pick<Block, 'name' | 'template'>): string {
    const criterion = DEFAULT_CRITERIA.find((c) => c.id === block.template);
    if (criterion?.name === block.name) return this.known(`criteria.${criterion.id}.name`) ?? block.name;
    if (criterion?.opposite === block.name) return this.known(`criteria.${criterion.id}.opposite`) ?? block.name;
    const example = EXAMPLES.find((e) => e.id === block.template);
    if (example?.name === block.name) return this.known(`examples.${example.id}.name`) ?? block.name;
    return block.name;
  }

  /** What a value means, for the list of values. */
  valueLabel(info: ValueInfo, places: Place[] = []): string {
    if (info.place) {
      const place = places.find((p) => p.id === info.place!.id);
      return this.i18n.t(`places.${info.place.mode}`, { place: place?.name ?? '' });
    }
    return this.known(`values.${info.name}`) ?? info.label;
  }

  private known(key: string): string | null {
    return this.i18n.lookup(key);
  }
}
