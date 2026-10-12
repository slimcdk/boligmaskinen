import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Job, JobRun } from './jobs';
import { JobsApi, JobsApiError } from './jobs-api';
import { JobsDialog } from './jobs-dialog';
import { JobsService } from './jobs.service';

/** What a static host answers: no jobs API, so the dialog shows the preview. */
class NoBackend {
  list = () => Promise.reject(new JobsApiError('No jobs API here (HTTP 200)', true));
}

async function render() {
  const fixture = TestBed.createComponent(JobsDialog);
  await TestBed.inject(JobsService).connect();
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('JobsDialog without a backend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [JobsDialog], providers: [{ provide: JobsApi, useClass: NoBackend }] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('says that the runs are a simulated preview', async () => {
    const { element } = await render();
    expect(element.querySelector('.head p')!.textContent).toBe('Preview without a backend: the runs are simulated');
  });

  it('lists the tasks with their schedule and last run', async () => {
    const { element } = await render();
    const rows = [...element.querySelectorAll('table.tasks tr.mat-mdc-row')];
    expect(rows).toHaveLength(23);
    const osm = rows.find((r) => r.textContent!.includes('OpenStreetMap'))!;
    expect(osm.textContent).toContain('Every day at 03:00');
    expect(osm.textContent).toContain('2,615,038 address points');
  });

  it('shows why a task cannot run yet, and does not let it run', async () => {
    const { element } = await render();
    const ejf = [...element.querySelectorAll('table.tasks tr.mat-mdc-row')].find((r) => r.textContent!.includes('Sale prices'))!;
    expect(ejf.textContent).toContain('Needs approval from Geodatastyrelsen');
    expect(ejf.querySelector<HTMLButtonElement>('button[aria-label="Run Sale prices now"]')!.disabled).toBe(true);
  });

  it('runs a task and shows its progress', async () => {
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('button[aria-label="Run Planning zones now"]')!.click();
    fixture.detectChanges();
    expect(element.querySelector('mat-progress-bar[aria-label="Planning zones progress"]')).not.toBeNull();
    vi.advanceTimersByTime(3500);
    fixture.detectChanges();
    expect(TestBed.inject(JobsService).latest().get('plandata')?.status).toBe('succeeded');
  });

  it('shows only the tasks a filter picks, and all of them again without one', async () => {
    const { fixture, element } = await render();
    const rows = () => [...element.querySelectorAll('table.tasks tr.mat-mdc-row:not(.none)')];
    const all = rows().length;
    const chip = [...element.querySelectorAll<HTMLElement>('mat-chip-option')].find((c) => c.textContent!.includes('Waiting for access'))!;
    const count = Number(/· (\d+)/.exec(chip.textContent!)![1]);
    expect(count).toBeGreaterThan(0);
    chip.querySelector<HTMLElement>('.mat-mdc-chip-action')!.click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(count);
    expect(rows().every((row) => row.querySelector('.blocked mat-icon')!.textContent === 'lock')).toBe(true);
    chip.querySelector<HTMLElement>('.mat-mdc-chip-action')!.click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(all);
    // A filter with nothing to show cannot be picked
    const failing = [...element.querySelectorAll<HTMLElement>('mat-chip-option')].find((c) => c.textContent!.includes('Failing'))!;
    expect(failing.textContent).toContain('Failing · 0');
    expect(failing.querySelector('.mat-mdc-chip-action')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('opens the log of a run', async () => {
    const { fixture, element } = await render();
    [...element.querySelectorAll<HTMLElement>('.head [mat-tab-link]')].find((tab) => tab.textContent!.includes('Recent runs'))!.click();
    fixture.detectChanges();
    const failed = [...element.querySelectorAll<HTMLElement>('table.runs tr.mat-mdc-row')].find((r) => r.textContent!.includes('Failed'))!;
    failed.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="log"]')!.textContent).toContain('returned 404');
  });
});

/** A backend with one job that runs and one that is planned. */
class Backend {
  readonly calls: string[] = [];
  readonly runs: JobRun[] = [];
  readonly jobs: Job[] = [
    {
      id: 'data-pack', name: 'Check the data pack', kind: 'check', source: 'Boligmaskinen', description: 'Checks the data pack.',
      schedule: '0 7 * * *', enabled: true, nextRun: '2026-10-08T05:00:00.000Z',
    },
    {
      id: 'osm', name: 'OpenStreetMap', kind: 'fetch', source: 'Geofabrik', description: 'Denmark extract.', schedule: '0 3 * * *', enabled: false,
      planned: true, blocked: 'Not built yet: comes with milestone 2, the data pipeline as jobs',
    },
  ];

  list = async () => ({ jobs: structuredClone(this.jobs), runs: structuredClone(this.runs) });

  run = async (jobId: string) => {
    this.calls.push(`run ${jobId}`);
    const run: JobRun = { id: '1', jobId, trigger: 'manual', status: 'running', startedAt: new Date().toISOString(), progress: 0.4, log: [] };
    this.runs.unshift(run);
    return run;
  };
}

describe('JobsDialog with a backend', () => {
  let backend: Backend;

  beforeEach(() => {
    backend = new Backend();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [JobsDialog], providers: [{ provide: JobsApi, useValue: backend }] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows the server’s jobs, and which are not built yet', async () => {
    const { element } = await render();
    expect(element.querySelector('.head p')!.textContent).toBe('Fetching and building the data on this server');
    expect([...element.querySelectorAll('mat-chip-option')].map((c) => c.textContent!.trim())).toContain('Not built yet · 1');
    const osm = [...element.querySelectorAll('table.tasks tr.mat-mdc-row')].find((r) => r.textContent!.includes('OpenStreetMap'))!;
    expect(osm.querySelector('.blocked')!.textContent).toContain('construction');
    expect(osm.textContent).toContain('Not built yet');
  });

  it('runs a job through the API', async () => {
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('button[aria-label="Run Check the data pack now"]')!.click();
    await vi.waitFor(() => expect(TestBed.inject(JobsService).isActive('data-pack')).toBe(true));
    fixture.detectChanges();
    expect(backend.calls).toEqual(['run data-pack']);
    expect(element.querySelector('mat-progress-bar[aria-label="Check the data pack progress"]')).not.toBeNull();
  });
});
