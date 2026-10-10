import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18n, TRANSLATIONS } from '../i18n/i18n';
import { describeCron, ENGLISH_TIME, formatBytes, formatDuration, relativeTime, TimeWords } from './cron';
import { Job, JobRun } from './jobs';
import { JobsMode, JobsService } from './jobs.service';

/** What the tasks can be filtered by; their names are jobs.filter.<id> in the catalogues. */
type TaskFilter = 'failing' | 'running' | 'blocked' | 'planned';

const FILTERS: TaskFilter[] = ['failing', 'running', 'blocked', 'planned'];

const STATUS_ICON: Record<JobRun['status'], string> = {
  queued: 'schedule', running: 'progress_activity', succeeded: 'check_circle', failed: 'error', cancelled: 'cancel',
};

/**
 * The data jobs, like the task lists in Sonarr or Overseerr: how often they run, when next, and run
 * now. "Tasks" can be filtered by how they are; "Recent runs" has the results and logs.
 */
@Component({
  selector: 'app-jobs-dialog',
  imports: [
    MatButtonModule, MatChipsModule, MatDialogModule, MatIconModule, MatProgressBarModule, MatSlideToggleModule, MatTableModule,
    MatTabsModule, MatTooltipModule, TranslocoPipe,
  ],
  templateUrl: './jobs-dialog.html',
  styleUrl: './jobs-dialog.scss',
})
export class JobsDialog {
  protected readonly jobs = inject(JobsService);
  private readonly i18n = inject(I18n);
  protected readonly taskColumns = ['name', 'schedule', 'last', 'next', 'actions'];
  protected readonly runColumns = ['job', 'started', 'duration', 'result', 'status'];
  protected readonly selected = signal<string | null>(null);
  protected readonly subtitle = computed(() => this.i18n.t(`jobs.subtitle.${this.jobs.mode() satisfies JobsMode}`));
  /** Schedules and times in the language in use. */
  private readonly time = computed<TimeWords>(() => {
    const language = this.i18n.language();
    return language === 'en' ? ENGLISH_TIME : { ...ENGLISH_TIME, ...(TRANSLATIONS[language] as { time: Partial<TimeWords> }).time, locale: this.i18n.locale() };
  });

  constructor() {
    void this.jobs.connect();
    inject(DestroyRef).onDestroy(() => this.jobs.disconnect());
  }

  protected readonly names = computed(() => new Map(this.jobs.jobs().map((j) => [j.id, this.jobText(j, 'name')])));
  protected readonly history = computed(() => [...this.jobs.runs()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 30));
  protected readonly selectedRun = computed(() => this.jobs.runs().find((r) => r.id === this.selected()) ?? null);
  /** "Tasks" or "Recent runs". */
  protected readonly view = signal<'tasks' | 'runs'>('tasks');
  /** The filter picked above the tasks; none shows them all. */
  protected readonly filter = signal<TaskFilter | null>(null);

  /** Whether a task is as the filter says. */
  private readonly matches = computed(() => {
    const lastFinished = this.jobs.lastFinished();
    const running = new Set(this.jobs.runs().filter((r) => r.status === 'running').map((r) => r.jobId));
    return (job: Job, filter: TaskFilter): boolean => {
      switch (filter) {
        case 'failing': return lastFinished.get(job.id)?.status === 'failed';
        case 'running': return running.has(job.id);
        case 'blocked': return !!job.blocked && !job.planned;
        case 'planned': return !!job.planned;
      }
    };
  });

  protected readonly filters = computed(() => FILTERS.map((id) => ({ id, count: this.jobs.jobs().filter((job) => this.matches()(job, id)).length })));

  protected readonly shown = computed(() => {
    const filter = this.filter();
    return filter ? this.jobs.jobs().filter((job) => this.matches()(job, filter)) : this.jobs.jobs();
  });

  protected readonly none = computed(() => this.i18n.t(`jobs.none.${this.filter() ?? 'all'}`));

  /** A job's name or description: the server's English, or its Danish in da.json by the job's id. */
  protected jobText(job: Job, field: 'name' | 'description'): string {
    return this.i18n.lookup(`jobs.byId.${job.id}.${field}`) ?? job[field];
  }

  /** A text the server wrote, such as why a job is blocked, in Danish when it is a known one. */
  protected phrase(text: string): string {
    return this.i18n.phrase('errors', text) ?? text;
  }

  protected describe(schedule: string): string {
    return describeCron(schedule, this.time());
  }

  protected bytes(bytes: number): string {
    return formatBytes(bytes, this.time());
  }

  protected icon(status: JobRun['status']): string {
    return STATUS_ICON[status];
  }

  protected ago(iso: string | undefined): string {
    return iso ? relativeTime(new Date(iso), this.jobs.now(), this.time()) : '–';
  }

  protected when(job: Job): string {
    if (job.blocked) return this.i18n.t(job.planned ? 'jobs.notBuilt' : 'jobs.notScheduled');
    if (!job.enabled) return this.i18n.t('jobs.off');
    const next = this.jobs.next(job);
    return next ? relativeTime(next, this.jobs.now(), this.time()) : '–';
  }

  protected exact(iso: string | undefined): string {
    return iso ? new Date(iso).toLocaleString(this.time().locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  protected nextExact(job: Job): string {
    const next = this.jobs.next(job);
    return next ? next.toLocaleString(this.time().locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  protected duration(run: JobRun): string {
    if (!run.finishedAt) return run.status === 'running' ? `${Math.round((run.progress ?? 0) * 100)} %` : '–';
    return formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime(), this.time());
  }

  protected select(run: JobRun): void {
    this.selected.set(this.selected() === run.id ? null : run.id);
  }
}
