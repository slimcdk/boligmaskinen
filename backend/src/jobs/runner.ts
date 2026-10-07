import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';
import { CronExpressionParser } from 'cron-parser';
import { PgBoss } from 'pg-boss';
import { HttpError } from '../errors.ts';
import type { Job, JobContext, JobDefinition, JobOutcome, JobRun, LogLine, RunStatus, Trigger } from './types.ts';

interface RunRow {
  id: string;
  job_id: string;
  trigger: Trigger;
  status: RunStatus;
  queue_job_id: string | null;
  progress: number | null;
  started_at: Date;
  finished_at: Date | null;
  result: string | null;
  bytes: string | null;
  message: string | null;
  log: LogLine[];
}

interface QueuedData {
  /** The run row made by "Run now"; scheduled runs make theirs when they start. */
  runId?: string;
  trigger?: Trigger;
}

function toRun(row: RunRow): JobRun {
  return {
    id: String(row.id), jobId: row.job_id, trigger: row.trigger, status: row.status, startedAt: row.started_at.toISOString(),
    ...(row.finished_at ? { finishedAt: row.finished_at.toISOString() } : {}),
    ...(row.progress !== null ? { progress: row.progress } : {}),
    ...(row.bytes !== null ? { bytes: Number(row.bytes) } : {}),
    ...(row.result !== null ? { result: row.result } : {}),
    ...(row.message !== null ? { message: row.message } : {}),
    log: row.log,
  };
}

const line = (text: string, level: LogLine['level'] = 'info'): string => JSON.stringify([{ at: new Date().toISOString(), level, text }]);

export interface RunnerOptions {
  db: pg.Pool;
  databaseUrl: string;
  definitions: JobDefinition[];
  /** The time zone of the schedules. */
  timeZone: string;
  dataPackDir: string | null;
  log: FastifyBaseLogger;
  /** How often an idle worker asks the queue for work. */
  pollSeconds?: number;
}

/**
 * Runs the data jobs: on their schedules, when someone presses "Run now", and after the jobs
 * before them. pg-boss queues the work in PostgreSQL; job_run keeps every run and its log.
 */
export class JobRunner {
  private readonly options: RunnerOptions;
  private readonly boss: PgBoss;
  /** The runs going on in this process, to cancel them. */
  private readonly active = new Map<string, AbortController>();

  private constructor(options: RunnerOptions, boss: PgBoss) {
    this.options = options;
    this.boss = boss;
  }

  static async start(options: RunnerOptions): Promise<JobRunner> {
    const boss = new PgBoss({ connectionString: options.databaseUrl, schema: 'pgboss', max: 4, application_name: 'boligmaskinen-jobs' });
    boss.on('error', (error) => options.log.error({ err: error }, 'The job queue failed'));
    await boss.start();
    const runner = new JobRunner(options, boss);
    for (const job of options.definitions) {
      // One run at a time per job, none retried: a failed run shows in the jobs dialog instead
      await boss.createQueue(job.id, { policy: 'stately', retryLimit: 0, expireInSeconds: 6 * 3600 });
    }
    await runner.recover();
    for (const job of options.definitions) {
      if (!job.run) continue;
      await boss.work<QueuedData>(job.id, { pollingIntervalSeconds: options.pollSeconds ?? 2 }, async ([queued]) => runner.execute(job, queued.id, queued.data));
    }
    await runner.syncSchedules();
    return runner;
  }

  /** Runs that were going on when the app last stopped did not finish, so they failed. */
  private async recover(): Promise<void> {
    const { rowCount } = await this.options.db.query(
      `update job_run set status = 'failed', finished_at = now(), progress = null, message = $1, log = log || $2::jsonb where status in ('queued', 'running')`,
      ['The app stopped while the job ran', line('The app stopped while the job ran', 'error')],
    );
    if (rowCount) this.options.log.warn(`${rowCount} job run(s) did not finish before the app stopped`);
    for (const job of this.options.definitions) await this.boss.deleteQueuedJobs(job.id);
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 10_000 });
  }

  private definition(jobId: string): JobDefinition {
    const definition = this.options.definitions.find((d) => d.id === jobId);
    if (!definition) throw new HttpError(404, `There is no job called "${jobId}"`);
    return definition;
  }

  async jobs(): Promise<Job[]> {
    const { rows } = await this.options.db.query<{ job_id: string; enabled: boolean }>('select job_id, enabled from job_setting');
    const settings = new Map(rows.map((r) => [r.job_id, r.enabled]));
    return this.options.definitions.map(({ run, enabledByDefault, ...job }) => {
      const enabled = !job.blocked && (settings.get(job.id) ?? enabledByDefault);
      if (!enabled || !run) return { ...job, enabled };
      const nextRun = CronExpressionParser.parse(job.schedule, { tz: this.options.timeZone }).next().toISOString();
      return { ...job, enabled, nextRun: nextRun ?? undefined };
    });
  }

  /** The latest runs of every job, newest first, with their logs. */
  async runs(limit = 100): Promise<JobRun[]> {
    const { rows } = await this.options.db.query<RunRow>('select * from job_run order by started_at desc, id desc limit $1', [limit]);
    return rows.map(toRun);
  }

  private async run(runId: string): Promise<RunRow | undefined> {
    return (await this.options.db.query<RunRow>('select * from job_run where id = $1', [runId])).rows[0];
  }

  /** Start a job now. A job that is blocked, switched off or already running is refused. */
  async runNow(jobId: string, trigger: Trigger = 'manual'): Promise<JobRun> {
    const definition = this.definition(jobId);
    if (definition.blocked || !definition.run) throw new HttpError(409, definition.blocked ?? `${definition.name} cannot run yet`);
    const job = (await this.jobs()).find((j) => j.id === jobId)!;
    if (!job.enabled) throw new HttpError(409, `${job.name} is switched off`);
    const busy = await this.options.db.query(`select 1 from job_run where job_id = $1 and status in ('queued', 'running') limit 1`, [jobId]);
    if (busy.rowCount) throw new HttpError(409, `${job.name} is already running`);

    const { rows: [row] } = await this.options.db.query<RunRow>(
      `insert into job_run (job_id, trigger, status, log) values ($1, $2, 'queued', $3::jsonb) returning *`,
      [jobId, trigger, line(trigger === 'after' ? 'Queued after the job before it' : 'Queued')],
    );
    const queueJobId = await this.boss.send(jobId, { runId: String(row.id), trigger } satisfies QueuedData);
    if (!queueJobId) {
      await this.finish(String(row.id), 'cancelled', 'The queue already had a run of this job waiting');
      throw new HttpError(409, `${job.name} is already waiting to run`);
    }
    await this.options.db.query('update job_run set queue_job_id = $2 where id = $1', [row.id, queueJobId]);
    return toRun({ ...row, queue_job_id: queueJobId });
  }

  /** Stop a run: a waiting one at once, a running one at its next check. */
  async cancel(runId: string): Promise<JobRun> {
    const row = await this.run(runId);
    if (!row) throw new HttpError(404, `There is no run ${runId}`);
    if (row.status !== 'queued' && row.status !== 'running') throw new HttpError(409, 'The run has already finished');
    const controller = this.active.get(runId);
    if (controller) {
      controller.abort();
    } else {
      if (row.queue_job_id) await this.boss.cancel(row.job_id, row.queue_job_id).catch(() => undefined);
      await this.finish(runId, 'cancelled', 'Cancelled by the user');
    }
    return toRun((await this.run(runId))!);
  }

  /** Switch a job's schedule on or off. */
  async setEnabled(jobId: string, enabled: boolean): Promise<Job> {
    const definition = this.definition(jobId);
    if (definition.blocked) throw new HttpError(409, definition.blocked);
    await this.options.db.query(
      'insert into job_setting (job_id, enabled) values ($1, $2) on conflict (job_id) do update set enabled = excluded.enabled, updated_at = now()',
      [jobId, enabled],
    );
    await this.syncSchedules();
    return (await this.jobs()).find((j) => j.id === jobId)!;
  }

  private async syncSchedules(): Promise<void> {
    for (const job of await this.jobs()) {
      if (job.enabled && this.definition(job.id).run) {
        await this.boss.schedule(job.id, job.schedule, { trigger: 'schedule' } satisfies QueuedData, { tz: this.options.timeZone });
      } else {
        await this.boss.unschedule(job.id);
      }
    }
  }

  private async execute(definition: JobDefinition, queueJobId: string, data: QueuedData): Promise<void> {
    const db = this.options.db;
    let runId = data.runId;
    if (!runId) {
      const { rows: [row] } = await db.query<{ id: string }>(
        `insert into job_run (job_id, trigger, status, queue_job_id) values ($1, $2, 'queued', $3) returning id`,
        [definition.id, data.trigger ?? 'schedule', queueJobId],
      );
      runId = String(row.id);
    }
    // A run cancelled while it waited is not started
    if ((await this.run(runId))?.status !== 'queued') return;
    const id = runId;
    const controller = new AbortController();
    this.active.set(id, controller);
    await db.query(`update job_run set status = 'running', started_at = now(), progress = 0, log = log || $2::jsonb where id = $1`, [id, line('Started')]);
    const context: JobContext = {
      log: async (text, level = 'info') => {
        await db.query('update job_run set log = log || $2::jsonb where id = $1', [id, line(text, level)]);
      },
      progress: async (fraction) => {
        await db.query('update job_run set progress = $2 where id = $1', [id, Math.max(0, Math.min(1, fraction))]);
      },
      signal: controller.signal,
      dataPackDir: this.options.dataPackDir,
    };
    try {
      const outcome = (await definition.run!(context)) ?? {};
      if (controller.signal.aborted) throw new Error('Cancelled');
      await this.finish(id, 'succeeded', undefined, outcome);
    } catch (error) {
      if (controller.signal.aborted) await this.finish(id, 'cancelled', 'Cancelled by the user');
      else await this.finish(id, 'failed', (error as Error).message);
      return;
    } finally {
      this.active.delete(id);
    }
    for (const next of definition.then ?? []) {
      try {
        await this.runNow(next, 'after');
      } catch (error) {
        this.options.log.info(`${next} did not start after ${definition.id}: ${(error as Error).message}`);
      }
    }
  }

  private async finish(runId: string, status: RunStatus, message?: string, outcome: JobOutcome = {}): Promise<void> {
    const text = status === 'succeeded' ? (outcome.result ? `Done: ${outcome.result}` : 'Done') : message ?? status;
    await this.options.db.query(
      `update job_run set status = $2, finished_at = now(), progress = null, message = $3, result = $4, bytes = $5, log = log || $6::jsonb
       where id = $1 and status in ('queued', 'running')`,
      [runId, status, message ?? null, outcome.result ?? null, outcome.bytes ?? null, line(text, status === 'succeeded' ? 'info' : status === 'cancelled' ? 'warn' : 'error')],
    );
  }
}
