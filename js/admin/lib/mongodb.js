/**
 * MONGODB.JS - MongoDB Connection Utility
 * 
 * यह file MongoDB से connect करने के लिए helper functions provide करती है
 * Netlify functions और admin panel दोनों में use होगी
 */

// ===== 1. CONFIGURATION =====
// MongoDB connection string – Netlify environment variable से लेना है
// Local development के लिए यहाँ डाल सकते हो, पर GitHub पर push मत करना!
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://banashree-mobile:banashree678543@banashree-mobile.wps3lj8.mongodb.net/banashree?retryWrites=true&w=majority";
const DB_NAME = "banashree";

// Collection names
const COLLECTIONS = {
    PRODUCTS: "products",
    USERS: "users",
    CATEGORIES: "categories",
    SETTINGS: "settings"
};

// ===== 2. MONGO CLIENT IMPORT =====
// Netlify functions के लिए
let MongoClient;
let ObjectId;

// अगर Node.js environment में हैं
if (typeof require !== 'undefined') {
    const mongodb = require('mongodb');
    MongoClient = mongodb.MongoClient;
    ObjectId = mongodb.ObjectId;
} 
// Browser environment के लिए (admin panel में use होगा तो नहीं, फिर भी safe रहें)
else {
    console.warn('⚠️ MongoDB client is not available in browser environment');
    // Mock functions for browser
    MongoClient = { connect: () => { throw new Error('MongoDB not available in browser'); } };
    ObjectId = { createFromHexString: (id) => id };
}

// ===== 3. CONNECTION CACHE =====
// Netlify functions के लिए connection caching (performance boost)
let cachedClient = null;
let cachedDb = null;

// ===== 4. CONNECT TO DATABASE =====
/**
 * MongoDB से connect करता है
 * @returns {Promise<{client: MongoClient, db: Db}>}
 */
export async function connectToDatabase() {
    // अगर पहले से connection है तो reuse करो (Netlify functions के लिए)
    if (cachedClient && cachedDb) {
        console.log('✅ Using cached MongoDB connection');
        return { client: cachedClient, db: cachedDb };
    }

    try {
        console.log('🔄 Connecting to MongoDB Atlas...');
        
        // Connection options
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        // Connect to MongoDB
        const client = new MongoClient(MONGODB_URI, options);
        await client.connect();
        
        // Get database instance
        const db = client.db(DB_NAME);
        
        // Test connection
        await db.command({ ping: 1 });
        console.log('✅ Connected to MongoDB Atlas successfully');

        // Cache connection
        cachedClient = client;
        cachedDb = db;

        return { client, db };
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
}

// ===== 5. CLOSE CONNECTION =====
/**
 * MongoDB connection को close करता है
 * @param {MongoClient} client - MongoDB client instance
 */
export async function closeConnection(client) {
    try {
        if (client) {
            await client.close();
            console.log('🔒 MongoDB connection closed');
        }
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    }
}

// ===== 6. GET COLLECTION =====
/**
 * Specific collection का reference return करता है
 * @param {string} collectionName - Collection name
 * @returns {Promise<Collection>}
 */
export async function getCollection(collectionName) {
    const { db } = await connectToDatabase();
    return db.collection(collectionName);
}

// ===== 7. PRODUCT COLLECTION HELPERS =====

/**
 * सारे products लेता है
 * @param {Object} options - Query options (filter, sort, limit)
 * @returns {Promise<Array>}
 */
export async function getAllProducts(options = {}) {
    try {
        const collection = await getCollection(COLLECTIONS.PRODUCTS);
        
        const {
            filter = {},
            sort = { createdAt: -1 },
            limit = 1000,
            skip = 0
        } = options;

        const products = await collection
            .find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();

        return products;
    } catch (error) {
        console.error('Error getting products:', error);
        throw error;
    }
}

/**
 * Single product लेता है by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>}
 */
export async function getProductById(productId) {
    try {
        const collection = await getCollection(COLLECTIONS.PRODUCTS);
        
        let query;
        // Check if it's a valid ObjectId
        if (productId.match(/^[0-9a-fA-F]{24}$/)) {
            query = { _id: new ObjectId(productId) };
        } else {
            query = { id: productId }; // string ID के लिए
        }

        const product = await collection.findOne(query);
        return product;
    } catch (error) {
        console.error('Error getting product:', error);
        throw error;
    }
}

/**
 * नया product add करता है
 * @param {Object} productData - Product data
 * @returns {Promise<Object>}
 */
export async function addProduct(productData) {
    try {
        const collection = await getCollection(COLLECTIONS.PRODUCTS);
        
        // Add timestamps
        const newProduct = {
            ...productData,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collection.insertOne(newProduct);
        
        return {
            ...newProduct,
            _id: result.insertedId
        };
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
}

/**
 * Product update करता है
 * @param {string} productId - Product ID
 * @param {Object} productData - Updated product data
 * @returns {Promise<Object>}
 */
export async function updateProduct(productId, productData) {
    try {
        const collection = await getCollection(COLLECTIONS.PRODUCTS);
        
        // Remove _id from update data if present
        const { _id, ...updateData } = productData;
        
        // Add updated timestamp
        updateData.updatedAt = new Date();

        let query;
        if (productId.match(/^[0-9a-fA-F]{24}$/)) {
            query = { _id: new ObjectId(productId) };
        } else {
            query = { id: productId };
        }

        const result = await collection.updateOne(
            query,
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            throw new Error('Product not found');
        }

        return await getProductById(productId);
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
}

/**
 * Product delete करता है
 * @param {string} productId - Product ID
 * @returns {Promise<boolean>}
 */
export async function deleteProduct(productId) {
    try {
        const collection = await getCollection(COLLECTIONS.PRODUCTS);
        
        let query;
        if (productId.match(/^[0-9a-fA-F]{24}$/)) {
            query = { _id: new ObjectId(productId) };
        } else {
            query = { id: productId };
        }

        const result = await collection.deleteOne(query);
        
        return result.deletedCount > 0;
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
}

// ===== 8. CATEGORY HELPERS =====

/**
 * सारी categories लेता है
 * @returns {Promise<Array>}
 */
export async function getAllCategories() {
    try {
        const collection = await getCollection(COLLECTIONS.CATEGORIES);
        const categories = await collection.find({}).toArray();
        return categories;
    } catch (error) {
        console.error('Error getting categories:', error);
        return [];
    }
}

// ===== 9. USER HELPERS =====

/**
 * User को email से ढूंढता है (authentication के लिए)
 * @param {string} email - User email
 * @returns {Promise<Object>}
 */
export async function getUserByEmail(email) {
    try {
        const collection = await getCollection(COLLECTIONS.USERS);
        const user = await collection.findOne({ email });
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/**
 * नया user create करता है (signup के लिए)
 * @param {Object} userData - User data
 * @returns {Promise<Object>}
 */
export async function createUser(userData) {
    try {
        const collection = await getCollection(COLLECTIONS.USERS);
        
        const newUser = {
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date(),
            role: userData.role || 'viewer'
        };

        const result = await collection.insertOne(newUser);
        
        return {
            ...newUser,
            _id: result.insertedId
        };
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// ===== 10. UTILITY FUNCTIONS =====

/**
 * MongoDB ObjectId create करता है
 * @param {string} id - String ID
 * @returns {ObjectId}
 */
export function createObjectId(id) {
    try {
        return new ObjectId(id);
    } catch (error) {
        return id;
    }
}

/**
 * Check if string is valid ObjectId
 * @param {string} id - String to check
 * @returns {boolean}
 */
export function isValidObjectId(id) {
    return ObjectId.isValid(id);
}

/**
 * Format product for API response
 * @param {Object} product - Product from MongoDB
 * @returns {Object}
 */
export function formatProduct(product) {
    if (!product) return null;
    
    // Convert _id to string
    const { _id, ...rest } = product;
    
    return {
        ...rest,
        id: _id.toString(),
        _id: _id.toString()
    };
}

// ===== 11. DEFAULT EXPORT =====
export default {
    connectToDatabase,
    closeConnection,
    getCollection,
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    getAllCategories,
    getUserByEmail,
    createUser,
    createObjectId,
    isValidObjectId,
    formatProduct,
    COLLECTIONS,
    DB_NAME
};