/**
 * The jobs that fetch and build the data, and their runs: the shapes the jobs API serves. The
 * frontend has the same shapes in frontend/src/app/admin/jobs.ts.
 */

export interface Job {
  id: string;
  name: string;
  kind: 'fetch' | 'build' | 'check';
  /** Who provides the data, e.g. "Geofabrik". */
  source: string;
  description: string;
  /** Cron expression in the instance's time zone: minute hour day-of-month month day-of-week. */
  schedule: string;
  enabled: boolean;
  /** Why the job cannot run, e.g. a missing API key. */
  blocked?: string;
  /** True when the job is planned but not built yet; `blocked` says when it comes. */
  planned?: boolean;
  /** Jobs that start when this one has succeeded. */
  then?: string[];
  /** When the schedule starts it next, for a job that is on. */
  nextRun?: string;
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type Trigger = 'schedule' | 'manual' | 'after';

export interface LogLine {
  at: string;
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface JobRun {
  id: string;
  jobId: string;
  trigger: Trigger;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  /** 0–1 while running. */
  progress?: number;
  bytes?: number;
  /** What was fetched or built, e.g. "6,250 polygons". */
  result?: string;
  message?: string;
  log: LogLine[];
}

/** What a job gets while it runs. */
export interface JobContext {
  log(text: string, level?: LogLine['level']): Promise<void>;
  /** 0–1. */
  progress(fraction: number): Promise<void>;
  /** Aborts when the run is cancelled; a job checks it between steps. */
  signal: AbortSignal;
  /** Where the app's data lives. */
  dataPackDir: string | null;
}

export interface JobOutcome {
  result?: string;
  bytes?: number;
}

/** A job as the backend defines it: what the API shows, and the work it does. */
export interface JobDefinition extends Omit<Job, 'enabled'> {
  /** Whether the schedule is on until the admin changes it. */
  enabledByDefault: boolean;
  /** The work; missing while the job is planned or blocked. */
  run?: (context: JobContext) => Promise<JobOutcome | void>;
}
