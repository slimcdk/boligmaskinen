import { Injectable } from '@angular/core';
import { Job, JobRun } from './jobs';

/**
 * Why a call to the jobs API failed: there is no backend at all (a static host answers with its
 * page, or nothing answers), or the backend refused with a reason.
 */
export class JobsApiError extends Error {
  readonly noBackend: boolean;

  constructor(message: string, noBackend: boolean) {
    super(message);
    this.name = 'JobsApiError';
    this.noBackend = noBackend;
  }
}

/** The backend's jobs API (backend/src/routes/jobs.ts). */
@Injectable({ providedIn: 'root' })
export class JobsApi {
  list(): Promise<{ jobs: Job[]; runs: JobRun[] }> {
    return this.request('GET', 'api/jobs');
  }

  async run(jobId: string): Promise<JobRun> {
    return (await this.request<{ run: JobRun }>('POST', `api/jobs/${encodeURIComponent(jobId)}/run`)).run;
  }

  async setEnabled(jobId: string, enabled: boolean): Promise<Job> {
    return (await this.request<{ job: Job }>('PATCH', `api/jobs/${encodeURIComponent(jobId)}`, { enabled })).job;
  }

  async cancel(runId: string): Promise<JobRun> {
    return (await this.request<{ run: JobRun }>('POST', `api/runs/${encodeURIComponent(runId)}/cancel`)).run;
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, document.baseURI), {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new JobsApiError('The backend cannot be reached', true);
    }
    const json = response.headers.get('content-type')?.includes('json') ? await response.json().catch(() => null) : null;
    if (!json) throw new JobsApiError(`No jobs API here (HTTP ${response.status})`, true);
    if (!response.ok) throw new JobsApiError((json as { message?: string }).message ?? `HTTP ${response.status}`, false);
    return json as T;
  }
}
