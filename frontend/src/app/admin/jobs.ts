/**
 * The jobs that fetch and build the data, and their runs: the shapes the backend's jobs API
 * serves (backend/src/jobs/types.ts has the same). JOBS and seedRuns are the preview's own data,
 * for when there is no backend.
 */

export interface Job {
  id: string;
  name: string;
  kind: 'fetch' | 'build' | 'check' | 'backup';
  /** Who provides the data, e.g. "Geofabrik". */
  source: string;
  description: string;
  /** Cron expression in local time: minute hour day-of-month month day-of-week. */
  schedule: string;
  enabled: boolean;
  /** Why the job cannot run yet, e.g. a missing API key. */
  blocked?: string;
  /** True when the job is planned but not built yet; `blocked` says when it comes. */
  planned?: boolean;
  /** Jobs that start when this one has succeeded. */
  then?: string[];
  /** When the schedule starts it next, from the backend, in its time zone. */
  nextRun?: string;
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface LogLine {
  at: string;
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface JobRun {
  id: string;
  jobId: string;
  trigger: 'schedule' | 'manual' | 'after';
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  /** 0–1 while running. */
  progress?: number;
  bytes?: number;
  /** What was fetched or built, e.g. "6,250 polygons". */
  result?: string;
  message?: string;
  log: LogLine[];
}

export const JOBS: Job[] = [
  {
    id: 'osm', name: 'OpenStreetMap', kind: 'fetch', source: 'Geofabrik', schedule: '0 3 * * *', enabled: true, then: ['grid'],
    description: 'The extract of Denmark, and from it forests, water, beaches, shops, stations, roads, addresses and municipalities.',
  },
  { id: 'plandata', name: 'Planning zones', kind: 'fetch', source: 'Plandata.dk', schedule: '30 3 * * *', enabled: true, then: ['grid'], description: 'Byzone and sommerhusområde polygons from the WFS.' },
  { id: 'stil-schools', name: 'Schools', kind: 'fetch', source: 'STIL Institutionsregisteret', schedule: '40 3 * * *', enabled: true, then: ['grid'], description: 'Folkeskoler, friskoler and private schools.' },
  { id: 'stil-daycare', name: 'Daycare', kind: 'fetch', source: 'STIL Dagtilbudsregisteret', schedule: '45 3 * * *', enabled: true, then: ['grid'], description: 'The register’s CSV export of active units.' },
  { id: 'ens', name: 'Wind turbines', kind: 'fetch', source: 'Energistyrelsen', schedule: '0 4 2 * *', enabled: true, then: ['grid'], description: 'The monthly master data register; the job finds the newest upload on the data overview page.' },
  { id: 'dst', name: 'Municipal statistics', kind: 'fetch', source: 'Danmarks Statistik', schedule: '0 5 * * 1', enabled: true, then: ['grid'], description: 'Tax (PSKAT), population (FOLK1A) and burglaries (STRAF22), each in its newest period.' },
  { id: 'noise', name: 'Road noise', kind: 'fetch', source: 'Miljøstyrelsen', schedule: '0 4 1 * *', enabled: true, then: ['grid'], description: 'The strategic noise map of roads, taken out of the 2 GB archive with range requests. New maps every 5 years.' },
  { id: 'basemap', name: 'Basemap', kind: 'fetch', source: 'Protomaps', schedule: '0 2 * * 0', enabled: true, then: ['pack'], description: 'Tiles for Denmark up to zoom 12 from the daily planet build.' },
  { id: 'world', name: 'World map', kind: 'fetch', source: 'Natural Earth', schedule: '0 2 1 * *', enabled: true, then: ['pack'], description: 'Land, lakes, borders and names outside Denmark.' },
  { id: 'grid', name: 'Build the grid', kind: 'build', source: 'Boligmaskinen', schedule: '0 6 * * *', enabled: true, then: ['pack'], description: 'Every data layer on the 100 m grid, sampled to the 200 m display grid.' },
  { id: 'pack', name: 'Pack the data', kind: 'build', source: 'Boligmaskinen', schedule: '30 6 * * *', enabled: true, description: 'The data pack the map loads.' },
  { id: 'datafordeler', name: 'Addresses and buildings', kind: 'fetch', source: 'Datafordeleren (DAR, BBR)', schedule: '15 2 * * *', enabled: false, blocked: 'Needs a Datafordeleren API key', description: 'Dwellings per address and building data.' },
  { id: 'ejf', name: 'Sale prices', kind: 'fetch', source: 'Datafordeleren (EJF)', schedule: '30 2 * * *', enabled: false, blocked: 'Needs approval from Geodatastyrelsen', description: 'Købesum per sale.' },
  { id: 'listings', name: 'Homes for sale', kind: 'fetch', source: 'Licensed feed', schedule: '*/30 * * * *', enabled: false, blocked: 'Needs a licence for a listings feed', description: 'New and changed listings.' },
];

/** What the pilot's own runs on 2026-10-07 fetched and built, as the history to start from. */
export function seedRuns(): JobRun[] {
  const run = (jobId: string, start: string, seconds: number, extra: Partial<JobRun> = {}): JobRun => {
    const started = new Date(`2026-10-07T${start}`);
    const finished = new Date(started.getTime() + seconds * 1000);
    return {
      id: `${jobId}-${start}`, jobId, trigger: 'manual', status: 'succeeded',
      startedAt: started.toISOString(), finishedAt: finished.toISOString(),
      log: [
        { at: started.toISOString(), level: 'info', text: 'Started' },
        { at: finished.toISOString(), level: 'info', text: extra.result ? `Done: ${extra.result}` : 'Done' },
      ],
      ...extra,
    };
  };
  return [
    run('pack', '15:16:00', 41, { bytes: 83_000_000, result: '16 basemap parts and 13 layers' }),
    run('basemap', '15:14:47', 38, { bytes: 75_095_122, result: '3,070 tiles' }),
    run('grid', '15:11:30', 158, { trigger: 'after', result: '17.6 million cells; 1.05 million land cells at 200 m' }),
    run('world', '15:08:40', 3, { bytes: 1_952_000, result: '5 layers' }),
    run('dst', '15:08:20', 2, { bytes: 13_454, result: '98 municipalities' }),
    run('plandata', '15:08:05', 9, { bytes: 19_170_024, result: '6,250 polygons' }),
    run('osm', '15:05:10', 87, { bytes: 495_424_603, result: '2,615,038 address points' }),
    run('noise', '12:31:40', 95, { bytes: 141_349_000, result: '16,388 polygons, read from a 2 GB archive' }),
    run('stil-daycare', '12:30:30', 6, { bytes: 3_100_000, result: '4,886 active units' }),
    run('stil-schools', '12:30:10', 4, { bytes: 9_800_000, result: '1,938 active schools' }),
    run('ens', '12:29:50', 3, { bytes: 1_400_000, result: '4,866 turbines in operation' }),
    {
      id: 'ens-2026-09-02', jobId: 'ens', trigger: 'schedule', status: 'failed',
      startedAt: '2026-09-02T02:00:00.000Z', finishedAt: '2026-09-02T02:00:04.000Z',
      message: 'The download link has changed (new media id). The job looks it up on the data overview page now.',
      log: [
        { at: '2026-09-02T02:00:00.000Z', level: 'info', text: 'Started' },
        { at: '2026-09-02T02:00:03.000Z', level: 'warn', text: 'GET https://ens.dk/media/8748/download returned 404' },
        { at: '2026-09-02T02:00:04.000Z', level: 'error', text: 'The download link has changed (new media id)' },
      ],
    },
  ];
}
