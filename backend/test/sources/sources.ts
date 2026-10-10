import type { PROTOMAPS_URLS } from '../../src/pipeline/builds.ts';
import { NATURAL_EARTH, type SourceUrls } from '../../src/pipeline/sources.ts';
import { FONTS, GLYPH_RANGES } from '../../src/pipeline/styles.ts';
import type { TestServer } from './server.ts';

const zip = (text: string) => Buffer.concat([Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.from(text)]);

/** What the made-up sources have; a test changes it to make a source change. */
export interface Sources {
  zones: number;
  planetBuild: string;
}

/** Every source the jobs fetch, as the test server answers them, with the URLs that point at it. */
export function serveSources(server: TestServer): { sources: Sources; urls: SourceUrls; protomaps: typeof PROTOMAPS_URLS } {
  const sources: Sources = { zones: 2, planetBuild: '20261009.pmtiles' };
  const base = server.url;
  server.file('/osm/denmark-latest.osm.pbf', { content: 'the extract of Denmark' });
  server.file('/wfs', () => ({ content: JSON.stringify({ timeStamp: new Date().toISOString(), features: Array.from({ length: sources.zones }, () => ({})) }), etag: null }));
  server.file('/institutions', { content: JSON.stringify([{ institutionTypeId: 1012, activeCodeName: 'Aktiv' }]) });
  server.on('GET /Eksport.aspx', (_request, response) => {
    response.writeHead(200).end('<input id="__VIEWSTATE" value="s" /><input id="__VIEWSTATEGENERATOR" value="g" /><input id="__EVENTVALIDATION" value="v" />');
  });
  server.on('POST /Eksport.aspx', (_request, response) => {
    response.writeHead(200).end('navn;aktivitetsstatus;geoBredde;geoLaengde\nSolsikken;Aktiv;56.1;10.2\n');
  });
  server.on('GET /data-oversigt', (_request, response) => {
    response.writeHead(200).end('<a class="link-download" href="/media/1/download">Vinddata (ultimo 08 2026)</a>');
  });
  server.file('/media/1/download', { content: zip('turbines') });
  server.on('POST /statbank', (request, response) => {
    const { table } = JSON.parse(request.body) as { table: string };
    response.writeHead(200).end(JSON.stringify({ dataset: { dimension: { Tid: { category: { index: { 2026: 0 } } } }, value: [1], table } }));
  });
  server.file('/noise/2022_noise_shp.zip', { content: 'the noise archive', etag: '"noise"' });
  server.on('GET /air', (_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ timeStamp: new Date().toISOString(), features: Array.from({ length: 1200 }, () => ({ properties: { NO2: 9.5, PM2_5: 5.1 } })) }));
  });
  server.on('GET /protected', (_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ timeStamp: new Date().toISOString(), features: Array.from({ length: 1200 }, () => ({ geometry: { type: 'MultiPolygon', coordinates: [] } })) }));
  });
  for (const path of NATURAL_EARTH) server.file(`/ne/${path}.zip`, { content: zip(path) });
  server.on('GET /protomaps/builds.json', (_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([{ key: '20261008.pmtiles' }, { key: sources.planetBuild }]));
  });
  for (const font of Object.keys(FONTS)) {
    for (const range of GLYPH_RANGES) server.file(`/assets/fonts/${encodeURIComponent(font)}/${range}.pbf`, { content: `${font} ${range}` });
  }
  for (const sprite of ['light', 'dark'].flatMap((f) => [`${f}.json`, `${f}.png`, `${f}@2x.json`, `${f}@2x.png`])) {
    server.file(`/assets/sprites/v4/${sprite}`, { content: sprite });
  }
  server.file('/assets/fonts/OFL.txt', { content: 'SIL OPEN FONT LICENSE Version 1.1' });
  server.file('/icons/LICENSE.md', { content: 'The MIT License' });
  return {
    sources,
    urls: {
      osm: `${base}/osm/denmark-latest.osm.pbf`, zones: `${base}/wfs`, institutions: `${base}/institutions`, daycare: `${base}/Eksport.aspx`,
      turbinesPage: `${base}/data-oversigt`, statbank: `${base}/statbank`, noise: `${base}/noise/2022_noise_shp.zip`, naturalEarth: `${base}/ne`,
      air: `${base}/air`, protected: `${base}/protected`,
    },
    protomaps: { builds: `${base}/protomaps/builds.json`, tiles: `${base}/tiles`, assets: `${base}/assets`, iconsLicence: `${base}/icons/LICENSE.md` },
  };
}
