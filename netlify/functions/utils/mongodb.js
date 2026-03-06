/**
 * MONGODB.JS - Shared MongoDB Connection Utility for Netlify Functions
 * 
 * यह file सभी Netlify functions के लिए common MongoDB connection provide करती है
 * Connection caching के साथ – Netlify functions के लिए optimized
 */

// ===== 1. IMPORTS =====
const { MongoClient, ObjectId } = require('mongodb');

// ===== 2. CONFIGURATION =====
// MongoDB connection string – Netlify environment variable से लेना है
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is not set');
}

// Database name – URI से extract करें या default use करें
function getDbNameFromUri(uri) {
    try {
        // Extract database name from URI (last part before ?)
        const match = uri.match(/\/([^\/\?]+)(\?|$)/);
        return match ? match[1] : 'banashree';
    } catch (error) {
        return 'banashree';
    }
}

const DB_NAME = getDbNameFromUri(MONGODB_URI);

// Collection names
const COLLECTIONS = {
    PRODUCTS: 'products',
    USERS: 'users',
    CATEGORIES: 'categories',
    SETTINGS: 'settings',
    LOGS: 'logs'
};

// ===== 3. CONNECTION CACHING =====
// Netlify functions के लिए connection caching (warm starts के लिए important)
let cachedClient = null;
let cachedDb = null;
let connectionPromise = null;

// Connection options
const CONNECTION_OPTIONS = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 10000,
    retryWrites: true,
    retryReads: true
};

// ===== 4. CONNECT TO DATABASE =====
/**
 * MongoDB से connect करता है (with caching)
 * @returns {Promise<{client: MongoClient, db: Db}>}
 */
async function connectToDatabase() {
    // Agar पहले से connection है तो reuse करो
    if (cachedClient && cachedDb) {
        console.log('✅ Using cached MongoDB connection');
        
        // Check if connection is still alive
        try {
            await cachedDb.command({ ping: 1 });
            return { client: cachedClient, db: cachedDb };
        } catch (error) {
            console.log('⚠️ Cached connection failed, creating new one');
            cachedClient = null;
            cachedDb = null;
        }
    }

    // Agar connection already in progress है तो उसे return करो
    if (connectionPromise) {
        console.log('⏳ Waiting for existing connection...');
        return connectionPromise;
    }

    // नया connection बनाओ
    console.log('🔄 Creating new MongoDB connection...');
    
    connectionPromise = (async () => {
        try {
            if (!MONGODB_URI) {
                throw new Error('MONGODB_URI environment variable is not set');
            }

            const client = new MongoClient(MONGODB_URI, CONNECTION_OPTIONS);
            await client.connect();
            
            const db = client.db(DB_NAME);
            
            // Test connection
            await db.command({ ping: 1 });
            
            console.log(`✅ Connected to MongoDB Atlas (${DB_NAME})`);

            // Cache connection
            cachedClient = client;
            cachedDb = db;

            return { client, db };
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
            throw error;
        } finally {
            connectionPromise = null;
        }
    })();

    return connectionPromise;
}

// ===== 5. CLOSE CONNECTION =====
/**
 * MongoDB connection को close करता है
 * @param {MongoClient} client - MongoDB client instance
 */
async function closeConnection(client) {
    try {
        if (client) {
            await client.close();
            console.log('🔒 MongoDB connection closed');
            
            // Clear cache if it's the cached client
            if (client === cachedClient) {
                cachedClient = null;
                cachedDb = null;
            }
        }
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    }
}

// ===== 6. WITH CONNECTION WRAPPER =====
/**
 * Function को connection के साथ wrap करता है
 * @param {Function} callback - Function जो (db, client) receive करेगा
 * @returns {Promise<any>}
 */
async function withConnection(callback) {
    const { db, client } = await connectToDatabase();
    try {
        return await callback(db, client);
    } finally {
        // Don't close connection here – let it cache
    }
}

// ===== 7. GET COLLECTION =====
/**
 * Specific collection का reference return करता है
 * @param {string} collectionName - Collection name
 * @returns {Promise<Collection>}
 */
async function getCollection(collectionName) {
    const { db } = await connectToDatabase();
    return db.collection(collectionName);
}

// ===== 8. HEALTH CHECK =====
/**
 * Database connection health check
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
    try {
        const { db } = await connectToDatabase();
        await db.command({ ping: 1 });
        return true;
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
}

// ===== 9. OBJECT ID HELPERS =====
/**
 * Valid ObjectId है या नहीं check करता है
 * @param {string} id - ID to check
 * @returns {boolean}
 */
function isValidObjectId(id) {
    return ObjectId.isValid(id);
}

/**
 * ObjectId create करता है
 * @param {string} id - String ID
 * @returns {ObjectId}
 */
function createObjectId(id) {
    try {
        return new ObjectId(id);
    } catch (error) {
        return id; // Return as is if not valid ObjectId
    }
}

/**
 * MongoDB document को format करता है (string IDs के साथ)
 * @param {Object} doc - MongoDB document
 * @returns {Object}
 */
function formatDocument(doc) {
    if (!doc) return null;
    
    const { _id, ...rest } = doc;
    return {
        ...rest,
        id: _id.toString(),
        _id: _id.toString()
    };
}

/**
 * Multiple documents को format करता है
 * @param {Array} docs - Array of MongoDB documents
 * @returns {Array}
 */
function formatDocuments(docs) {
    return docs.map(doc => formatDocument(doc));
}

// ===== 10. COLLECTION SPECIFIC HELPERS =====

// Products
async function getProductsCollection() {
    return getCollection(COLLECTIONS.PRODUCTS);
}

async function getUsersCollection() {
    return getCollection(COLLECTIONS.USERS);
}

async function getCategoriesCollection() {
    return getCollection(COLLECTIONS.CATEGORIES);
}

// ===== 11. TRANSACTION HELPERS =====
/**
 * Transaction के साथ operation execute करता है
 * @param {Function} callback - Transaction callback
 */
async function withTransaction(callback) {
    const { client } = await connectToDatabase();
    const session = client.startSession();
    
    try {
        session.startTransaction();
        const result = await callback(session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

// ===== 12. PAGINATION HELPER =====
/**
 * Paginated query build करता है
 * @param {Object} options - Query options
 * @returns {Object} - Query with pagination
 */
function buildPaginatedQuery(options = {}) {
    const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 },
        filter = {}
    } = options;

    const skip = (page - 1) * limit;

    return {
        filter,
        sort,
        skip,
        limit,
        page,
        hasNextPage: false // Will be set after query
    };
}

// ===== 13. ERROR HANDLING =====
/**
 * MongoDB errors को handle करता है
 * @param {Error} error - MongoDB error
 * @returns {Object} - Formatted error
 */
function handleMongoError(error) {
    console.error('MongoDB Error:', error);

    if (error.code === 11000) {
        return {
            status: 409,
            message: 'Duplicate key error',
            details: error.keyValue
        };
    }

    if (error.name === 'MongoNetworkError') {
        return {
            status: 503,
            message: 'Database network error'
        };
    }

    if (error.name === 'MongoTimeoutError') {
        return {
            status: 504,
            message: 'Database timeout'
        };
    }

    return {
        status: 500,
        message: error.message || 'Database error'
    };
}

// ===== 14. EXPORTS =====
module.exports = {
    // Core connection
    connectToDatabase,
    closeConnection,
    withConnection,
    healthCheck,
    
    // Collection getters
    getCollection,
    getProductsCollection,
    getUsersCollection,
    getCategoriesCollection,
    
    // ObjectId helpers
    isValidObjectId,
    createObjectId,
    formatDocument,
    formatDocuments,
    
    // Transaction
    withTransaction,
    
    // Query helpers
    buildPaginatedQuery,
    
    // Error handling
    handleMongoError,
    
    // Constants
    COLLECTIONS,
    DB_NAME
};