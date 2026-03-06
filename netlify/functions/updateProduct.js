/**
 * UPDATEPRODUCT.JS - Netlify Function
 * 
 * MongoDB में existing product update करता है
 * API Endpoint: /.netlify/functions/updateProduct
 */

// ===== 1. IMPORTS =====
const { connectToDatabase, COLLECTIONS, isValidObjectId } = require('./utils/mongodb');
const crypto = require('crypto');

// ===== 2. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS',
    'Content-Type': 'application/json'
};

// ===== 3. AUTHENTICATION CHECK =====
function isAuthorized(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader) return false;
    
    const token = authHeader.replace('Bearer ', '');
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

// ===== 5. VALIDATE UPDATE DATA =====
function validateUpdateData(data, isPatch = false) {
    const errors = [];

    // For PUT requests (full update), required fields check
    if (!isPatch) {
        if (!data.name) errors.push('Product name is required');
        if (!data.brand) errors.push('Brand is required');
        if (!data.category) errors.push('Category is required');
        if (!data.price && data.price !== 0) errors.push('Price is required');
    }

    // Price validation (if provided)
    if (data.price !== undefined) {
        if (isNaN(data.price) || data.price < 0) {
            errors.push('Price must be a positive number');
        }
    }

    // Discount validation (if provided)
    if (data.discount !== undefined) {
        if (isNaN(data.discount) || data.discount < 0 || data.discount > 100) {
            errors.push('Discount must be between 0 and 100');
        }
    }

    // RAM validation (if provided)
    if (data.ram && typeof data.ram !== 'string') {
        errors.push('RAM must be a string (e.g., "8 GB")');
    }

    // Storage validation (if provided)
    if (data.storage && typeof data.storage !== 'string') {
        errors.push('Storage must be a string (e.g., "128 GB")');
    }

    // Status validation (if provided)
    if (data.status && !['active', 'inactive', 'draft'].includes(data.status)) {
        errors.push('Status must be active, inactive, or draft');
    }

    return errors;
}

// ===== 6. BUILD UPDATE QUERY =====
function buildUpdateQuery(productId) {
    if (isValidObjectId(productId)) {
        const { ObjectId } = require('mongodb');
        return { _id: new ObjectId(productId) };
    } else {
        return { id: productId };
    }
}

// ===== 7. PREPARE UPDATE DATA =====
function prepareUpdateData(data, isPatch = false) {
    const updateData = { ...data };
    
    // Remove _id and id from update data
    delete updateData._id;
    delete updateData.id;
    
    // Add updated timestamp
    updateData.updatedAt = new Date().toISOString();
    
    // Handle variants if price/ram/storage/discount changed
    if (data.price !== undefined || data.ram !== undefined || 
        data.storage !== undefined || data.discount !== undefined) {
        
        const variant = updateData.variants?.[0] || {};
        
        updateData.variants = [{
            id: variant.id || `${data.storage || '128GB'}-${data.ram || '8GB'}`,
            ram: data.ram || variant.ram || '8 GB',
            storage: data.storage || variant.storage || '128 GB',
            price: data.price !== undefined ? parseFloat(data.price) : (variant.price || 0),
            discount: data.discount !== undefined ? parseFloat(data.discount) : (variant.discount || 0),
            available: variant.available !== undefined ? variant.available : true
        }];
        
        // Update default variant
        updateData.default = {
            color: updateData.default?.color || "",
            variant: updateData.variants[0].id
        };
    }
    
    // Handle specs if any spec fields changed
    if (data.processor !== undefined || data.camera !== undefined ||
        data.battery !== undefined || data.display !== undefined ||
        data.description !== undefined) {
        
        updateData.specs = {
            Processor: data.processor || updateData.specs?.Processor || '',
            Camera: data.camera || updateData.specs?.Camera || '',
            Battery: data.battery || updateData.specs?.Battery || '',
            Display: data.display || updateData.specs?.Display || '',
            Description: data.description || updateData.specs?.Description || ''
        };
    }
    
    return updateData;
}

// ===== 8. LOG UPDATE OPERATION (OPTIONAL) =====
async function logUpdateOperation(db, productId, oldProduct, newData, user) {
    try {
        const logsCollection = db.collection('update_logs');
        await logsCollection.insertOne({
            productId,
            oldProduct,
            newData,
            updatedBy: user || 'unknown',
            updatedAt: new Date(),
            action: 'UPDATE'
        });
    } catch (error) {
        console.warn('Failed to log update operation:', error);
    }
}

// ===== 9. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('🔄 updateProduct function invoked');
    console.log('HTTP Method:', event.httpMethod);

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow PUT or PATCH requests
    if (event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed. Use PUT or PATCH.' 
            })
        };
    }

    const isPatch = event.httpMethod === 'PATCH';

    // ===== 10. AUTHENTICATION CHECK =====
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
        // ===== 11. GET PRODUCT ID FROM QUERY PARAMETERS =====
        const params = event.queryStringParameters || {};
        let productId = params.id;
        
        // ===== 12. PARSE REQUEST BODY =====
        let updateData;
        try {
            updateData = JSON.parse(event.body);
            
            // If ID is in body, use it (but query param takes precedence)
            if (!productId && updateData.id) {
                productId = updateData.id;
            } else if (!productId && updateData._id) {
                productId = updateData._id;
            }
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

        console.log('Updating product:', productId);
        console.log('Update data:', JSON.stringify(updateData, null, 2));

        // ===== 13. VALIDATE PRODUCT ID =====
        const idValidationErrors = validateProductId(productId);
        if (idValidationErrors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Validation failed',
                    errors: idValidationErrors
                })
            };
        }

        // ===== 14. VALIDATE UPDATE DATA =====
        const dataValidationErrors = validateUpdateData(updateData, isPatch);
        if (dataValidationErrors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Validation failed',
                    errors: dataValidationErrors
                })
            };
        }

        // ===== 15. CONNECT TO DATABASE =====
        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTIONS.PRODUCTS);

        // ===== 16. BUILD QUERY =====
        const updateQuery = buildUpdateQuery(productId);

        // ===== 17. FIND PRODUCT BEFORE UPDATING =====
        const oldProduct = await collection.findOne(updateQuery);

        if (!oldProduct) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product not found',
                    productId
                })
            };
        }

        // ===== 18. PREPARE UPDATE DATA =====
        const preparedData = prepareUpdateData(updateData, isPatch);

        // ===== 19. UPDATE THE PRODUCT =====
        const result = await collection.updateOne(
            updateQuery,
            { $set: preparedData }
        );

        if (result.matchedCount === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product not found',
                    productId
                })
            };
        }

        // ===== 20. FETCH UPDATED PRODUCT =====
        const updatedProduct = await collection.findOne(updateQuery);

        console.log(`✅ Product updated successfully: ${updatedProduct.name} (${productId})`);

        // ===== 21. LOG UPDATE OPERATION =====
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const user = authHeader ? 'admin' : 'unknown';
        await logUpdateOperation(db, productId, oldProduct, preparedData, user);

        // ===== 22. FORMAT RESPONSE =====
        const { _id, ...rest } = updatedProduct;
        const formattedProduct = {
            ...rest,
            id: _id.toString(),
            _id: _id.toString()
        };

        // ===== 23. RETURN SUCCESS RESPONSE =====
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: isPatch ? 'Product patched successfully' : 'Product updated successfully',
                product: formattedProduct,
                changes: {
                    old: {
                        name: oldProduct.name,
                        price: oldProduct.variants?.[0]?.price,
                        discount: oldProduct.variants?.[0]?.discount
                    },
                    new: {
                        name: updatedProduct.name,
                        price: updatedProduct.variants?.[0]?.price,
                        discount: updatedProduct.variants?.[0]?.discount
                    }
                }
            })
        };

    } catch (error) {
        console.error('❌ Error in updateProduct:', error);

        // ===== 24. RETURN ERROR RESPONSE =====
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to update product',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};