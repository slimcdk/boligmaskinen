import { computed, signal } from '@angular/core';
import { nextRun } from './cron';
import { Job, JobRun, JOBS, seedRuns } from './jobs';

/** How long a simulated run takes. */
const SIMULATED_MS = 3000;
const TICK_MS = 250;

/**
 * The data jobs as a preview without a backend, as on the artifact host: "Run now" starts a run
 * that progresses for a few seconds, succeeds, and then starts the jobs after it. JobsService
 * uses it when no backend answers.
 */
export class JobsSimulation {
  readonly jobs = signal<Job[]>(JOBS.map((j) => ({ ...j })));
  readonly runs = signal<JobRun[]>(seedRuns());
  /** The clock the page shows relative times against; it ticks while the page is open. */
  readonly now = signal(new Date());
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly clock = setInterval(() => this.now.set(new Date()), 15_000);

  destroy(): void {
    clearInterval(this.clock);
    for (const timer of this.timers.values()) clearInterval(timer);
  }

  /** The latest run per job, and whether one is going now. */
  readonly latest = computed(() => {
    const latest = new Map<string, JobRun>();
    for (const run of this.runs()) {
      const current = latest.get(run.jobId);
      if (!current || run.startedAt > current.startedAt) latest.set(run.jobId, run);
    }
    return latest;
  });

  /** The latest finished run per job. */
  readonly lastFinished = computed(() => {
    const done = new Map<string, JobRun>();
    for (const run of this.runs()) {
      if (!run.finishedAt) continue;
      const current = done.get(run.jobId);
      if (!current || run.startedAt > current.startedAt) done.set(run.jobId, run);
    }
    return done;
  });

  next(job: Job): Date | null {
    return job.enabled && !job.blocked ? nextRun(job.schedule, this.now()) : null;
  }

  isActive(jobId: string): boolean {
    const run = this.latest().get(jobId);
    return run?.status === 'running' || run?.status === 'queued';
  }

  /** Start a job now. Blocked, disabled and already running jobs are left alone. */
  runNow(jobId: string, trigger: JobRun['trigger'] = 'manual'): JobRun | null {
    const job = this.jobs().find((j) => j.id === jobId);
    if (!job || job.blocked || !job.enabled || this.isActive(jobId)) return null;
    const started = new Date();
    const run: JobRun = {
      id: `${jobId}-${started.getTime()}`, jobId, trigger, status: 'running', progress: 0,
      startedAt: started.toISOString(),
      log: [{ at: started.toISOString(), level: 'info', text: trigger === 'after' ? 'Started after the jobs before it' : 'Started' }],
    };
    this.runs.update((list) => [run, ...list]);
    const timer = setInterval(() => this.advance(run.id), TICK_MS);
    this.timers.set(run.id, timer);
    return run;
  }

  cancel(runId: string): void {
    this.finish(runId, 'cancelled', 'Cancelled by the user');
  }

  setEnabled(jobId: string, enabled: boolean): void {
    this.jobs.update((list) => list.map((j) => (j.id === jobId ? { ...j, enabled } : j)));
  }

  private advance(runId: string): void {
    const run = this.runs().find((r) => r.id === runId);
    if (!run || run.status !== 'running') return;
    const progress = Math.min(1, (run.progress ?? 0) + TICK_MS / SIMULATED_MS);
    const step = progress >= 1 ? 'Done' : progress >= 0.66 ? 'Checking and loading into the database' : progress >= 0.33 ? 'Downloading' : 'Looking for changes';
    const log = run.log.at(-1)?.text === step ? run.log : [...run.log, { at: new Date().toISOString(), level: 'info' as const, text: step }];
    this.update(runId, { progress, log });
    if (progress >= 1) {
      this.finish(runId, 'succeeded');
      const job = this.jobs().find((j) => j.id === run.jobId);
      for (const id of job?.then ?? []) this.runNow(id, 'after');
    }
  }

  private finish(runId: string, status: JobRun['status'], message?: string): void {
    clearInterval(this.timers.get(runId));
    this.timers.delete(runId);
    const at = new Date().toISOString();
    const run = this.runs().find((r) => r.id === runId);
    if (!run || (run.status !== 'running' && run.status !== 'queued')) return;
    const previous = this.lastFinished().get(run.jobId);
    this.update(runId, {
      status, finishedAt: at, progress: undefined, message,
      // A simulated run reports what the previous real run fetched
      bytes: status === 'succeeded' ? previous?.bytes : undefined,
      result: status === 'succeeded' ? previous?.result ?? 'Simulated run' : undefined,
      log: message ? [...run.log, { at, level: 'warn', text: message }] : run.log,
    });
  }

  private update(runId: string, patch: Partial<JobRun>): void {
    // Keep the clock in step with the runs, so a run that just ended reads "just now"
    this.now.set(new Date());
    this.runs.update((list) => list.map((r) => (r.id === runId ? { ...r, ...patch } : r)));
  }
}
