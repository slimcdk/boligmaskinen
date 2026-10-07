/**
 * Predefined blocks. They are ordinary code, so the user can read every one of them and
 * change it; "Reset" brings back the code below.
 */
import { type Block, newId } from './blocks.ts';
import { type Criterion, DEFAULT_CRITERIA, MODE_MINUTES, type Place, type Role, type TravelMode } from './types.ts';
import { LANGUAGE_VERSION } from './migrations.ts';
import { MODES, placeValueName } from './values.ts';

export interface BlockTemplate {
  id: string;
  name: string;
  group: string;
  description: string;
  role: Role;
  weight: number;
  code: string;
}

/** The value name for a catalogue criterion. */
const VALUE_NAME: Record<string, string> = { incomeTax: 'income_tax', burglary: 'burglaries' };

interface Scale { min: number; max: number; step: number; unit: string }

function scaleOf(c: Criterion): Scale {
  switch (c.kind) {
    case 'noise': return { min: 35, max: 80, step: 1, unit: 'dB' };
    case 'count': return { min: 0, max: 255, step: 5, unit: 'addresses' };
    case 'municipal': return { min: c.min ?? 0, max: c.max ?? 10, step: c.step ?? 0.1, unit: c.unit ?? '' };
    default: return { min: 0, max: 20000, step: 50, unit: 'm' };
  }
}

/** The code for a catalogue criterion with its curve (or its allowed categories). */
export function criterionCode(c: Criterion): string {
  const name = VALUE_NAME[c.id] ?? c.id;
  if (c.kind === 'category') {
    const on = (value: number) => (c.allowed ?? []).includes(value);
    return [
      `// ${c.note}`,
      `let byzone = ${on(1)}  // Byzone`,
      `let landzone = ${on(2)}  // Landzone`,
      `let sommerhus = ${on(3)}  // Sommerhusområde`,
      `(zone == BYZONE && byzone) || (zone == LANDZONE && landzone) || (zone == SOMMERHUS && sommerhus)`,
    ].join('\n');
  }
  const s = scaleOf(c);
  const closer = c.full <= c.zero;
  const unit = s.unit ? ` (${s.unit})` : '';
  return [
    `// ${c.note}`,
    `let full = slider(${c.full}, ${s.min}, ${s.max}, ${s.step})  // ${closer ? 'Full points up to' : 'Full points from'}${unit}`,
    `let zero = slider(${c.zero}, ${s.min}, ${s.max}, ${s.step})  // ${closer ? 'No points from' : 'No points below'}${unit}`,
    `ramp(${name}, full, zero)`,
  ].join('\n');
}

export function criterionTemplate(c: Criterion): BlockTemplate {
  return { id: c.id, name: c.name, group: c.group, description: c.note, role: c.role, weight: c.weight, code: criterionCode(c) };
}

/** Blocks that show what code can do beyond one value. */
export const EXAMPLES: BlockTemplate[] = [
  {
    id: 'forest-or-water', name: 'Forest or water', group: 'Examples', role: 'want', weight: 2,
    description: 'Full points near whichever of forest and water is nearer.',
    code: [
      '// Full points near forest or water, whichever is nearer',
      'let reach = slider(3000, 500, 10000, 100)  // Reach (m)',
      'clamp(1 - min(forest, water) / reach)',
    ].join('\n'),
  },
  {
    id: 'family', name: 'School and daycare', group: 'Examples', role: 'want', weight: 2,
    description: 'Both a school and a daycare within reach.',
    code: [
      '// Both a school and a daycare within reach',
      'let full = slider(500, 0, 5000, 50)  // Full points up to (m)',
      'let zero = slider(2500, 0, 10000, 50)  // No points from (m)',
      '(ramp(school, full, zero) + ramp(daycare, full, zero)) / 2',
    ].join('\n'),
  },
  {
    id: 'quiet-and-green', name: 'Quiet and green', group: 'Examples', role: 'want', weight: 2,
    description: 'Points only where it is both quiet and close to a forest.',
    code: [
      '// Points only where it is both quiet and close to a forest',
      'let quiet = ramp(noise, 45, 60)',
      'let green = ramp(forest, 300, 2000)',
      'fallback(quiet, 1) * green',
    ].join('\n'),
  },
  {
    id: 'empty', name: 'New block', group: 'Examples', role: 'want', weight: 2,
    description: 'Write your own formula.',
    code: [
      '// Write a formula that gives a score from 0 (bad) to 1 (good).',
      '// The list next to the code shows the values you can use.',
      'let reach = slider(2000, 0, 10000, 100)  // Reach (m)',
      'clamp(1 - supermarket / reach)',
    ].join('\n'),
  },
];

export const LIBRARY: BlockTemplate[] = [...DEFAULT_CRITERIA.map(criterionTemplate), ...EXAMPLES];

/** The travel time to a place, with the mode as a choice. */
export function placeTemplate(place: Place, curve: { mode: TravelMode; full: number; zero: number; role?: Role; weight?: number } = { mode: 'car', full: MODE_MINUTES.car[0], zero: MODE_MINUTES.car[1] }): BlockTemplate {
  const index = MODES.findIndex((m) => m.mode === curve.mode) + 1;
  return {
    id: `place:${place.id}`, name: place.name, group: 'Your places', role: curve.role ?? 'want', weight: curve.weight ?? 4,
    description: `Travel time to ${place.name}`,
    code: [
      `// Travel time to ${place.name}, estimated from the straight-line distance`,
      `let travel = choice(${index}, ${MODES.map((m) => placeValueName(place, m.mode)).join(', ')})  // Travel by`,
      `let full = slider(${curve.full}, 0, 120, 1)  // Full points up to (min)`,
      `let zero = slider(${curve.zero}, 0, 180, 1)  // No points from (min)`,
      'ramp(travel, full, zero)',
    ].join('\n'),
  };
}

export function blockFrom(template: BlockTemplate): Block {
  return { id: newId('block'), name: template.name, code: template.code, role: template.role, weight: template.weight, template: template.id, language: LANGUAGE_VERSION };
}

/** The template a block came from, with the place's current name for place blocks. */
export function templateOf(block: Block, places: Place[]): BlockTemplate | null {
  if (block.template?.startsWith('place:')) {
    const place = places.find((p) => `place:${p.id}` === block.template);
    return place ? placeTemplate(place) : null;
  }
  return LIBRARY.find((t) => t.id === block.template) ?? null;
}
