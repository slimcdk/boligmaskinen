/**
 * The words and number format of the texts the engine makes, such as "3.0 km" or "Full points up
 * to 300 m · No points from 3.0 km". English unless the app passes its language's, which the
 * frontend makes from its catalogues (frontend/src/i18n). Plain data, so it goes to the heat
 * worker too.
 */
export interface Wording {
  /** For numbers: da-DK writes 3,5. */
  locale: string;
  noData: string;
  /** A travel time of 255 minutes, the most the layers hold. */
  hoursOrMore: string;
  /** A ramp, as `{{ full }}` and `{{ zero }}` with their units: for less is better, and for more. */
  fullUpTo: string;
  noPointsBelow: string;
  /** A ramp of distances that starts at 0 m, as for an area: full points, or none, inside it. */
  fullInside: string;
  noPointsInside: string;
  /** A requirement's allowed categories, as `{{ list }}`. */
  only: string;
  /** The first of many switches that are on, as `{{ list }}`, and how many more are, `{{ n }}`. */
  andMore: string;
  /** Many switches on but a few, which are `{{ list }}`. */
  allBut: string;
  nothingAllowed: string;
  /** A preference with every switch off, which gives no points. */
  noneTicked: string;
  /** A block without controls or a comment. */
  customCode: string;
  /** Words written in code, units and travel modes, by their English: "Full points at", "heights", "car". */
  words: Record<string, string>;
}

export const ENGLISH: Wording = {
  locale: 'en-US',
  noData: 'no data',
  hoursOrMore: '4 h or more',
  fullUpTo: 'Full points up to {{ full }} · No points from {{ zero }}',
  noPointsBelow: 'No points below {{ zero }} · Full points from {{ full }}',
  fullInside: 'Full points inside the area · No points from {{ zero }}',
  noPointsInside: 'No points inside the area · Full points from {{ full }}',
  only: 'Only {{ list }}',
  andMore: '{{ list }} and {{ n }} more',
  allBut: 'All but {{ list }}',
  nothingAllowed: 'Nothing allowed',
  noneTicked: 'None ticked',
  customCode: 'Custom code',
  words: {},
};

/** A text with its `{{ name }}` filled in. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => values[name] ?? '');
}

/** An English word or phrase in the wording's language, or as it is. */
export function word(wording: Wording, english: string): string {
  return wording.words[english] ?? english;
}

/** A number in the wording's language: 3.5 or 3,5, with no grouping, so 1000 stays 1000. */
export function formatNumber(value: number, wording: Wording, digits: number, most = digits): string {
  return value.toLocaleString(wording.locale, { minimumFractionDigits: digits, maximumFractionDigits: most, useGrouping: false });
}
