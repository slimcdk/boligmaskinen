import pg from 'pg';
import { expect, it } from 'vitest';
import { createTestDatabase, describeWithDatabase } from './database.ts';

describeWithDatabase('a test database', () => {
  it('is dropped once the connections that are closing have closed', async () => {
    const database = await createTestDatabase();
    const client = new pg.Client({ connectionString: database.url });
    const errors: Error[] = [];
    client.on('error', (error) => errors.push(error));
    await client.connect();
    // As a pool's end() leaves its connections: they close a moment after it returns
    setTimeout(() => void client.end(), 300);
    await database.drop();
    expect(errors).toEqual([]);
  });
});
