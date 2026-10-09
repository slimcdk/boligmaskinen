import type pg from 'pg';
import type { JobContext, LogLine } from '../../src/jobs/types.ts';

/** A job's context as the runner gives it, with a run row of its own, and what the job logged. */
export async function runContext(db: pg.Pool, jobId = 'test'): Promise<{ context: JobContext; lines: LogLine[]; progress: number[]; cancel: () => void }> {
  const { rows: [run] } = await db.query<{ id: string }>(`insert into job_run (job_id, trigger, status) values ($1, 'manual', 'running') returning id`, [jobId]);
  const lines: LogLine[] = [];
  const progress: number[] = [];
  const controller = new AbortController();
  return {
    lines, progress, cancel: () => controller.abort(),
    context: {
      log: async (text, level = 'info') => { lines.push({ at: new Date().toISOString(), level, text }); },
      progress: async (fraction) => { progress.push(fraction); },
      signal: controller.signal,
      dataPackDir: null,
      db,
      runId: String(run.id),
      trigger: 'manual',
      busy: async () => [],
    },
  };
}
