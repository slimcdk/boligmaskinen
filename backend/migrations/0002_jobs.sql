-- The data jobs (src/jobs): whether each one is switched on, and every run with its log.
-- pg-boss keeps its queues in a schema of its own, pgboss.
create table job_setting (
  job_id text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

create table job_run (
  id bigint generated always as identity primary key,
  job_id text not null,
  trigger text not null check (trigger in ('schedule', 'manual', 'after')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  -- The pg-boss job, to cancel a run that is still waiting
  queue_job_id text,
  progress real,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result text,
  bytes bigint,
  message text,
  log jsonb not null default '[]'
);

create index job_run_recent on job_run (started_at desc);
create index job_run_by_job on job_run (job_id, started_at desc);
