import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { blockFrom, blockSummary, CONSTANTS, DATA_VALUES, DEFAULT_CRITERIA, EXAMPLES, FUNCTIONS, LIBRARY, placeValues } from '@boligmaskinen/engine';
import { I18n, TRANSLATIONS } from './i18n';
import { Texts } from './texts';

type Catalogue = Record<string, Record<string, Record<string, string> | string>>;

describe('the Danish texts', () => {
  const da = TRANSLATIONS.da as unknown as Catalogue;

  it('name every predefined block, value, group, function and constant', () => {
    const missing = [
      ...DEFAULT_CRITERIA.filter((c) => !(da['criteria'][c.id] as Record<string, string>)?.['name'] || (c.opposite && !(da['criteria'][c.id] as Record<string, string>)['opposite'])).map((c) => `criteria.${c.id}`),
      ...EXAMPLES.filter((e) => !(da['examples'][e.id] as Record<string, string>)?.['name']).map((e) => `examples.${e.id}`),
      ...DATA_VALUES.filter((v) => !da['values'][v.name]).map((v) => `values.${v.name}`),
      ...[...new Set(LIBRARY.map((t) => t.group))].filter((group) => !da['groups'][group]).map((group) => `groups.${group}`),
      ...Object.keys(FUNCTIONS).filter((name) => !da['functions'][name]).map((name) => `functions.${name}`),
      ...Object.keys(CONSTANTS).filter((name) => !da['constants'][name]).map((name) => `constants.${name}`),
    ];
    expect(missing).toEqual([]);
  });
});

describe('Texts', () => {
  afterEach(() => TestBed.inject(I18n).use('en'));

  it("names predefined blocks in the language in use, but keeps a user's own name", () => {
    const texts = TestBed.inject(Texts);
    const airport = blockFrom(LIBRARY.find((t) => t.id === 'airport')!);
    expect(texts.blockName(airport)).toBe('Away from airports');
    TestBed.inject(I18n).use('da');
    expect(texts.blockName(airport)).toBe('Væk fra lufthavne');
    expect(texts.blockName({ ...airport, name: 'Fly' })).toBe('Fly');
    expect(texts.groupName('Peace and quiet')).toBe('Ro og fred');
  });

  it('writes numbers and the summary of a block as the language does', () => {
    const texts = TestBed.inject(Texts);
    const forest = blockFrom(LIBRARY.find((t) => t.id === 'forest')!);
    expect(blockSummary(forest, undefined, texts.wording())).toBe('Full points up to 300 m · No points from 3.0 km');
    TestBed.inject(I18n).use('da');
    expect(blockSummary(forest, undefined, texts.wording())).toBe('Fulde point op til 300 m · Ingen point fra 3,0 km');
  });

  it("names a place's values after the place", () => {
    const texts = TestBed.inject(Texts);
    const place = { id: 'p1', name: 'Arbejde', lng: 10.2, lat: 56.15 };
    const [car] = placeValues([place]);
    TestBed.inject(I18n).use('da');
    expect(texts.valueLabel(car, [place])).toBe('Minutter til Arbejde i bil');
  });
});
