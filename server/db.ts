import fs from 'fs';
import path from 'path';
import { MongoClient, Db, Collection, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import { GameState, Question } from '../src/types/game';
import { DEFAULT_QUESTIONS } from '../src/data/defaultQuestions';

dotenv.config();

// MongoDB document interface & local fallback storage engine
export interface GameDatabase {
  games: GameState[];
  questions: Question[];
  activeGameId: string | null;
}

const DATA_DIR = process.env.VERCEL
  ? '/tmp'
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');
const LEGACY_DB_FILE = path.resolve(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data dir:', err);
  }
}

// In-memory collection cache for offline / fallback mode
let dbCache: GameDatabase = {
  games: [],
  questions: [...DEFAULT_QUESTIONS],
  activeGameId: null,
};

// Load saved data from disk if present
function loadLocalDatabase() {
  try {
    const fileToRead = fs.existsSync(DB_FILE)
      ? DB_FILE
      : fs.existsSync(LEGACY_DB_FILE)
      ? LEGACY_DB_FILE
      : null;

    if (fileToRead) {
      const content = fs.readFileSync(fileToRead, 'utf-8');
      const parsed = JSON.parse(content);
      dbCache = {
        games: Array.isArray(parsed.games) ? parsed.games : [],
        questions: Array.isArray(parsed.questions) && parsed.questions.length > 0 ? parsed.questions : [...DEFAULT_QUESTIONS],
        activeGameId: parsed.activeGameId || null,
      };
      console.log(`[Local DB] Loaded ${dbCache.games.length} games and ${dbCache.questions.length} questions from disk.`);
    } else {
      saveLocalDatabase();
    }
  } catch (err) {
    console.error('[Local DB] Error reading local file:', err);
    saveLocalDatabase();
  }
}

// Persist data to local disk
function saveLocalDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Local DB] Error writing to disk:', err);
  }
}

loadLocalDatabase();

// Local MongoDB Connection Setup
let resolvedMongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/retro_quiz';
if (resolvedMongoUri.startsWith('mongodb+srv://') || resolvedMongoUri.includes('mongodb.net')) {
  console.log('[Local MongoDB] Replaced legacy Atlas cloud URI with local MongoDB (mongodb://127.0.0.1:27017/retro_quiz)');
  resolvedMongoUri = 'mongodb://127.0.0.1:27017/retro_quiz';
}
const MONGODB_URI = resolvedMongoUri;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'retro_quiz';

let mongoClient: MongoClient | null = null;
let mongoDbInstance: Db | null = null;
let isConnectedToMongo = false;
let isConnecting = false;
let lastConnectionError: string | null = null;

export async function connectToLocalMongo(): Promise<boolean> {
  if (isConnecting) return isConnectedToMongo;
  isConnecting = true;

  try {
    console.log(`[Local MongoDB] Connecting to Local MongoDB at ${MONGODB_URI}...`);
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch {}
      mongoClient = null;
    }

    const client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 2500,
      serverSelectionTimeoutMS: 2500,
      maxPoolSize: 10,
    });

    const connectedClient = await client.connect();
    mongoClient = connectedClient;
    mongoDbInstance = connectedClient.db(MONGODB_DB_NAME);

    // Test ping
    await mongoDbInstance.admin().ping();

    isConnectedToMongo = true;
    lastConnectionError = null;
    console.log(`[Local MongoDB] Successfully connected to database: "${MONGODB_DB_NAME}"!`);

    // Ensure indexes for fast local LAN querying
    try {
      const gCol = mongoDbInstance.collection('games');
      await gCol.createIndex({ id: 1 }, { unique: true });
      await gCol.createIndex({ 'teams.accessCode': 1 });
      await gCol.createIndex({ phase: 1 });
      await gCol.createIndex({ updatedAt: -1 });

      const qCol = mongoDbInstance.collection('questions');
      await qCol.createIndex({ id: 1 }, { unique: true });
      await qCol.createIndex({ category: 1 });
    } catch (idxErr) {
      console.warn('[Local MongoDB] Index setup notice:', idxErr);
    }

    // Sync seed questions if MongoDB collection is empty
    const qCol = mongoDbInstance.collection<Question>('questions');
    const count = await qCol.countDocuments();
    if (count === 0 && dbCache.questions.length > 0) {
      await qCol.insertMany(dbCache.questions as any);
      console.log(`[Local MongoDB] Seeded ${dbCache.questions.length} initial questions into collection.`);
    }

    isConnecting = false;
    return true;
  } catch (err: any) {
    isConnectedToMongo = false;
    isConnecting = false;
    const errorMsg = err?.message || 'Connection failed';
    lastConnectionError = `Local MongoDB is not running on 127.0.0.1:27017 (${errorMsg}). Start the MongoDB service and restart the application.`;

    console.log(`[Local MongoDB] ⚠️ Notice: ${lastConnectionError}. Active fallback: Persistent local storage (.data/db.json).`);
    return false;
  }
}

// Initial connection attempt at startup
connectToLocalMongo().catch(() => {});

// Backward compatibility alias
export const connectToAtlas = connectToLocalMongo;

// Helper to get collections safely
function getMongoQuestionsCollection(): Collection<Question> | null {
  return mongoDbInstance && isConnectedToMongo ? mongoDbInstance.collection<Question>('questions') : null;
}

function getMongoGamesCollection(): Collection<GameState> | null {
  return mongoDbInstance && isConnectedToMongo ? mongoDbInstance.collection<GameState>('games') : null;
}

// MongoDB Collection API with Local MongoDB support & local fallback
export const mongoDb = {
  isMongoConnected: () => isConnectedToMongo,
  isAtlasConnected: () => isConnectedToMongo,
  reconnect: async () => {
    return await connectToLocalMongo();
  },

  // Questions collection (Full CRUD)
  questions: {
    find: async (filter?: { category?: string; search?: string }): Promise<Question[]> => {
      const col = getMongoQuestionsCollection();
      if (col) {
        try {
          const query: any = {};
          if (filter?.category && filter.category !== 'all') {
            query.category = filter.category;
          }
          if (filter?.search) {
            query.$or = [
              { question: { $regex: filter.search, $options: 'i' } },
              { answer: { $regex: filter.search, $options: 'i' } },
            ];
          }
          const docs = await col.find(query).toArray();
          return docs.map(({ _id, ...rest }: any) => rest as Question);
        } catch (err) {
          console.error('[Local MongoDB] find questions error:', err);
        }
      }

      let results = [...dbCache.questions];
      if (filter?.category && filter.category !== 'all') {
        results = results.filter((q) => q.category === filter.category);
      }
      if (filter?.search) {
        const s = filter.search.toLowerCase();
        results = results.filter((q) => q.question.toLowerCase().includes(s) || q.answer.toLowerCase().includes(s));
      }
      return results;
    },

    findOne: async (filter: { id?: string }): Promise<Question | null> => {
      const col = getMongoQuestionsCollection();
      if (col && filter.id) {
        try {
          const doc = await col.findOne({ id: filter.id } as any);
          if (doc) {
            const { _id, ...rest } = doc as any;
            return rest as Question;
          }
        } catch (err) {
          console.error('[Local MongoDB] findOne question error:', err);
        }
      }
      if (filter.id) {
        return dbCache.questions.find((q) => q.id === filter.id) || null;
      }
      return dbCache.questions[0] || null;
    },

    insertOne: async (question: Question): Promise<Question> => {
      // Ensure unique id
      const formattedQ: Question = {
        id: question.id || `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        category: question.category || 'moderate',
        points: Number(question.points) || 6,
        question: String(question.question || '').trim(),
        answer: String(question.answer || '').trim(),
        hint: question.hint ? String(question.hint).trim() : undefined,
      };

      dbCache.questions = [formattedQ, ...dbCache.questions.filter((q) => q.id !== formattedQ.id)];
      saveLocalDatabase();

      const col = getMongoQuestionsCollection();
      if (col) {
        try {
          await col.updateOne({ id: formattedQ.id } as any, { $set: formattedQ }, { upsert: true });
          console.log(`[Local MongoDB] Created/Saved question "${formattedQ.question.substring(0, 25)}..."`);
        } catch (err) {
          console.error('[Local MongoDB] insertOne question error:', err);
        }
      }
      return formattedQ;
    },

    updateOne: async (id: string, update: Partial<Question>): Promise<Question | null> => {
      const index = dbCache.questions.findIndex((q) => q.id === id);
      let updatedQuestion: Question | null = null;
      if (index !== -1) {
        dbCache.questions[index] = {
          ...dbCache.questions[index],
          ...update,
        };
        updatedQuestion = dbCache.questions[index];
        saveLocalDatabase();
      }

      const col = getMongoQuestionsCollection();
      if (col) {
        try {
          await col.updateOne({ id } as any, { $set: update });
          const doc = await col.findOne({ id } as any);
          if (doc) {
            const { _id, ...rest } = doc as any;
            updatedQuestion = rest as Question;
          }
          console.log(`[Local MongoDB] Updated question ID ${id}`);
        } catch (err) {
          console.error('[Local MongoDB] updateOne question error:', err);
        }
      }

      return updatedQuestion;
    },

    deleteOne: async (id: string): Promise<boolean> => {
      const prevLen = dbCache.questions.length;
      dbCache.questions = dbCache.questions.filter((q) => q.id !== id);
      saveLocalDatabase();

      const col = getMongoQuestionsCollection();
      if (col) {
        try {
          const res = await col.deleteOne({ id } as any);
          console.log(`[Local MongoDB] Deleted question ID ${id}`);
          return res.deletedCount > 0;
        } catch (err) {
          console.error('[Local MongoDB] deleteOne question error:', err);
        }
      }
      return dbCache.questions.length < prevLen;
    },

    replaceMany: async (questions: Question[]): Promise<{ success: boolean; insertedCount: number; deletedCount: number; questions: Question[]; error?: string }> => {
      const pointsMap: Record<string, number> = { beginner: 2, easy: 4, moderate: 6, hard: 8, insane: 10 };
      const formatted: Question[] = questions.map((q, idx) => ({
        id: q.id || `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
        category: q.category || 'moderate',
        points: Number(q.points) || (pointsMap[q.category] || 6),
        question: String(q.question || '').trim(),
        answer: String(q.answer || '').trim(),
        hint: q.hint ? String(q.hint).trim() : undefined,
      }));
      dbCache.questions = formatted;
      saveLocalDatabase();
      const col = getMongoQuestionsCollection();
      let insertedCount = formatted.length;
      let deletedCount = 0;
      if (col) {
        try {
          const delRes = await col.deleteMany({});
          deletedCount = delRes?.deletedCount || 0;
          if (formatted.length > 0) {
            const insRes = await col.insertMany(formatted as any);
            insertedCount = insRes?.insertedCount || formatted.length;
          }
          console.log(`[Local MongoDB] Bulk replaced questions. Deleted: ${deletedCount}, Inserted: ${insertedCount}`);
          return { success: true, insertedCount, deletedCount, questions: formatted };
        } catch (err: any) {
          console.error('[Local MongoDB] replaceMany questions error:', err);
          return { success: false, insertedCount: 0, deletedCount: 0, questions: [], error: err?.message || 'MongoDB error' };
        }
      }
      return { success: true, insertedCount, deletedCount, questions: formatted };
    },
    insertMany: async (newQuestions: Question[]): Promise<{ success: boolean; insertedCount: number; questions: Question[]; error?: string }> => {
      const pointsMap: Record<string, number> = { beginner: 2, easy: 4, moderate: 6, hard: 8, insane: 10 };
      const formatted: Question[] = newQuestions.map((q, idx) => ({
        id: q.id || `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
        category: q.category || 'moderate',
        points: Number(q.points) || (pointsMap[q.category] || 6),
        question: String(q.question || '').trim(),
        answer: String(q.answer || '').trim(),
        hint: q.hint ? String(q.hint).trim() : undefined,
      }));
      dbCache.questions = [...formatted, ...dbCache.questions];
      saveLocalDatabase();
      const col = getMongoQuestionsCollection();
      let insertedCount = formatted.length;
      if (col && formatted.length > 0) {
        try {
          const res = await col.insertMany(formatted as any);
          insertedCount = res?.insertedCount || formatted.length;
          console.log(`[Local MongoDB] Bulk inserted ${insertedCount} questions into Local MongoDB.`);
          return { success: true, insertedCount, questions: formatted };
        } catch (err: any) {
          console.error('[Local MongoDB] insertMany questions error:', err);
          return { success: false, insertedCount: 0, questions: [], error: err?.message || 'MongoDB error' };
        }
      }
      return { success: true, insertedCount, questions: formatted };
    },
    clearAll: async (): Promise<boolean> => {
      dbCache.questions = [];
      saveLocalDatabase();

      const col = getMongoQuestionsCollection();
      if (col) {
        try {
          await col.deleteMany({});
          console.log('[Local MongoDB] Cleared all questions in Local MongoDB collection.');
          return true;
        } catch (err) {
          console.error('[Local MongoDB] clearAll questions error:', err);
        }
      }
      return true;
    },

    resetToDefault: async (): Promise<Question[]> => {
      dbCache.questions = [...DEFAULT_QUESTIONS];
      saveLocalDatabase();

      const col = getMongoQuestionsCollection();
      if (col) {
        try {
          await col.deleteMany({});
          if (DEFAULT_QUESTIONS.length > 0) {
            await col.insertMany(DEFAULT_QUESTIONS as any);
          }
          console.log(`[Local MongoDB] Reset questions collection to 50 defaults.`);
        } catch (err) {
          console.error('[Local MongoDB] resetToDefault questions error:', err);
        }
      }
      return dbCache.questions;
    },
  },

  // Games collection (Full CRUD for live and historical match records)
  games: {
    find: async (limit = 50): Promise<GameState[]> => {
      const col = getMongoGamesCollection();
      if (col) {
        try {
          const docs = await col.find({}).sort({ updatedAt: -1 }).limit(limit).toArray();
          return docs.map(({ _id, ...rest }: any) => rest as GameState);
        } catch (err) {
          console.error('[Local MongoDB] find games error:', err);
        }
      }
      return [...dbCache.games].reverse().slice(0, limit);
    },

    findOne: async (filter: { id?: string; active?: boolean }): Promise<GameState | null> => {
      const col = getMongoGamesCollection();
      if (col) {
        try {
          if (filter.id) {
            const doc = await col.findOne({ id: filter.id } as any);
            if (doc) {
              const { _id, ...rest } = doc as any;
              return rest as GameState;
            }
          } else {
            const docs = await col.find({}).sort({ updatedAt: -1 }).limit(1).toArray();
            if (docs.length > 0) {
              const { _id, ...rest } = docs[0] as any;
              return rest as GameState;
            }
          }
        } catch (err) {
          console.error('[Local MongoDB] findOne game error:', err);
        }
      }

      if (filter.id) {
        return dbCache.games.find((g) => g.id === filter.id) || null;
      }
      if (filter.active && dbCache.activeGameId) {
        return dbCache.games.find((g) => g.id === dbCache.activeGameId) || null;
      }
      return dbCache.games[dbCache.games.length - 1] || null;
    },

    insertOne: async (game: GameState): Promise<GameState> => {
      dbCache.games.push(game);
      dbCache.activeGameId = game.id;
      saveLocalDatabase();

      const col = getMongoGamesCollection();
      if (col) {
        try {
          await col.updateOne({ id: game.id } as any, { $set: game }, { upsert: true });
          console.log(`[Local MongoDB] Stored game session ${game.id} to Local MongoDB.`);
        } catch (err) {
          console.error('[Local MongoDB] insertOne game error:', err);
        }
      }
      return game;
    },

    updateOne: async (id: string, update: Partial<GameState>): Promise<GameState | null> => {
      const index = dbCache.games.findIndex((g) => g.id === id);
      let updatedGame: GameState | null = null;
      if (index !== -1) {
        dbCache.games[index] = {
          ...dbCache.games[index],
          ...update,
          updatedAt: Date.now(),
        };
        updatedGame = dbCache.games[index];
        saveLocalDatabase();
      }

      const col = getMongoGamesCollection();
      if (col) {
        try {
          await col.updateOne({ id } as any, { $set: { ...update, updatedAt: Date.now() } });
          const doc = await col.findOne({ id } as any);
          if (doc) {
            const { _id, ...rest } = doc as any;
            updatedGame = rest as GameState;
          }
        } catch (err) {
          console.error('[Local MongoDB] updateOne game error:', err);
        }
      }

      return updatedGame || (index !== -1 ? dbCache.games[index] : null);
    },

    deleteOne: async (id: string): Promise<boolean> => {
      const prevLen = dbCache.games.length;
      dbCache.games = dbCache.games.filter((g) => g.id !== id);
      if (dbCache.activeGameId === id) {
        dbCache.activeGameId = null;
      }
      saveLocalDatabase();

      const col = getMongoGamesCollection();
      if (col) {
        try {
          const res = await col.deleteOne({ id } as any);
          console.log(`[Local MongoDB] Deleted game record ${id}`);
          return res.deletedCount > 0;
        } catch (err) {
          console.error('[Local MongoDB] deleteOne game error:', err);
        }
      }
      return dbCache.games.length < prevLen;
    },

    clearHistory: async (): Promise<boolean> => {
      // Keep only active game if one exists
      if (dbCache.activeGameId) {
        const active = dbCache.games.find((g) => g.id === dbCache.activeGameId);
        dbCache.games = active ? [active] : [];
      } else {
        dbCache.games = [];
      }
      saveLocalDatabase();

      const col = getMongoGamesCollection();
      if (col) {
        try {
          if (dbCache.activeGameId) {
            await col.deleteMany({ id: { $ne: dbCache.activeGameId } } as any);
          } else {
            await col.deleteMany({});
          }
          console.log('[Local MongoDB] Cleared past game history.');
          return true;
        } catch (err) {
          console.error('[Local MongoDB] clearHistory games error:', err);
        }
      }
      return true;
    },

    getActiveGame: async (): Promise<GameState | null> => {
      if (dbCache.activeGameId === null) {
        return null;
      }

      if (dbCache.activeGameId) {
        const cached = dbCache.games.find((g) => g.id === dbCache.activeGameId);
        if (cached) return cached;
      }

      const col = getMongoGamesCollection();
      if (col && dbCache.activeGameId) {
        try {
          const doc = await col.findOne({ id: dbCache.activeGameId } as any);
          if (doc) {
            const { _id, ...rest } = doc as any;
            const fetched = rest as GameState;
            
            // Sync with local memory cache
            const cacheIndex = dbCache.games.findIndex((g) => g.id === fetched.id);
            if (cacheIndex !== -1) {
              dbCache.games[cacheIndex] = fetched;
            } else {
              dbCache.games.push(fetched);
            }
            return fetched;
          }
        } catch (err) {
          console.error('[Local MongoDB] getActiveGame error:', err);
        }
      }

      if (!dbCache.activeGameId) return null;
      return dbCache.games.find((g) => g.id === dbCache.activeGameId) || null;
    },

    setActiveGameId: async (id: string | null) => {
      dbCache.activeGameId = id;
      saveLocalDatabase();
    },
  },

  // Connection & Diagnostics
  getStatus: async () => {
    let pingResult: any = null;
    let questionsCount = 0;
    let gamesCount = 0;

    if (isConnectedToMongo && mongoDbInstance) {
      try {
        const pingStart = Date.now();
        await mongoDbInstance.admin().ping();
        const pingLatencyMs = Date.now() - pingStart;
        pingResult = { ok: 1, latencyMs: pingLatencyMs };

        const qCol = mongoDbInstance.collection('questions');
        const gCol = mongoDbInstance.collection('games');
        questionsCount = await qCol.countDocuments();
        gamesCount = await gCol.countDocuments();
      } catch (err: any) {
        pingResult = { ok: 0, error: err.message };
      }
    } else {
      questionsCount = dbCache.questions.length;
      gamesCount = dbCache.games.length;
    }

    // Mask URI for display
    let maskedUri = MONGODB_URI;
    try {
      maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ':****@');
    } catch {
      maskedUri = 'mongodb://127.0.0.1:27017/retro_quiz';
    }

    return {
      connected: isConnectedToMongo,
      mode: isConnectedToMongo ? 'local_mongodb' : 'local_storage_fallback',
      databaseName: isConnectedToMongo ? MONGODB_DB_NAME : 'local_json_db',
      isAtlasConfigured: false,
      isLocalMongo: true,
      uri: maskedUri,
      maskedUri,
      ping: pingResult,
      counts: {
        questions: questionsCount,
        games: gamesCount,
      },
      lastError: lastConnectionError,
    };
  },
};
