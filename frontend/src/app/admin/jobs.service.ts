import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Job, JobRun } from './jobs';
import { JobsApi, JobsApiError } from './jobs-api';
import { JobsSimulation } from './jobs-simulation';

/** How often the open dialog asks the backend for news. */
const POLL_MS = 2000;

/**
 * - live: the backend's jobs.
 * - preview: no backend, so the runs are simulated.
 * - unavailable: the backend answered but cannot show the jobs, e.g. without a database.
 */
export type JobsMode = 'loading' | 'live' | 'preview' | 'unavailable';

/** The newest run per job, of the runs that pass the test. */
function newestBy(runs: JobRun[], test: (run: JobRun) => boolean): Map<string, JobRun> {
  const newest = new Map<string, JobRun>();
  for (const run of runs) {
    if (!test(run)) continue;
    const current = newest.get(run.jobId);
    if (!current || run.startedAt > current.startedAt) newest.set(run.jobId, run);
  }
  return newest;
}

/**
 * The data jobs and their runs, as the jobs dialog shows them. With a backend they are the real
 * jobs, read and started through its API. Without one, as on the artifact host, they are a
 * simulated preview.
 */
@Injectable({ providedIn: 'root' })
export class JobsService {
  private readonly api = inject(JobsApi);
  readonly mode = signal<JobsMode>('loading');
  /** Why the jobs cannot be shown, or why the last action failed. */
  readonly problem = signal<string | null>(null);
  private problemFrom: 'refresh' | 'action' | null = null;
  private readonly live = signal<{ jobs: Job[]; runs: JobRun[] }>({ jobs: [], runs: [] });
  private readonly liveNow = signal(new Date());
  private simulation: JobsSimulation | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private connecting: Promise<void> | null = null;

  readonly jobs = computed(() => (this.mode() === 'preview' ? this.simulation!.jobs() : this.live().jobs));
  readonly runs = computed(() => (this.mode() === 'preview' ? this.simulation!.runs() : this.live().runs));
  /** The clock the dialog shows relative times against. */
  readonly now = computed(() => (this.mode() === 'preview' ? this.simulation!.now() : this.liveNow()));
  /** The latest run per job, finished or not. */
  readonly latest = computed(() => newestBy(this.runs(), () => true));
  /** The latest finished run per job. */
  readonly lastFinished = computed(() => newestBy(this.runs(), (r) => !!r.finishedAt));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.disconnect();
      this.simulation?.destroy();
    });
  }

  /** Start showing the jobs, and keep them fresh until disconnect(). */
  connect(): Promise<void> {
    this.connecting ??= this.refresh().then(() => {
      if (this.mode() !== 'preview' && !this.poll) this.poll = setInterval(() => void this.refresh(), POLL_MS);
    });
    return this.connecting;
  }

  disconnect(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.connecting = null;
  }

  /** Read the jobs and runs from the backend, or switch to the preview when there is none. */
  async refresh(): Promise<void> {
    if (this.mode() === 'preview') return;
    try {
      this.live.set(await this.api.list());
      this.liveNow.set(new Date());
      this.mode.set('live');
      if (this.problemFrom === 'refresh') this.setProblem(null, null);
    } catch (error) {
      if (!(error instanceof JobsApiError)) throw error;
      if (error.noBackend && this.mode() === 'loading') {
        this.simulation = new JobsSimulation();
        this.mode.set('preview');
        return;
      }
      // A backend that answered before keeps its jobs on screen, with the reason it stopped answering
      if (this.mode() === 'loading') this.mode.set('unavailable');
      this.setProblem(error.message, 'refresh');
    }
  }

  next(job: Job): Date | null {
    if (this.mode() === 'preview') return this.simulation!.next(job);
    return job.nextRun ? new Date(job.nextRun) : null;
  }

  isActive(jobId: string): boolean {
    const run = this.latest().get(jobId);
    return run?.status === 'running' || run?.status === 'queued';
  }

  runNow(jobId: string): void {
    if (this.mode() === 'preview') this.simulation!.runNow(jobId);
    else void this.act(() => this.api.run(jobId));
  }

  setEnabled(jobId: string, enabled: boolean): void {
    if (this.mode() === 'preview') this.simulation!.setEnabled(jobId, enabled);
    else void this.act(() => this.api.setEnabled(jobId, enabled));
  }

  cancel(runId: string): void {
    if (this.mode() === 'preview') this.simulation!.cancel(runId);
    else void this.act(() => this.api.cancel(runId));
  }

  private async act(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      if (this.problemFrom === 'action') this.setProblem(null, null);
    } catch (error) {
      if (!(error instanceof JobsApiError)) throw error;
      this.setProblem(error.message, 'action');
    }
    await this.refresh();
  }

  private setProblem(problem: string | null, from: 'refresh' | 'action' | null): void {
    this.problem.set(problem);
    this.problemFrom = from;
  }
}
