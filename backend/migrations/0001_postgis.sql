-- PostGIS for the geodata. The postgis/postgis image has it already; elsewhere the database user
-- has to be allowed to create it, or an administrator creates it first.
create extension if not exists postgis;
