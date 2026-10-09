-- The user's maps and places (src/profile). One profile per instance until there are users.
-- Every map and place has a version, raised with each change, so a device that saves over a
-- change it has not seen is told.
create table profile (
  id integer primary key default 1 check (id = 1),
  -- Made with the database, so a device can tell a new database from the one it knew
  epoch uuid not null default gen_random_uuid(),
  -- Counts every change, so a device can ask cheaply whether anything changed
  revision integer not null default 0
);

insert into profile default values;

create table saved_map (
  id text primary key,
  -- The order the maps were made in
  seq bigint generated always as identity,
  name text not null,
  blocks jsonb not null,
  groups jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table place (
  id text primary key,
  seq bigint generated always as identity,
  name text not null,
  lng double precision not null,
  lat double precision not null,
  -- For the jobs that will work out the travel times to it (milestone 3)
  geom geometry(Point, 4326) generated always as (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) stored,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
