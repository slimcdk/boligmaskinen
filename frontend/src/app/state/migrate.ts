/**
 * Carries the earlier prototypes' choices over to blocks, so nothing the user set is lost:
 * v1 saved picked criteria and places with their curves, v2 saved groups of connected blocks.
 */
import { Block, newId } from '@boligmaskinen/engine';
import { blockFrom, criterionTemplate, placeTemplate } from '@boligmaskinen/engine';
import { Criterion, Curve, MODE_MINUTES, Place, Role, TravelMode, ViewState } from '@boligmaskinen/engine';

/** What the first prototype saved. */
export interface SavedV1 {
  active?: string[];
  criteria?: (Partial<Curve> & { id: string; allowed?: number[] })[];
  places?: (Place & Partial<Curve> & { mode?: TravelMode })[];
  view?: ViewState;
}

/** What the group prototype saved (only the parts that carry over). */
export interface SavedV2 {
  flow?: {
    groups?: {
      name: string;
      weight: number;
      template?: string;
      nodes: { id: string; data: { type: string; source?: string; placeId?: string; mode?: TravelMode; full?: number; zero?: number; limit?: number; atMost?: boolean; allowed?: number[]; code?: string } }[];
      edges: { source: string; target: string }[];
    }[];
  };
  places?: Place[];
  view?: ViewState;
}

export interface Migrated {
  blocks: Block[];
  places: Place[];
  view?: ViewState;
}

function criterionBlock(base: Criterion, changes: Partial<Curve> & { allowed?: number[] }): Block {
  return blockFrom(criterionTemplate({ ...base, ...changes }));
}

export function migrateV1(saved: SavedV1, catalogue: Criterion[]): Migrated {
  const blocks = (saved.active ?? []).flatMap((id) => {
    const base = catalogue.find((c) => c.id === id);
    return base ? [criterionBlock(base, saved.criteria?.find((c) => c.id === id) ?? {})] : [];
  });
  const places = (saved.places ?? []).map(({ id, name, lng, lat }) => ({ id, name, lng, lat }));
  for (const p of saved.places ?? []) {
    const mode = p.mode ?? 'car';
    const [full, zero] = MODE_MINUTES[mode];
    blocks.push(blockFrom(placeTemplate(p, { mode, full: p.full ?? full, zero: p.zero ?? zero, role: p.role ?? 'want', weight: p.weight ?? 4 })));
  }
  return { blocks, places, view: saved.view };
}

/** Each group becomes the blocks it was made of: its curves and requirements, places and code. */
export function migrateV2(saved: SavedV2, catalogue: Criterion[]): Migrated {
  const places = saved.places ?? [];
  const blocks: Block[] = [];
  for (const group of saved.flow?.groups ?? []) {
    const byId = new Map(group.nodes.map((n) => [n.id, n]));
    const single = group.nodes.filter((n) => n.data.type === 'curve' || n.data.type === 'limit' || n.data.type === 'code').length === 1;
    for (const node of group.nodes) {
      const d = node.data;
      const name = (fallback: string) => (single ? group.name : fallback);
      if (d.type === 'code' && d.code) {
        blocks.push({ id: newId('block'), name: name('Code'), code: d.code, role: 'want', weight: group.weight });
        continue;
      }
      if (d.type !== 'curve' && d.type !== 'limit') continue;
      const input = byId.get(group.edges.find((e) => e.target === node.id)?.source ?? '')?.data;
      const role: Role = d.type === 'limit' ? 'must' : 'want';
      const full = d.type === 'curve' ? d.full : d.atMost === false ? (d.limit ?? 0) * 2 : 0;
      const zero = d.type === 'curve' ? d.zero : d.limit;
      if (input?.type === 'layer') {
        const base = catalogue.find((c) => c.id === input.source);
        if (!base) continue;
        const block = criterionBlock(base, { role, weight: group.weight, ...(full !== undefined && { full }), ...(zero !== undefined && { zero }), ...(d.allowed && { allowed: d.allowed }) });
        blocks.push({ ...block, name: name(base.name) });
      } else if (input?.type === 'place') {
        const place = places.find((p) => p.id === input.placeId);
        if (!place) continue;
        const mode = input.mode ?? 'car';
        const [defaultFull, defaultZero] = MODE_MINUTES[mode];
        blocks.push(blockFrom(placeTemplate(place, { mode, full: full ?? defaultFull, zero: zero ?? defaultZero, role, weight: group.weight })));
      }
    }
  }
  return { blocks, places, view: saved.view };
}
