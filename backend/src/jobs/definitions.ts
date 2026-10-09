import { type BuildOptions, buildJobs } from '../pipeline/builds.ts';
import { sourceJobs } from '../pipeline/sources.ts';
import { checkDataPack } from './data-pack.ts';
import type { JobDefinition } from './types.ts';

/** The data jobs. Their schedules are in the instance's time zone (JOB_TIME_ZONE). */
export function defineJobs(pipeline: BuildOptions): JobDefinition[] {
  return [
    {
      id: 'data-pack', name: 'Check the data pack', kind: 'check', source: 'Boligmaskinen', schedule: '0 7 * * *', enabledByDefault: true,
      description: 'Reads the data pack the map loads and checks that every layer, basemap part and world file is there.',
      run: checkDataPack,
    },
    ...sourceJobs(pipeline),
    ...buildJobs(pipeline),
    { id: 'datafordeler', name: 'Addresses and buildings', kind: 'fetch', source: 'Datafordeleren (DAR, BBR)', schedule: '15 2 * * *', enabledByDefault: false, blocked: 'Needs a Datafordeleren API key', description: 'Dwellings per address and building data.' },
    { id: 'ejf', name: 'Sale prices', kind: 'fetch', source: 'Datafordeleren (EJF)', schedule: '30 2 * * *', enabledByDefault: false, blocked: 'Needs approval from Geodatastyrelsen', description: 'Købesum per sale.' },
    { id: 'listings', name: 'Homes for sale', kind: 'fetch', source: 'Licensed feed', schedule: '*/30 * * * *', enabledByDefault: false, blocked: 'Needs a licence for a listings feed', description: 'New and changed listings.' },
  ];
}
