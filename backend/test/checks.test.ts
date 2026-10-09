import { describe, expect, it } from 'vitest';
import { describeChange, largeChanges } from '../src/pipeline/checks.ts';

const pack = (counts: Record<string, number>, region = 'denmark', cellMetres = 200) => ({ region: { id: region }, cellMetres, gridMetres: 100, counts });
const NATIONAL = { addresses: 2_615_075, homeCells: 459_924, schools: 1_963, daycare: 4_893, turbines: 4_866, stations: 619, mstShareOfRegion: 0.0313 };

describe('checking a new pack against the one in use', () => {
  it('lets the small changes of a normal night through', () => {
    expect(largeChanges(pack(NATIONAL), pack({ ...NATIONAL, addresses: 2_616_200, schools: 1_960, turbines: 4_870 }))).toEqual([]);
  });

  it('finds a source that broke', () => {
    const changes = largeChanges(pack(NATIONAL), pack({ ...NATIONAL, schools: 12, mstShareOfRegion: 0 }));
    expect(changes).toEqual([{ key: 'schools', before: 1_963, after: 12 }, { key: 'mstShareOfRegion', before: 0.0313, after: 0 }]);
    expect((changes as { key: string; before: number; after: number }[]).map(describeChange)).toEqual([
      'schools fell from 1,963 to 12 (−99 %)', 'the share of land with mapped noise fell from 3.1 % to 0.0 % (−100 %)',
    ]);
  });

  it('allows a few either way on small counts', () => {
    expect(largeChanges(pack({ stations: 4 }), pack({ stations: 8 }))).toEqual([]);
    expect(largeChanges(pack({ stations: 4 }), pack({ stations: 12 }))).toEqual([{ key: 'stations', before: 4, after: 12 }]);
    expect(describeChange({ key: 'stations', before: 4, after: 12 })).toBe('stations rose from 4 to 12 (+200 %)');
  });

  it('does not compare packs of another region or cell size', () => {
    expect(largeChanges(pack(NATIONAL), pack({ addresses: 1 }, 'aarhus'))).toBe('not comparable');
    expect(largeChanges(pack(NATIONAL), pack({ addresses: 1 }, 'denmark', 100))).toBe('not comparable');
  });
});
