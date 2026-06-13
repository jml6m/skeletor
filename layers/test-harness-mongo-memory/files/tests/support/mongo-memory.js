import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export async function startMongoMemory() {
  mongoServer = await MongoMemoryServer.create();
  return mongoServer.getUri();
}

export async function stopMongoMemory() {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}