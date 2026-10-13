// mongodb 7 loads `os` with a dynamic import(), which Jest can't run in CommonJS tests, so this
// project stays on the 6.x driver.
const { MongoClient } = require('mongodb');

const { startMongoMemory, stopMongoMemory } = require('./support/mongo-memory');

describe('MongoDB memory server', () => {
  let client;

  // The first run can be slow while mongodb-memory-server starts its MongoDB binary.
  beforeAll(async () => {
    client = await MongoClient.connect(await startMongoMemory());
  }, 60_000);

  afterAll(async () => {
    await client?.close();
    await stopMongoMemory();
  });

  it('stores and reads back a document', async () => {
    const items = client.db('test').collection('items');

    await items.insertOne({ name: 'example' });

    await expect(items.findOne({ name: 'example' }, { projection: { _id: 0 } })).resolves.toEqual({ name: 'example' });
  });
});
