import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Job, JobRun } from './jobs';
import { JobsApi, JobsApiError } from './jobs-api';
import { JobsService } from './jobs.service';

const JOB: Job = {
  id: 'data-pack', name: 'Check the data pack', kind: 'check', source: 'Boligmaskinen', description: 'Checks the data pack.',
  schedule: '0 7 * * *', enabled: true, nextRun: '2026-10-08T05:00:00.000Z',
};

/** A stand-in for the backend whose answers each test sets. */
class Api {
  list = vi.fn<() => Promise<{ jobs: Job[]; runs: JobRun[] }>>(async () => ({ jobs: [JOB], runs: [] }));
  run = vi.fn<(jobId: string) => Promise<JobRun>>();
  setEnabled = vi.fn<(jobId: string, enabled: boolean) => Promise<Job>>(async () => JOB);
  cancel = vi.fn<(runId: string) => Promise<JobRun>>();
}

describe('JobsService', () => {
  let api: Api;
  let jobs: JobsService;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new Api();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: JobsApi, useValue: api }] });
    jobs = TestBed.inject(JobsService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('shows the simulated preview when there is no backend', async () => {
    api.list.mockRejectedValue(new JobsApiError('No jobs API here (HTTP 200)', true));
    await jobs.connect();
    expect(jobs.mode()).toBe('preview');
    expect(jobs.lastFinished().get('osm')?.result).toBe('2,615,038 address points');
    jobs.runNow('plandata');
    expect(jobs.isActive('plandata')).toBe(true);
    expect(api.run).not.toHaveBeenCalled();
  });

  it('shows the backend’s jobs, with the next run it reports', async () => {
    await jobs.connect();
    expect(jobs.mode()).toBe('live');
    expect(jobs.jobs()).toEqual([JOB]);
    expect(jobs.next(JOB)).toEqual(new Date('2026-10-08T05:00:00.000Z'));
    expect(jobs.next({ ...JOB, nextRun: undefined, enabled: false })).toBeNull();
  });

  it('starts, switches off and cancels jobs through the API, and reads the jobs again', async () => {
    await jobs.connect();
    const run: JobRun = { id: '7', jobId: 'data-pack', trigger: 'manual', status: 'queued', startedAt: '2026-10-07T17:00:00.000Z', log: [] };
    api.run.mockResolvedValue(run);
    api.list.mockResolvedValue({ jobs: [JOB], runs: [run] });
    jobs.runNow('data-pack');
    await vi.waitFor(() => expect(jobs.isActive('data-pack')).toBe(true));
    expect(api.run).toHaveBeenCalledWith('data-pack');
    jobs.setEnabled('data-pack', false);
    jobs.cancel('7');
    await vi.waitFor(() => expect(api.cancel).toHaveBeenCalledWith('7'));
    expect(api.setEnabled).toHaveBeenCalledWith('data-pack', false);
  });

  it('says why an action was refused', async () => {
    await jobs.connect();
    api.run.mockRejectedValue(new JobsApiError('Check the data pack is already running', false));
    jobs.runNow('data-pack');
    await vi.waitFor(() => expect(jobs.problem()).toBe('Check the data pack is already running'));
  });

  it('says why the jobs cannot be shown, such as a missing database', async () => {
    api.list.mockRejectedValue(new JobsApiError('The data jobs need the database. Set DATABASE_URL.', false));
    await jobs.connect();
    expect(jobs.mode()).toBe('unavailable');
    expect(jobs.problem()).toBe('The data jobs need the database. Set DATABASE_URL.');
  });

  it('keeps asking while it is connected, and keeps the jobs when the backend stops answering for a while', async () => {
    await jobs.connect();
    expect(api.list).toHaveBeenCalledTimes(1);
    api.list.mockRejectedValueOnce(new JobsApiError('The backend cannot be reached', true));
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(jobs.mode()).toBe('live');
    expect(jobs.jobs()).toEqual([JOB]);
    expect(jobs.problem()).toBe('The backend cannot be reached');
    await vi.advanceTimersByTimeAsync(2000);
    expect(jobs.problem()).toBeNull();
    jobs.disconnect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.list).toHaveBeenCalledTimes(3);
  });
});
