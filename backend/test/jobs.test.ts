import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import type { Job, JobDefinition, JobRun } from '../src/jobs/types.ts';
import { createTestDatabase, describeWithDatabase } from './database.ts';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Jobs that show what the runner does, without fetching anything. */
const TEST_JOBS: JobDefinition[] = [
  {
    id: 'quick', name: 'Quick', kind: 'fetch', source: 'Test', description: 'Finishes at once.', schedule: '0 3 * * *', enabledByDefault: true, then: ['follow'],
    run: async (context) => {
      await context.log('Fetching');
      await context.progress(0.5);
      return { result: '3 things', bytes: 42 };
    },
  },
  { id: 'follow', name: 'Follow', kind: 'build', source: 'Test', description: 'Runs after Quick.', schedule: '0 4 * * *', enabledByDefault: true, run: async () => ({ result: 'built' }) },
  {
    id: 'slow', name: 'Slow', kind: 'build', source: 'Test', description: 'Runs until it is cancelled.', schedule: '0 5 * * *', enabledByDefault: true,
    run: async (context) => {
      for (let i = 0; i < 200 && !context.signal.aborted; i++) await wait(50);
      if (context.signal.aborted) throw new Error('Stopped');
    },
  },
  { id: 'broken', name: 'Broken', kind: 'fetch', source: 'Test', description: 'Always fails.', schedule: '0 6 * * *', enabledByDefault: true, run: async () => { throw new Error('The source answered 404'); } },
  { id: 'locked', name: 'Locked', kind: 'fetch', source: 'Test', description: 'Needs a key.', schedule: '0 7 * * *', enabledByDefault: false, blocked: 'Needs an API key' },
];

describeWithDatabase('the jobs API', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: FastifyInstance;

  const list = async () => (await app.inject('/api/jobs')).json() as { jobs: Job[]; runs: JobRun[] };
  const runOf = async (id: string) => (await list()).runs.find((r) => r.id === id)!;
  async function until(runId: string, statuses: string[], timeout = 15_000): Promise<JobRun> {
    const end = Date.now() + timeout;
    for (;;) {
      const run = await runOf(runId);
      if (statuses.includes(run.status)) return run;
      if (Date.now() > end) throw new Error(`Run ${runId} is still ${run.status}`);
      await wait(100);
    }
  }
  const start = async (jobId: string) => app.inject({ method: 'POST', url: `/api/jobs/${jobId}/run` });

  beforeAll(async () => {
    database = await createTestDatabase();
    // A run left behind by an app that stopped, before the jobs table exists: the app migrates first
    const setup = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, databaseUrl: database.url, version: null, logLevel: false, jobs: TEST_JOBS, jobPollSeconds: 0.5 });
    await setup.db!.query(`insert into job_run (job_id, trigger, status) values ('quick', 'manual', 'running')`);
    await setup.close();
    app = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, databaseUrl: database.url, version: null, logLevel: false, jobs: TEST_JOBS, jobPollSeconds: 0.5, timeZone: 'UTC' });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await database?.drop();
  });

  it('marks a run that was going on when the app stopped as failed', async () => {
    const [left] = (await list()).runs;
    expect(left).toMatchObject({ jobId: 'quick', status: 'failed', message: 'The app stopped while the job ran' });
  });

  it('lists the jobs with their schedules, and which can run', async () => {
    const { jobs } = await list();
    expect(jobs.map((j) => [j.id, j.enabled, j.blocked ?? null])).toEqual([
      ['quick', true, null], ['follow', true, null], ['slow', true, null], ['broken', true, null], ['locked', false, 'Needs an API key'],
    ]);
    expect(jobs[0]).toEqual({
      id: 'quick', name: 'Quick', kind: 'fetch', source: 'Test', description: 'Finishes at once.', schedule: '0 3 * * *', enabled: true, then: ['follow'],
      nextRun: expect.stringMatching(/T03:00:00\.000Z$/),
    });
    expect(jobs[4].nextRun).toBeUndefined();
    const schedules = await app.db!.query<{ name: string; timezone: string }>('select name, timezone from pgboss.schedule order by name');
    expect(schedules.rows).toEqual(['broken', 'follow', 'quick', 'slow'].map((name) => ({ name, timezone: 'UTC' })));
  });

  it('runs a job now, logs it, and then starts the job after it', async () => {
    const response = await start('quick');
    expect(response.statusCode).toBe(202);
    const queued = response.json().run as JobRun;
    expect(queued).toMatchObject({ jobId: 'quick', trigger: 'manual', status: 'queued' });
    const done = await until(queued.id, ['succeeded', 'failed']);
    expect(done).toMatchObject({ status: 'succeeded', result: '3 things', bytes: 42 });
    expect(done.finishedAt).toBeDefined();
    expect(done.log.map((l) => l.text)).toEqual(['Queued', 'Started', 'Fetching', 'Done: 3 things']);
    await wait(300);
    const follow = (await list()).runs.find((r) => r.jobId === 'follow')!;
    expect(follow.trigger).toBe('after');
    expect((await until(follow.id, ['succeeded'])).result).toBe('built');
  });

  it('records why a job failed', async () => {
    const run = (await start('broken')).json().run as JobRun;
    const done = await until(run.id, ['succeeded', 'failed']);
    expect(done).toMatchObject({ status: 'failed', message: 'The source answered 404' });
    expect(done.log.at(-1)).toMatchObject({ level: 'error', text: 'The source answered 404' });
  });

  it('cancels a running job, and does not start one that is already running', async () => {
    const run = (await start('slow')).json().run as JobRun;
    await until(run.id, ['running']);
    const again = await start('slow');
    expect(again.statusCode).toBe(409);
    expect(again.json().message).toBe('Slow is already running');
    const cancel = await app.inject({ method: 'POST', url: `/api/runs/${run.id}/cancel` });
    expect(cancel.statusCode).toBe(200);
    expect(await until(run.id, ['cancelled', 'failed', 'succeeded'])).toMatchObject({ status: 'cancelled', message: 'Cancelled by the user' });
    expect((await app.inject({ method: 'POST', url: `/api/runs/${run.id}/cancel` })).statusCode).toBe(409);
  });

  it('switches a schedule off and on, and refuses to run a job that is off', async () => {
    const off = await app.inject({ method: 'PATCH', url: '/api/jobs/quick', payload: { enabled: false } });
    expect(off.json().job).toMatchObject({ id: 'quick', enabled: false });
    expect((await app.db!.query(`select 1 from pgboss.schedule where name = 'quick'`)).rowCount).toBe(0);
    const refused = await start('quick');
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ statusCode: 409, error: 'Conflict', message: 'Quick is switched off' });
    await app.inject({ method: 'PATCH', url: '/api/jobs/quick', payload: { enabled: true } });
    expect((await list()).jobs[0].enabled).toBe(true);
    expect((await app.db!.query(`select 1 from pgboss.schedule where name = 'quick'`)).rowCount).toBe(1);
  });

  it('refuses blocked and unknown jobs, and wrong requests', async () => {
    expect((await start('locked')).json()).toEqual({ statusCode: 409, error: 'Conflict', message: 'Needs an API key' });
    expect((await start('nothing')).json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'There is no job called "nothing"' });
    const bad = await app.inject({ method: 'PATCH', url: '/api/jobs/quick', payload: { enabled: 'yes' } });
    expect(bad.statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/runs/abc/cancel' })).statusCode).toBe(400);
  });
});

it('says the jobs need the database when there is none', async () => {
  const app = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, databaseUrl: null, version: null, logLevel: false });
  expect((await app.inject('/api/jobs')).json()).toEqual({ statusCode: 503, error: 'Service Unavailable', message: 'The data jobs need the database. Set DATABASE_URL.' });
  await app.close();
});
