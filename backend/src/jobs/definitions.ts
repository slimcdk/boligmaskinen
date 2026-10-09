import { type PipelineOptions, sourceJobs } from '../pipeline/sources.ts';
import { checkDataPack } from './data-pack.ts';
import type { JobDefinition } from './types.ts';

const NEXT = 'Not built yet: comes with the next step of milestone 2, the data pipeline as jobs';

/** The data jobs. Their schedules are in the instance's time zone (JOB_TIME_ZONE). */
export function defineJobs(pipeline: PipelineOptions): JobDefinition[] {
  return [
    {
      id: 'data-pack', name: 'Check the data pack', kind: 'check', source: 'Boligmaskinen', schedule: '0 7 * * *', enabledByDefault: true,
      description: 'Reads the data pack the map loads and checks that every layer, basemap part and world file is there.',
      run: checkDataPack,
    },
    ...sourceJobs(pipeline),
    { id: 'basemap', name: 'Basemap', kind: 'fetch', source: 'Protomaps', schedule: '0 2 * * 0', enabledByDefault: false, planned: true, blocked: NEXT, then: ['pack'], description: 'Tiles for Denmark up to zoom 12 from the daily planet build.' },
    { id: 'grid', name: 'Build the grid', kind: 'build', source: 'Boligmaskinen', schedule: '0 6 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['pack'], description: 'Every data layer on the 100 m grid, sampled to the display grid.' },
    { id: 'pack', name: 'Pack the data', kind: 'build', source: 'Boligmaskinen', schedule: '30 6 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['data-pack'], description: 'The data pack the map loads.' },
    { id: 'datafordeler', name: 'Addresses and buildings', kind: 'fetch', source: 'Datafordeleren (DAR, BBR)', schedule: '15 2 * * *', enabledByDefault: false, blocked: 'Needs a Datafordeleren API key', description: 'Dwellings per address and building data.' },
    { id: 'ejf', name: 'Sale prices', kind: 'fetch', source: 'Datafordeleren (EJF)', schedule: '30 2 * * *', enabledByDefault: false, blocked: 'Needs approval from Geodatastyrelsen', description: 'Købesum per sale.' },
    { id: 'listings', name: 'Homes for sale', kind: 'fetch', source: 'Licensed feed', schedule: '*/30 * * * *', enabledByDefault: false, blocked: 'Needs a licence for a listings feed', description: 'New and changed listings.' },
  ];
}
