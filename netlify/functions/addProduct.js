/**
 * ADDPRODUCT.JS - Netlify Function
 * 
 * MongoDB में नया product add करता है
 * API Endpoint: /.netlify/functions/addProduct
 */

// ===== 1. IMPORTS =====
const { connectToDatabase, COLLECTIONS } = require('./utils/mongodb');
const crypto = require('crypto');

// ===== 2. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// ===== 3. VALIDATION FUNCTION =====
function validateProduct(data) {
    const errors = [];

    // Required fields
    if (!data.name) errors.push('Product name is required');
    if (!data.brand) errors.push('Brand is required');
    if (!data.category) errors.push('Category is required');
    
    // Price validation
    if (!data.price && data.price !== 0) {
        errors.push('Price is required');
    } else if (isNaN(data.price) || data.price < 0) {
        errors.push('Price must be a positive number');
    }

    // Discount validation
    if (data.discount) {
        if (isNaN(data.discount) || data.discount < 0 || data.discount > 100) {
            errors.push('Discount must be between 0 and 100');
        }
    }

    // RAM and Storage validation
    if (data.ram && typeof data.ram !== 'string') {
        errors.push('RAM must be a string (e.g., "8 GB")');
    }
    if (data.storage && typeof data.storage !== 'string') {
        errors.push('Storage must be a string (e.g., "128 GB")');
    }

    return errors;
}

// ===== 4. GENERATE VARIANT ID =====
function generateVariantId(storage, ram) {
    const storageClean = storage.replace(/\s+/g, '');
    const ramClean = ram.replace(/\s+/g, '');
    return `${storageClean}-${ramClean}`;
}

// ===== 5. CREATE PRODUCT OBJECT =====
function createProductObject(data) {
    const variantId = generateVariantId(
        data.storage || '128 GB',
        data.ram || '8 GB'
    );

    const product = {
        name: data.name,
        brand: data.brand,
        category: data.category,
        image: data.image || 'https://via.placeholder.com/400x400?text=No+Image',
        colors: data.colors || [],
        variants: [{
            id: variantId,
            ram: data.ram || '8 GB',
            storage: data.storage || '128 GB',
            price: parseFloat(data.price),
            discount: parseFloat(data.discount) || 0,
            available: true
        }],
        default: {
            color: "",
            variant: variantId
        },
        specs: {
            Processor: data.processor || '',
            Camera: data.camera || '',
            Battery: data.battery || '',
            Display: data.display || '',
            Description: data.description || ''
        },
        tags: data.tags || [],
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    return product;
}

// ===== 6. AUTHENTICATION CHECK =====
function isAuthorized(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader) return false;
    
    // Check if it's a valid token (simplified)
    // In production, use proper JWT verification
    const token = authHeader.replace('Bearer ', '');
    
    // For now, just check if token exists
    // You'll implement proper auth later
    return token && token.length > 0;
}

// ===== 7. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('📝 addProduct function invoked');

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed. Use POST.' 
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
        // ===== 9. PARSE REQUEST BODY =====
        let productData;
        try {
            productData = JSON.parse(event.body);
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid JSON in request body'
                })
            };
        }

        console.log('Received product data:', JSON.stringify(productData, null, 2));

        // ===== 10. VALIDATE PRODUCT DATA =====
        const validationErrors = validateProduct(productData);
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

        // ===== 12. CHECK FOR DUPLICATE (OPTIONAL) =====
        const existingProduct = await collection.findOne({
            name: productData.name,
            brand: productData.brand
        });

        if (existingProduct) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product with same name and brand already exists',
                    existingProductId: existingProduct._id.toString()
                })
            };
        }

        // ===== 13. CREATE PRODUCT OBJECT =====
        const newProduct = createProductObject(productData);

        // ===== 14. INSERT INTO DATABASE =====
        const result = await collection.insertOne(newProduct);

        console.log(`✅ Product added successfully with ID: ${result.insertedId}`);

        // ===== 15. RETURN SUCCESS RESPONSE =====
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Product added successfully',
                product: {
                    ...newProduct,
                    _id: result.insertedId.toString(),
                    id: result.insertedId.toString()
                }
            })
        };

    } catch (error) {
        console.error('❌ Error in addProduct:', error);

        // ===== 16. RETURN ERROR RESPONSE =====
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to add product',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};