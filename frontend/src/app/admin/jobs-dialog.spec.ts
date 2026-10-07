import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsDialog } from './jobs-dialog';
import { JobsService } from './jobs.service';

describe('JobsDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [JobsDialog] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(JobsDialog);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('lists the tasks with their schedule and last run', () => {
    const { element } = render();
    const rows = [...element.querySelectorAll('table.tasks tr.mat-mdc-row')];
    expect(rows).toHaveLength(14);
    const osm = rows.find((r) => r.textContent!.includes('OpenStreetMap'))!;
    expect(osm.textContent).toContain('Every day at 03:00');
    expect(osm.textContent).toContain('2,615,038 address points');
  });

  it('shows why a task cannot run yet, and does not let it run', () => {
    const { element } = render();
    const ejf = [...element.querySelectorAll('table.tasks tr.mat-mdc-row')].find((r) => r.textContent!.includes('Sale prices'))!;
    expect(ejf.textContent).toContain('Needs approval from Geodatastyrelsen');
    expect(ejf.querySelector<HTMLButtonElement>('button[aria-label="Run Sale prices now"]')!.disabled).toBe(true);
  });

  it('runs a task and shows its progress', () => {
    const { fixture, element } = render();
    element.querySelector<HTMLButtonElement>('button[aria-label="Run Planning zones now"]')!.click();
    fixture.detectChanges();
    expect(element.querySelector('mat-progress-bar[aria-label="Planning zones progress"]')).not.toBeNull();
    vi.advanceTimersByTime(3500);
    fixture.detectChanges();
    expect(TestBed.inject(JobsService).latest().get('plandata')?.status).toBe('succeeded');
  });

  it('opens the log of a run', () => {
    const { fixture, element } = render();
    element.querySelector<HTMLElement>('.history mat-expansion-panel-header')!.click();
    fixture.detectChanges();
    const failed = [...element.querySelectorAll<HTMLElement>('table.runs tr.mat-mdc-row')].find((r) => r.textContent!.includes('Failed'))!;
    failed.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="log"]')!.textContent).toContain('returned 404');
  });
});
