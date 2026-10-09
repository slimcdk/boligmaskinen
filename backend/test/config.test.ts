import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.ts';

describe('loadConfig', () => {
  it('has defaults for a local run', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ port: 8080, host: '0.0.0.0', dataPackDir: null, dataDir: null, databaseUrl: null, timeZone: 'Europe/Copenhagen', logLevel: 'info', version: null });
    expect(config.staticDir).toMatch(/frontend\/dist\/frontend\/browser$/);
    expect(config.pipelinePython).toMatch(/pipeline\/\.venv\/bin\/python$/);
    expect(config).toMatchObject({ pmtiles: 'pmtiles', grid: { cellMetres: 100, region: 'denmark' } });
  });

  it('reads the settings of the image', () => {
    const config = loadConfig({
      PORT: '9000', DATA_PACK_DIR: '/data/data-pack', DATABASE_URL: 'postgres://u:p@db:5432/boligmaskinen',
      JOB_TIME_ZONE: 'UTC', LOG_LEVEL: 'warn', APP_REVISION: 'abc', DATA_DIR: '/data', PIPELINE_PYTHON: '/app/pipeline/.venv/bin/python',
      GRID_CELL_METRES: '200', REGION: '751,706',
    });
    expect(config.grid).toEqual({ cellMetres: 200, region: '751,706' });
    expect(config).toMatchObject({
      port: 9000, dataPackDir: '/data/data-pack', databaseUrl: 'postgres://u:p@db:5432/boligmaskinen', timeZone: 'UTC', logLevel: 'warn',
      dataDir: '/data', pipelinePython: '/app/pipeline/.venv/bin/python',
    });
    expect(config.version?.revision).toBe('abc');
  });

  it('names every wrong setting at once', () => {
    try {
      loadConfig({
        PORT: 'eighty', DATABASE_URL: 'mysql://db', JOB_TIME_ZONE: 'Mars/Olympus', LOG_LEVEL: 'loud', DATA_DIR: 'data',
        GRID_CELL_METRES: '2.5', REGION: 'Aarhus',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).problems).toEqual([
        'PORT has to be a port number from 1 to 65535, not "eighty"',
        'DATABASE_URL has to start with postgres:// or postgresql://',
        'JOB_TIME_ZONE has to be a time zone such as Europe/Copenhagen, not "Mars/Olympus"',
        'LOG_LEVEL has to be one of fatal, error, warn, info, debug, trace, silent, not "loud"',
        'DATA_DIR has to be an absolute path, not "data"',
        'GRID_CELL_METRES has to be a whole number of metres from 10 to 1000, not "2.5"',
        'REGION has to be denmark, oestjylland, aarhus or municipality codes such as 751,706, not "Aarhus"',
      ]);
    }
  });
});
