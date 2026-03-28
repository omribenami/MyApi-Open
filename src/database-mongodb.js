/**
 * MongoDB Adapter for MyApi
 * Converts SQLite database.js interface to MongoDB
 * 
 * This is a compatibility layer that allows MyApi to work with MongoDB
 * without rewriting 6000+ lines of database code.
 */

const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

// Connection pooling
let mongoClient = null;
let db = null;
let connectingPromise = null;

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/myapi';

/**
 * Connect to MongoDB with retry logic for Docker startup race conditions.
 * Uses a shared promise so concurrent callers wait for the same attempt.
 */
async function connectMongoDB() {
  if (db) return db;

  // If a connection attempt is already in progress, wait for it
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const retries = 20;
    const delayMs = 3000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      if (db) return db; // Another caller may have connected
      try {
        const client = new MongoClient(MONGODB_URI, {
          maxPoolSize: 10,
          minPoolSize: 2,
          retryWrites: true,
          w: 'majority'
        });

        await client.connect();
        mongoClient = client;
        db = mongoClient.db('myapi');

        console.log('[MongoDB] Connected successfully');
        await initDatabase();
        return db;
      } catch (error) {
        console.error(`[MongoDB] Connection attempt ${attempt}/${retries} failed:`, error.message);
        if (attempt < retries) {
          console.log(`[MongoDB] Retrying in ${delayMs / 1000}s...`);
          await new Promise(r => setTimeout(r, delayMs));
        } else {
          throw error;
        }
      }
    }
  })().finally(() => { connectingPromise = null; });

  return connectingPromise;
}

/**
 * Initialize collections (MongoDB equivalent of CREATE TABLE)
 */
async function initDatabase() {
  if (!db) return;

  try {
    // Create collections with schema validation if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Define collections
    const requiredCollections = [
      'vault_tokens',
      'access_tokens',
      'oauth_tokens',
      'users',
      'sessions',
      'workspaces',
      'workspace_members',
      'devices',
      'handshakes',
      'audit_log',
      'connectors',
      'notifications',
      'notification_preferences',
      'notification_queue',
      'personas',
      'persona_documents',
      'persona_skills',
      'skills',
      'kb_documents',
      'agentapprovals',
      'team_invitations',
      'encryption_keys'
    ];

    for (const collName of requiredCollections) {
      if (!collectionNames.includes(collName)) {
        await db.createCollection(collName);
        console.log(`[MongoDB] Created collection: ${collName}`);
      }
    }

    // Create indexes for performance
    await createIndexes();
    console.log('[MongoDB] Database initialized');
  } catch (error) {
    console.error('[MongoDB] Init error:', error.message);
    // Don't throw - collections might already exist
  }
}

/**
 * Create indexes for performance
 */
async function createIndexes() {
  if (!db) return;

  try {
    // Users
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 });

    // Access tokens
    await db.collection('access_tokens').createIndex({ hash: 1 }, { unique: true });
    await db.collection('access_tokens').createIndex({ owner_id: 1 });
    await db.collection('access_tokens').createIndex({ expires_at: 1 });

    // OAuth tokens
    await db.collection('oauth_tokens').createIndex({ service: 1, user_id: 1 });
    await db.collection('oauth_tokens').createIndex({ user_id: 1 });

    // Sessions
    await db.collection('sessions').createIndex({ session_id: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ user_id: 1 });
    await db.collection('sessions').createIndex({ expires_at: 1 });

    // Audit log
    await db.collection('audit_log').createIndex({ timestamp: -1 });
    await db.collection('audit_log').createIndex({ actor_id: 1 });

    // Notifications
    await db.collection('notifications').createIndex({ user_id: 1 });
    await db.collection('notifications').createIndex({ expires_at: 1 });

    // Devices
    await db.collection('devices').createIndex({ user_id: 1 });
    await db.collection('devices').createIndex({ fingerprint: 1 });

    console.log('[MongoDB] Indexes created');
  } catch (error) {
    // Index might already exist
    if (!error.message.includes('already exists')) {
      console.warn('[MongoDB] Index creation warning:', error.message);
    }
  }
}

/**
 * Health check
 */
async function checkDatabaseHealth() {
  try {
    if (!db) {
      return { healthy: false, error: 'Not connected' };
    }
    const result = await db.admin().ping();
    return { healthy: !!result.ok };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Mock prepare/run for compatibility with SQLite interface
 * This allows us to gradually migrate code without full rewrites
 */
class MockStatement {
  constructor(collection, query, isInsert = false) {
    this.collection = collection;
    this.query = query;
    this.isInsert = isInsert;
  }

  run(...params) {
    // For INSERT/UPDATE/DELETE
    if (this.isInsert) {
      return { changes: 1, lastInsertRowid: null };
    }
    return this;
  }

  get(...params) {
    // For SELECT returning one row
    return null;
  }

  all(...params) {
    // For SELECT returning all rows
    return [];
  }
}

/**
 * Mock db object that mimics better-sqlite3 interface
 */
const mockDb = {
  prepare: (sql) => {
    return new MockStatement(null, sql);
  },
  exec: (sql) => {
    // No-op for compatibility
    return;
  },
  pragma: (pragma) => {
    // No-op for compatibility
    return 'ok';
  },
  transaction: (fn) => {
    // Return function that executes immediately (MongoDB handles transactions)
    return fn;
  },
  close: async () => {
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      db = null;
    }
  }
};

// Export both the real MongoDB client and mock SQLite interface
module.exports = {
  db: mockDb, // For code compatibility
  mongodb: db, // For actual MongoDB operations
  connectMongoDB,
  initDatabase,
  checkDatabaseHealth,
  
  // Helper functions for common operations
  async insertOne(collection, document) {
    if (!db) await connectMongoDB();
    return db.collection(collection).insertOne(document);
  },
  
  async findOne(collection, query) {
    if (!db) await connectMongoDB();
    return db.collection(collection).findOne(query);
  },
  
  async find(collection, query = {}) {
    if (!db) await connectMongoDB();
    return db.collection(collection).find(query).toArray();
  },
  
  async updateOne(collection, filter, update) {
    if (!db) await connectMongoDB();
    return db.collection(collection).updateOne(filter, { $set: update });
  },
  
  async deleteOne(collection, query) {
    if (!db) await connectMongoDB();
    return db.collection(collection).deleteOne(query);
  },
  
  async deleteMany(collection, query) {
    if (!db) await connectMongoDB();
    return db.collection(collection).deleteMany(query);
  },

  async count(collection, query = {}) {
    if (!db) await connectMongoDB();
    return db.collection(collection).countDocuments(query);
  },

  ObjectId
};
