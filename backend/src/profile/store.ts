import type { EntityVersion, MapValue, PlaceValue, Profile, ProfileChange, ProfileSaved } from '@boligmaskinen/engine';
import type pg from 'pg';

const TABLES = { map: 'saved_map', place: 'place' } as const;

/** The whole profile, as one snapshot: maps and places in the order they were made. */
export async function loadProfile(db: pg.Pool): Promise<Profile> {
  const { rows } = await db.query<Profile>(`
    select p.epoch, p.revision,
      coalesce((select json_agg(json_build_object(
        'id', id, 'name', name, 'blocks', blocks, 'groups', groups, 'version', version, 'updatedAt', updated_at
      ) order by seq) from saved_map), '[]') as maps,
      coalesce((select json_agg(json_build_object(
        'id', id, 'name', name, 'lng', lng, 'lat', lat, 'version', version, 'updatedAt', updated_at
      ) order by seq) from place), '[]') as places
    from profile p where p.id = 1`);
  return rows[0];
}

/**
 * Save the changes, all or none. A change made from another version than the server has is a
 * conflict, and then nothing is saved: the answer lists the versions the server has, so the device
 * can decide and try again. Deleting what is already gone is fine.
 */
export async function saveChanges(db: pg.Pool, changes: ProfileChange[]): Promise<ProfileSaved | { conflicts: EntityVersion[] }> {
  const client = await db.connect();
  try {
    await client.query('begin');
    // One save at a time: the profile row is the lock
    const { rows: [profile] } = await client.query<{ revision: number }>('select revision from profile where id = 1 for update');
    const saved: EntityVersion[] = [];
    const conflicts: EntityVersion[] = [];
    for (const change of changes) {
      const table = TABLES[change.kind];
      const found = await client.query<{ version: number }>(`select version from ${table} where id = $1`, [change.id]);
      const current = found.rows[0]?.version ?? null;
      const entity = { kind: change.kind, id: change.id };
      if (change.value === null) {
        if (current !== null && current !== change.base) conflicts.push({ ...entity, version: current });
        else {
          if (current !== null) await client.query(`delete from ${table} where id = $1`, [change.id]);
          saved.push({ ...entity, version: null });
        }
      } else if (current !== change.base) {
        conflicts.push({ ...entity, version: current });
      } else {
        saved.push({ ...entity, version: await write(client, change.kind, change.id, change.value, current) });
      }
    }
    if (conflicts.length) {
      await client.query('rollback');
      return { conflicts };
    }
    if (!saved.length) {
      await client.query('rollback');
      return { revision: profile.revision, saved };
    }
    const { rows: [next] } = await client.query<{ revision: number }>('update profile set revision = revision + 1 where id = 1 returning revision');
    await client.query('commit');
    return { revision: next.revision, saved };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Insert a map or place, or update it; returns its new version. */
async function write(client: pg.PoolClient, kind: ProfileChange['kind'], id: string, value: MapValue | PlaceValue, current: number | null): Promise<number> {
  const [columns, values] = kind === 'map'
    ? [['name', 'blocks', 'groups'], [value.name, JSON.stringify((value as MapValue).blocks), JSON.stringify((value as MapValue).groups)]]
    : [['name', 'lng', 'lat'], [value.name, (value as PlaceValue).lng, (value as PlaceValue).lat]];
  const table = TABLES[kind];
  const sql = current === null
    ? `insert into ${table} (id, ${columns.join(', ')}) values ($1, $2, $3, $4) returning version`
    : `update ${table} set ${columns.map((c, i) => `${c} = $${i + 2}`).join(', ')}, version = version + 1, updated_at = now() where id = $1 returning version`;
  const { rows } = await client.query<{ version: number }>(sql, [id, ...values]);
  return rows[0].version;
}
