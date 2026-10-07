import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { describeCron, formatBytes, formatDuration, relativeTime } from './cron';
import { Job, JobRun } from './jobs';
import { JobsMode, JobsService } from './jobs.service';

const SUBTITLE: Record<JobsMode, string> = {
  loading: 'Reading the jobs…',
  live: 'Fetching and building the data on this server',
  preview: 'Preview without a backend: the runs are simulated',
  unavailable: 'The jobs cannot be shown',
};

const STATUS_ICON: Record<JobRun['status'], string> = {
  queued: 'schedule', running: 'progress_activity', succeeded: 'check_circle', failed: 'error', cancelled: 'cancel',
};

/** The data jobs, like the task lists in Sonarr or Overseerr: how often they run, when next, and run now. */
@Component({
  selector: 'app-jobs-dialog',
  imports: [
    MatButtonModule, MatChipsModule, MatDialogModule, MatExpansionModule, MatIconModule, MatProgressBarModule, MatSlideToggleModule,
    MatTableModule, MatTooltipModule,
  ],
  templateUrl: './jobs-dialog.html',
  styleUrl: './jobs-dialog.scss',
})
export class JobsDialog {
  protected readonly jobs = inject(JobsService);
  protected readonly taskColumns = ['name', 'schedule', 'last', 'next', 'actions'];
  protected readonly runColumns = ['job', 'started', 'duration', 'result', 'status'];
  protected readonly selected = signal<string | null>(null);
  protected readonly subtitle = computed(() => SUBTITLE[this.jobs.mode()]);

  constructor() {
    void this.jobs.connect();
    inject(DestroyRef).onDestroy(() => this.jobs.disconnect());
  }

  protected readonly names = computed(() => new Map(this.jobs.jobs().map((j) => [j.id, j.name])));
  protected readonly history = computed(() => [...this.jobs.runs()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 30));
  protected readonly selectedRun = computed(() => this.jobs.runs().find((r) => r.id === this.selected()) ?? null);
  protected readonly counts = computed(() => {
    const latest = [...this.jobs.lastFinished().values()];
    return {
      failing: latest.filter((r) => r.status === 'failed').length,
      running: this.jobs.runs().filter((r) => r.status === 'running').length,
      blocked: this.jobs.jobs().filter((j) => j.blocked && !j.planned).length,
      planned: this.jobs.jobs().filter((j) => j.planned).length,
    };
  });

  protected describe = describeCron;
  protected bytes = formatBytes;

  protected icon(status: JobRun['status']): string {
    return STATUS_ICON[status];
  }

  protected statusLabel(status: JobRun['status']): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  protected ago(iso: string | undefined): string {
    return iso ? relativeTime(new Date(iso), this.jobs.now()) : '–';
  }

  protected when(job: Job): string {
    if (job.blocked) return job.planned ? 'Not built yet' : 'Not scheduled';
    if (!job.enabled) return 'Off';
    const next = this.jobs.next(job);
    return next ? relativeTime(next, this.jobs.now()) : '–';
  }

  protected exact(iso: string | undefined): string {
    return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  protected nextExact(job: Job): string {
    const next = this.jobs.next(job);
    return next ? next.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  protected duration(run: JobRun): string {
    if (!run.finishedAt) return run.status === 'running' ? `${Math.round((run.progress ?? 0) * 100)} %` : '–';
    return formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime());
  }

  protected select(run: JobRun): void {
    this.selected.set(this.selected() === run.id ? null : run.id);
  }
}
