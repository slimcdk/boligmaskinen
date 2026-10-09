import type { ProfileChange } from '@boligmaskinen/engine';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { apiError, HttpError } from '../errors.ts';
import { loadProfile, saveChanges } from '../profile/store.ts';

// Ids are made by the devices (newId in the engine, or a UUID from older versions)
const id = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,100}$' } as const;
const name = { type: 'string', minLength: 1, maxLength: 200 } as const;

// The fields the app relies on are checked; a block may carry more, which is kept as it is
const block = {
  type: 'object',
  required: ['id', 'name', 'code', 'role', 'weight'],
  properties: {
    id, name: { type: 'string', maxLength: 200 }, code: { type: 'string', maxLength: 20_000 }, role: { enum: ['want', 'must'] },
    weight: { type: 'number', minimum: 0, maximum: 100 }, template: { type: 'string', maxLength: 200 }, language: { type: 'integer', minimum: 1 },
    group: id, enabled: { type: 'boolean' },
  },
} as const;
const group = {
  type: 'object',
  required: ['id', 'name', 'enabled'],
  properties: { id, name, enabled: { type: 'boolean' }, collapsed: { type: 'boolean' } },
} as const;
const mapValue = {
  type: 'object',
  required: ['name', 'blocks', 'groups'],
  properties: { name, blocks: { type: 'array', maxItems: 500, items: block }, groups: { type: 'array', maxItems: 500, items: group } },
} as const;
const placeValue = {
  type: 'object',
  required: ['name', 'lng', 'lat'],
  properties: { name, lng: { type: 'number', minimum: -180, maximum: 180 }, lat: { type: 'number', minimum: -90, maximum: 90 } },
} as const;
const changes = {
  type: 'object',
  required: ['changes'],
  additionalProperties: false,
  properties: {
    changes: {
      type: 'array',
      maxItems: 1000,
      items: {
        type: 'object',
        required: ['kind', 'id', 'base', 'value'],
        properties: { kind: { enum: ['map', 'place'] }, id, base: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] } },
        if: { properties: { kind: { const: 'map' } } },
        then: { properties: { value: { anyOf: [{ type: 'null' }, mapValue] } } },
        else: { properties: { value: { anyOf: [{ type: 'null' }, placeValue] } } },
      },
    },
  },
} as const;

/** The user's maps and places (src/profile/store.ts). */
export async function profileRoutes(app: FastifyInstance, db: pg.Pool | null): Promise<void> {
  const database = (): pg.Pool => {
    if (!db) throw new HttpError(503, 'Saving maps on the server needs the database. Set DATABASE_URL.');
    return db;
  };

  // The ETag is the profile's epoch and revision, so asking again costs little when nothing changed
  app.get('/api/profile', async (request, reply) => {
    const profile = await loadProfile(database());
    const etag = `"${profile.epoch}-${profile.revision}"`;
    reply.header('etag', etag).header('cache-control', 'no-cache');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return profile;
  });

  app.post<{ Body: { changes: ProfileChange[] } }>('/api/profile/changes', { schema: { body: changes } }, async (request, reply) => {
    const seen = new Set<string>();
    for (const change of request.body.changes) {
      const key = `${change.kind}:${change.id}`;
      if (seen.has(key)) throw new HttpError(400, `The ${change.kind} ${change.id} is changed twice; send each map and place once`);
      seen.add(key);
    }
    const result = await saveChanges(database(), request.body.changes);
    if ('conflicts' in result) {
      return reply.code(409).send({ ...apiError(409, 'Another device changed some of these first. Nothing was saved.'), conflicts: result.conflicts });
    }
    return result;
  });
}
