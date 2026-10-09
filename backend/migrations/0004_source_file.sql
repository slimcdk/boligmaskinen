-- The raw archive (src/pipeline/archive.ts): every file the data jobs fetched, kept unchanged under
-- DATA_DIR/raw with where it came from, its licence and its hash. The newest row of a source's file
-- is the one the builds read. Old files are deleted after a while; their rows stay as the history.
create table source_file (
  id bigint generated always as identity primary key,
  -- The job that fetches it, e.g. 'osm', and the file's name in that source
  source text not null,
  name text not null,
  url text not null,
  licence text not null,
  -- Relative to DATA_DIR
  path text not null,
  bytes bigint not null,
  sha256 text not null,
  -- What decides whether the source changed: the sha256, or the hash of the content without what
  -- changes with every answer, such as a time stamp
  fingerprint text not null,
  -- The server's validators, for a conditional request next time
  etag text,
  last_modified text,
  fetched_at timestamptz not null default now(),
  -- The last time the source was found unchanged
  checked_at timestamptz not null default now(),
  run_id bigint references job_run (id) on delete set null,
  -- When the file was deleted to save room
  pruned_at timestamptz
);

create index source_file_newest on source_file (source, name, id desc);
