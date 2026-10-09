import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { describe } from 'vitest';

/**
 * The tests that need PostgreSQL run against TEST_DATABASE_URL (or DATABASE_URL, as in the dev
 * container): a server where the user may create databases. Each test file gets a database of
 * its own, which is dropped afterwards. Without a server the tests are skipped, except in CI.
 */
const adminUrl = process.env['TEST_DATABASE_URL'] || process.env['DATABASE_URL'] || '';

if (!adminUrl && process.env['CI']) throw new Error('CI needs TEST_DATABASE_URL for the database tests');

export const hasDatabase = !!adminUrl;
export const describeWithDatabase = describe.skipIf(!hasDatabase);

/** A new, empty database; `drop` removes it again. */
export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = `bm_test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const client = new pg.Client({ connectionString: adminUrl });
      await client.connect();
      await client.query(`drop database if exists ${name} with (force)`);
      await client.end();
    },
  };
}
