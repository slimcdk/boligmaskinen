import type { FastifyInstance } from 'fastify';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from '../errors.ts';

const packParams = {
  type: 'object', required: ['id', '*'],
  properties: { id: { type: 'string', pattern: '^[0-9]{8}T[0-9]{6}Z-[a-z0-9-]+$' }, '*': { type: 'string' } },
} as const;

/**
 * The data pack the map loads: the current one at /data-pack/, and every pack still kept at
 * /data-packs/<id>/ (without DATA_DIR, only the current one, by the id its meta.json gives). The current one is looked up once per request, so a file comes whole from
 * one pack while the jobs switch to the next. A pack's own path never changes, so its files may be
 * cached for good; the frontend reads meta.json from /data-pack/ and the rest from its pack.
 */
export async function dataPackRoutes(app: FastifyInstance, dataPackDir: string, packsDir: string | null): Promise<void> {
  app.get<{ Params: { '*': string } }>('/data-pack/*', async (request, reply) => {
    const root = await realpath(dataPackDir).catch(() => null);
    if (!root) throw new HttpError(404, 'There is no data pack yet: the data jobs build it');
    reply.header('cache-control', 'no-cache');
    return reply.sendFile(request.params['*'], root, { cacheControl: false });
  });
  /** The current pack's folder, when it is the pack with this id: a pack copied in names itself too. */
  const current = async (id: string): Promise<string | null> => {
    const root = await realpath(dataPackDir).catch(() => null);
    const meta = root ? await readFile(join(root, 'data', 'meta.json'), 'utf8').then((text) => JSON.parse(text) as { pack?: string }, () => null) : null;
    return meta?.pack === id ? root : null;
  };
  app.get<{ Params: { id: string; '*': string } }>('/data-packs/:id/*', { schema: { params: packParams } }, async (request, reply) => {
    const kept = packsDir ? join(packsDir, request.params.id) : null;
    const root = kept && (await stat(kept).then((s) => s.isDirectory(), () => false)) ? kept : await current(request.params.id);
    if (!root) throw new HttpError(404, `There is no data pack ${request.params.id}`);
    return reply.sendFile(request.params['*'], root, { maxAge: '365d', immutable: true });
  });
}
