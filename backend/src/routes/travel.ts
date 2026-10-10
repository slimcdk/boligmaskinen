import type { FastifyInstance } from 'fastify';
import { basename, dirname } from 'node:path';
import { HttpError } from '../errors.ts';
import { TRAVEL_MODES, type TravelMode, type TravelState, type TravelTimes } from '../pipeline/travel.ts';

const position = {
  type: 'object', required: ['lng', 'lat'], additionalProperties: false,
  properties: { lng: { type: 'number', minimum: -180, maximum: 180 }, lat: { type: 'number', minimum: -90, maximum: 90 } },
} as const;
const fileParams = {
  type: 'object', required: ['id', 'mode'],
  properties: { id: { type: 'string', pattern: '^[0-9a-f]{24}$' }, mode: { type: 'string', enum: [...TRAVEL_MODES] } },
} as const;

/**
 * Travel times to a place on the road network. The frontend asks with the place's position until
 * they are ready, then loads each mode's layer, a byte container like the data pack's layers. A
 * layer's path names the pack and network it was found on, so it never changes.
 */
export async function travelRoutes(app: FastifyInstance, travel: TravelTimes | null): Promise<void> {
  app.post<{ Body: { lng: number; lat: number } }>('/api/travel', { schema: { body: position } }, async (request): Promise<TravelState> => {
    if (!travel) return { id: '', state: 'unavailable', message: 'Travel times are found by the data jobs, which need DATA_DIR' };
    return travel.request(request.body.lng, request.body.lat);
  });
  app.get<{ Params: { id: string; mode: TravelMode } }>('/api/travel/:id/:mode', { schema: { params: fileParams } }, async (request, reply) => {
    const file = travel && (await travel.file(request.params.id, request.params.mode));
    if (!file) throw new HttpError(404, `There are no travel times ${request.params.id}: ask for them again`);
    return reply.sendFile(basename(file), dirname(file), { maxAge: '365d', immutable: true });
  });
}
