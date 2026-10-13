const os = require('os');
const { MongoClient } = require('mongodb');
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

/**
 * Connects the MongoDB driver to `uri`. The driver loads `os` with a dynamic import(), which Jest
 * can't run in CommonJS tests, so the module is handed to it directly.
 */
function connectMongo(uri) {
  return MongoClient.connect(uri, { runtimeAdapters: { os } });
}

module.exports = { startMongoMemory, stopMongoMemory, connectMongo };
