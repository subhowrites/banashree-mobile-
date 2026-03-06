/**
 * DELETEPRODUCT.JS - Netlify Function
 * 
 * MongoDB से product delete करता है
 * API Endpoint: /.netlify/functions/deleteProduct
 */

// ===== 1. IMPORTS =====
const { connectToDatabase, COLLECTIONS, isValidObjectId } = require('./utils/mongodb');
const crypto = require('crypto');

// ===== 2. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// ===== 3. AUTHENTICATION CHECK =====
function isAuthorized(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader) return false;
    
    // Check if it's a valid token (simplified)
    const token = authHeader.replace('Bearer ', '');
    
    // In production, you would verify JWT token here
    // For now, we'll just check if token exists and is reasonably long
    return token && token.length > 20;
}

// ===== 4. VALIDATE PRODUCT ID =====
function validateProductId(productId) {
    const errors = [];

    if (!productId) {
        errors.push('Product ID is required');
    } else if (typeof productId !== 'string') {
        errors.push('Product ID must be a string');
    } else if (productId.length < 5) {
        errors.push('Product ID is too short');
    }

    return errors;
}

// ===== 5. BUILD DELETE QUERY =====
function buildDeleteQuery(productId) {
    // Check if it's a valid MongoDB ObjectId
    if (isValidObjectId(productId)) {
        const { ObjectId } = require('mongodb');
        return { _id: new ObjectId(productId) };
    } else {
        // Fallback to string ID (for custom IDs)
        return { id: productId };
    }
}

// ===== 6. LOG DELETE OPERATION (OPTIONAL) =====
async function logDeleteOperation(db, productId, deletedProduct, user) {
    try {
        const logsCollection = db.collection('delete_logs');
        await logsCollection.insertOne({
            productId,
            deletedProduct,
            deletedBy: user || 'unknown',
            deletedAt: new Date(),
            action: 'DELETE'
        });
    } catch (error) {
        console.warn('Failed to log delete operation:', error);
        // Don't throw error, just log it
    }
}

// ===== 7. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('🗑️ deleteProduct function invoked');

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow DELETE requests
    if (event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed. Use DELETE.' 
            })
        };
    }

    // ===== 8. AUTHENTICATION CHECK =====
    if (!isAuthorized(event)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Unauthorized. Valid token required.'
            })
        };
    }

    try {
        // ===== 9. GET PRODUCT ID FROM QUERY PARAMETERS =====
        const params = event.queryStringParameters || {};
        const productId = params.id;
        
        // Also check if ID is in the request body (for DELETE with body)
        let bodyProductId = null;
        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                bodyProductId = body.id || body.productId;
            } catch (e) {
                // Ignore body parsing errors
            }
        }

        const finalProductId = productId || bodyProductId;

        console.log('Deleting product with ID:', finalProductId);

        // ===== 10. VALIDATE PRODUCT ID =====
        const validationErrors = validateProductId(finalProductId);
        if (validationErrors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Validation failed',
                    errors: validationErrors
                })
            };
        }

        // ===== 11. CONNECT TO DATABASE =====
        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTIONS.PRODUCTS);

        // ===== 12. BUILD DELETE QUERY =====
        const deleteQuery = buildDeleteQuery(finalProductId);

        // ===== 13. FIND PRODUCT BEFORE DELETING (for response and logging) =====
        const productToDelete = await collection.findOne(deleteQuery);

        if (!productToDelete) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product not found',
                    productId: finalProductId
                })
            };
        }

        // ===== 14. CHECK IF USER HAS PERMISSION TO DELETE THIS PRODUCT =====
        // You can add additional checks here, e.g., user role, product ownership, etc.
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const user = authHeader ? 'admin' : 'unknown';

        // ===== 15. DELETE THE PRODUCT =====
        const result = await collection.deleteOne(deleteQuery);

        if (result.deletedCount === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product not found or already deleted',
                    productId: finalProductId
                })
            };
        }

        console.log(`✅ Product deleted successfully: ${productToDelete.name} (${finalProductId})`);

        // ===== 16. LOG DELETE OPERATION (OPTIONAL) =====
        await logDeleteOperation(db, finalProductId, productToDelete, user);

        // ===== 17. RETURN SUCCESS RESPONSE =====
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Product deleted successfully',
                deletedProduct: {
                    id: finalProductId,
                    name: productToDelete.name,
                    brand: productToDelete.brand,
                    category: productToDelete.category
                },
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Error in deleteProduct:', error);

        // ===== 18. RETURN ERROR RESPONSE =====
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to delete product',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};