import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | undefined;

export async function startMongoMemory(): Promise<string> {
  mongoServer = await MongoMemoryServer.create();
  return mongoServer.getUri();
}

export async function stopMongoMemory(): Promise<void> {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}
