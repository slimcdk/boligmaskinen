import type { FastifyInstance } from 'fastify';
import { HttpError } from '../errors.ts';
import type { JobRunner } from '../jobs/runner.ts';

const jobParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-z0-9-]+$' } } } as const;
const runParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[0-9]+$' } } } as const;

/** The jobs API, which the data-jobs dialog uses. */
export async function jobRoutes(app: FastifyInstance, runner: JobRunner | null): Promise<void> {
  const jobs = (): JobRunner => {
    if (!runner) throw new HttpError(503, 'The data jobs need the database. Set DATABASE_URL.');
    return runner;
  };

  app.get('/api/jobs', async () => {
    const [list, runs] = await Promise.all([jobs().jobs(), jobs().runs()]);
    return { jobs: list, runs };
  });

  app.post<{ Params: { id: string } }>('/api/jobs/:id/run', { schema: { params: jobParams } }, async (request, reply) => {
    return reply.code(202).send({ run: await jobs().runNow(request.params.id) });
  });

  app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>('/api/jobs/:id', {
    schema: { params: jobParams, body: { type: 'object', required: ['enabled'], additionalProperties: false, properties: { enabled: { type: 'boolean' } } } },
  }, async (request) => ({ job: await jobs().setEnabled(request.params.id, request.body.enabled) }));

  app.post<{ Params: { id: string } }>('/api/runs/:id/cancel', { schema: { params: runParams } }, async (request) => {
    return { run: await jobs().cancel(request.params.id) };
  });
}
