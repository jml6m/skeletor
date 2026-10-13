import type { MongoClient } from 'mongodb';

import { connectMongo, startMongoMemory, stopMongoMemory } from './support/mongo-memory.js';

describe('MongoDB memory server', () => {
  let client: MongoClient;

  // The first run can be slow while mongodb-memory-server starts its MongoDB binary.
  beforeAll(async () => {
    client = await connectMongo(await startMongoMemory());
  }, 60_000);

  afterAll(async () => {
    await client.close();
    await stopMongoMemory();
  });

  it('stores and reads back a document', async () => {
    const items = client.db('test').collection('items');

    await items.insertOne({ name: 'example' });

    await expect(items.findOne({ name: 'example' }, { projection: { _id: 0 } })).resolves.toEqual({ name: 'example' });
  });
});
