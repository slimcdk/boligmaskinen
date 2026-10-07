import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsSimulation } from './jobs-simulation';

describe('JobsSimulation', () => {
  let jobs: JobsSimulation;

  beforeEach(() => {
    vi.useFakeTimers();
    jobs = new JobsSimulation();
  });

  afterEach(() => {
    jobs.destroy();
    vi.useRealTimers();
  });

  it('starts with the history of the pilot builds', () => {
    expect(jobs.lastFinished().get('osm')?.result).toBe('2,615,038 address points');
    expect(jobs.latest().get('ens')?.status).toBe('succeeded');
    expect(jobs.runs().some((r) => r.jobId === 'ens' && r.status === 'failed')).toBe(true);
  });

  it('runs a job, then the jobs after it', () => {
    const run = jobs.runNow('plandata')!;
    expect(run.status).toBe('running');
    expect(jobs.isActive('plandata')).toBe(true);
    expect(jobs.runNow('plandata')).toBeNull();
    vi.advanceTimersByTime(3500);
    const done = jobs.runs().find((r) => r.id === run.id)!;
    expect(done.status).toBe('succeeded');
    expect(done.result).toBe('6,250 polygons');
    expect(done.log.map((l) => l.text)).toEqual(['Started', 'Looking for changes', 'Downloading', 'Checking and loading into the database', 'Done']);
    expect(jobs.latest().get('grid')).toMatchObject({ status: 'running', trigger: 'after' });
  });

  it('does not run blocked or switched-off jobs', () => {
    expect(jobs.runNow('ejf')).toBeNull();
    jobs.setEnabled('osm', false);
    expect(jobs.runNow('osm')).toBeNull();
    expect(jobs.next(jobs.jobs().find((j) => j.id === 'osm')!)).toBeNull();
  });

  it('cancels a run', () => {
    const run = jobs.runNow('dst')!;
    jobs.cancel(run.id);
    vi.advanceTimersByTime(5000);
    expect(jobs.runs().find((r) => r.id === run.id)).toMatchObject({ status: 'cancelled', message: 'Cancelled by the user' });
    expect(jobs.runs().filter((r) => r.jobId === 'grid')).toHaveLength(1); // nothing started after it
  });
});
