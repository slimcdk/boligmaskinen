# 7. Travel times from our own routing, not a routing service

- **Status:** accepted
- **Date:** 2026-10-10
- **Where:** `pipeline/src/boligmaskinen_pipeline/roads.py`, `transit.py` and `travel.py`,
  `POST /api/travel`; [#91](https://github.com/slimcdk/boligmaskinen/pull/91),
  [#129](https://github.com/slimcdk/boligmaskinen/pull/129)

## Context

A place, such as work, gets a block with the travel time to it from every cell, by car, by bike,
on foot and by public transport. The map needs the times from all of Denmark's cells to one
place, found within seconds of adding it, on a home server.

## Decision

- **Car, bike and foot:** the `roads` step builds a network per mode from the OSM extract (speeds
  from the tags, one-way streets, ferries with their time to board), and `travel` runs one
  Dijkstra (SciPy) from the place over the reversed network. One search gives the times from
  every cell.
- **Public transport:** the `transit` step keeps one weekday's timetable from Rejseplanen's GTFS
  feed beside the roads (the busiest Tuesday to Thursday of its first four weeks, not a school
  holiday), and `travel` scans its connections back from the place (the connection scan
  algorithm), walking to the first stop and from the last: the time to be there between 7:30 and
  8:30, waiting included.

## Alternatives

- **OSRM or Valhalla,** which the plan first named: a service of their own to run and feed, and
  they answer one trip at a time where the map needs every cell at once.
- **Rejseplanen's API:** needs a key, has limits, and answers one trip at a time.
- **Estimates from the straight-line distance:** what the prototype had; still used until the real
  times are ready.

## Consequences

- No turn restrictions and no traffic: car times are from 85 % of the speed limit.
- The road network is rebuilt when the OSM extract or the timetable is new (the `roads` job);
  about a minute and 0.75 GB for Denmark.
- A place says whether its times come from the roads and the timetables, or are still estimates.
