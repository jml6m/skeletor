const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

async function startMongoMemory() {
  mongoServer = await MongoMemoryServer.create();
  return mongoServer.getUri();
}

async function stopMongoMemory() {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}

module.exports = { startMongoMemory, stopMongoMemory };
