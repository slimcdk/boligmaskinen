import { checkDataPack } from './data-pack.ts';
import type { JobDefinition } from './types.ts';

const NEXT = 'Not built yet: comes with milestone 2, the data pipeline as jobs';

/** The data jobs. Their schedules are in the instance's time zone (JOB_TIME_ZONE). */
export const JOBS: JobDefinition[] = [
  {
    id: 'data-pack', name: 'Check the data pack', kind: 'check', source: 'Boligmaskinen', schedule: '0 7 * * *', enabledByDefault: true,
    description: 'Reads the data pack the map loads and checks that every layer, basemap part and world file is there.',
    run: checkDataPack,
  },
  {
    id: 'osm', name: 'OpenStreetMap', kind: 'fetch', source: 'Geofabrik', schedule: '0 3 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'],
    description: 'Denmark extract: forests, water, beaches, shops, stations, roads, addresses and municipalities.',
  },
  { id: 'plandata', name: 'Planning zones', kind: 'fetch', source: 'Plandata.dk', schedule: '30 3 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'], description: 'Byzone and sommerhusområde polygons from the WFS.' },
  { id: 'stil-schools', name: 'Schools', kind: 'fetch', source: 'STIL Institutionsregisteret', schedule: '40 3 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'], description: 'Folkeskoler, friskoler and private schools.' },
  { id: 'stil-daycare', name: 'Daycare', kind: 'fetch', source: 'STIL Dagtilbudsregisteret', schedule: '45 3 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'], description: 'The register’s CSV export of active units.' },
  { id: 'ens', name: 'Wind turbines', kind: 'fetch', source: 'Energistyrelsen', schedule: '0 4 2 * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'], description: 'The monthly master data register; the download link changes with every upload.' },
  { id: 'dst', name: 'Municipal statistics', kind: 'fetch', source: 'Danmarks Statistik', schedule: '0 5 * * 1', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'], description: 'Tax (PSKAT), population (FOLK1A) and burglaries (STRAF22).' },
  { id: 'noise', name: 'Road noise', kind: 'fetch', source: 'Miljøstyrelsen', schedule: '0 4 1 3 *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['grid'], description: 'Strategic noise maps, read from the 2 GB archive with range requests. New maps every 5 years.' },
  { id: 'basemap', name: 'Basemap', kind: 'fetch', source: 'Protomaps', schedule: '0 2 * * 0', enabledByDefault: false, planned: true, blocked: NEXT, then: ['pack'], description: 'Tiles for Denmark up to zoom 12 from the daily planet build.' },
  { id: 'world', name: 'World map', kind: 'fetch', source: 'Natural Earth', schedule: '0 2 1 1 *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['pack'], description: 'Land, lakes, borders and names outside Denmark.' },
  { id: 'grid', name: 'Build the grid', kind: 'build', source: 'Boligmaskinen', schedule: '0 6 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['pack'], description: 'Every data layer on the 100 m grid, sampled to the display grid.' },
  { id: 'pack', name: 'Pack the data', kind: 'build', source: 'Boligmaskinen', schedule: '30 6 * * *', enabledByDefault: false, planned: true, blocked: NEXT, then: ['data-pack'], description: 'The data pack the map loads.' },
  { id: 'datafordeler', name: 'Addresses and buildings', kind: 'fetch', source: 'Datafordeleren (DAR, BBR)', schedule: '15 2 * * *', enabledByDefault: false, blocked: 'Needs a Datafordeleren API key', description: 'Dwellings per address and building data.' },
  { id: 'ejf', name: 'Sale prices', kind: 'fetch', source: 'Datafordeleren (EJF)', schedule: '30 2 * * *', enabledByDefault: false, blocked: 'Needs approval from Geodatastyrelsen', description: 'Købesum per sale.' },
  { id: 'listings', name: 'Homes for sale', kind: 'fetch', source: 'Licensed feed', schedule: '*/30 * * * *', enabledByDefault: false, blocked: 'Needs a licence for a listings feed', description: 'New and changed listings.' },
];
