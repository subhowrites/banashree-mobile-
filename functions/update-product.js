/**
 * UPDATE-PRODUCT.JS - Netlify Function
 * 
 * GitHub repository में existing product update करता है
 * API Endpoint: /.netlify/functions/update-product
 */

// ===== 1. IMPORTS =====
const { 
    writeFile, 
    readFile,
    getProductPath,
    handleGitHubError 
} = require('./utils/github-api');

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
    return token && token.length > 10;
}

// ===== 4. VALIDATE PRODUCT ID =====
function validateProductId(productId) {
    const errors = [];

    if (!productId) {
        errors.push('Product ID is required');
    } else if (typeof productId !== 'string') {
        errors.push('Product ID must be a string');
    } else if (productId.length < 2) {
        errors.push('Product ID is too short');
    }

    return errors;
}

// ===== 5. VALIDATE SHA =====
function validateSha(sha) {
    const errors = [];

    if (!sha) {
        errors.push('File SHA is required for update');
    } else if (typeof sha !== 'string') {
        errors.push('SHA must be a string');
    } else if (sha.length < 10) {
        errors.push('Invalid SHA format');
    }

    return errors;
}

// ===== 6. VALIDATE UPDATE DATA =====
function validateUpdateData(data, isPatch = false) {
    const errors = [];

    // For PUT requests (full update), required fields check
    if (!isPatch) {
        if (!data.name) errors.push('Product name is required');
        if (!data.brand) errors.push('Brand is required');
        if (!data.category) errors.push('Category is required');
        if (data.price === undefined || data.price === null) {
            errors.push('Price is required');
        }
    }

    // Price validation (if provided)
    if (data.price !== undefined && data.price !== null) {
        if (isNaN(data.price) || data.price < 0) {
            errors.push('Price must be a positive number');
        }
    }

    // Discount validation (if provided)
    if (data.discount !== undefined && data.discount !== null) {
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

// ===== 7. GENERATE VARIANT ID =====
function generateVariantId(storage, ram) {
    const storageClean = storage.replace(/\s+/g, '');
    const ramClean = ram.replace(/\s+/g, '');
    return `${storageClean}-${ramClean}`;
}

// ===== 8. PREPARE UPDATE DATA =====
function prepareUpdateData(existingProduct, newData, isPatch = false) {
    let updatedProduct = { ...existingProduct };
    
    if (isPatch) {
        // PATCH - only update provided fields
        updatedProduct = {
            ...existingProduct,
            ...newData
        };
    } else {
        // PUT - full update
        updatedProduct = {
            id: existingProduct.id,
            name: newData.name,
            brand: newData.brand,
            category: newData.category,
            image: newData.image || existingProduct.image || 'https://via.placeholder.com/400x400?text=No+Image',
            colors: newData.colors || existingProduct.colors || [],
            variants: existingProduct.variants || [],
            default: existingProduct.default || { color: "", variant: "" },
            specs: existingProduct.specs || {},
            tags: newData.tags || existingProduct.tags || [],
            status: newData.status || existingProduct.status || 'active',
            createdAt: existingProduct.createdAt,
            updatedAt: new Date().toISOString()
        };
    }
    
    // Handle variants update
    if (newData.price !== undefined || newData.ram !== undefined || 
        newData.storage !== undefined || newData.discount !== undefined) {
        
        const variantId = generateVariantId(
            newData.storage || updatedProduct.variants[0]?.storage || '128 GB',
            newData.ram || updatedProduct.variants[0]?.ram || '8 GB'
        );
        
        updatedProduct.variants = [{
            id: variantId,
            ram: newData.ram || updatedProduct.variants[0]?.ram || '8 GB',
            storage: newData.storage || updatedProduct.variants[0]?.storage || '128 GB',
            price: newData.price !== undefined ? parseFloat(newData.price) : (updatedProduct.variants[0]?.price || 0),
            discount: newData.discount !== undefined ? parseFloat(newData.discount) : (updatedProduct.variants[0]?.discount || 0),
            available: true
        }];
        
        updatedProduct.default = {
            color: updatedProduct.default?.color || "",
            variant: variantId
        };
    }
    
    // Handle specs update
    if (newData.processor !== undefined || newData.camera !== undefined ||
        newData.battery !== undefined || newData.display !== undefined ||
        newData.description !== undefined) {
        
        updatedProduct.specs = {
            Processor: newData.processor || updatedProduct.specs?.Processor || '',
            Camera: newData.camera || updatedProduct.specs?.Camera || '',
            Battery: newData.battery || updatedProduct.specs?.Battery || '',
            Display: newData.display || updatedProduct.specs?.Display || '',
            Description: newData.description || updatedProduct.specs?.Description || ''
        };
    }
    
    updatedProduct.updatedAt = new Date().toISOString();
    
    return updatedProduct;
}

// ===== 9. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('🔄 update-product function invoked');
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
        // ===== 11. GET PARAMETERS =====
        const params = event.queryStringParameters || {};
        let productId = params.id;
        let fileSha = params.sha;
        let filePath = params.path;
        
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
            
            if (!fileSha && updateData.sha) {
                fileSha = updateData.sha;
            }
            
            if (!filePath && updateData.path) {
                filePath = updateData.path;
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

        console.log('Update request:', { productId, fileSha, filePath, isPatch });

        // ===== 13. VALIDATE INPUTS =====
        const idErrors = validateProductId(productId);
        if (idErrors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Validation failed',
                    errors: idErrors
                })
            };
        }

        // SHA validation
        if (!fileSha) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'File SHA is required for update',
                    message: 'Please provide the file SHA. This prevents accidental overwrites.'
                })
            };
        }

        const shaErrors = validateSha(fileSha);
        if (shaErrors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid SHA',
                    errors: shaErrors
                })
            };
        }

        // Path validation
        if (!filePath) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'File path is required',
                    message: 'Please provide the file path for the product to update.'
                })
            };
        }

        // ===== 14. VALIDATE UPDATE DATA =====
        const dataErrors = validateUpdateData(updateData, isPatch);
        if (dataErrors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Validation failed',
                    errors: dataErrors
                })
            };
        }

        // ===== 15. READ EXISTING FILE =====
        const existingFile = await readFile(filePath);
        
        if (!existingFile) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product not found',
                    message: `No product found at path: ${filePath}`
                })
            };
        }

        // Verify SHA matches (prevent accidental overwrite of updated file)
        if (existingFile.sha !== fileSha) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'SHA mismatch',
                    message: 'The file has been modified since you loaded it. Please refresh and try again.',
                    currentSha: existingFile.sha,
                    providedSha: fileSha
                })
            };
        }

        console.log(`✅ File verified: ${filePath} (SHA: ${fileSha})`);

        // ===== 16. PREPARE UPDATED PRODUCT =====
        const existingProduct = existingFile.content;
        const updatedProduct = prepareUpdateData(existingProduct, updateData, isPatch);

        // ===== 17. WRITE UPDATED FILE TO GITHUB =====
        const commitMessage = isPatch 
            ? `Update product (patch): ${updatedProduct.name}`
            : `Update product: ${updatedProduct.name}`;
            
        const result = await writeFile(filePath, updatedProduct, fileSha, commitMessage);
        
        console.log(`✅ Product updated successfully: ${filePath} (new SHA: ${result.sha})`);

        // ===== 18. PREPARE RESPONSE =====
        const responseData = {
            success: true,
            message: isPatch ? 'Product patched successfully' : 'Product updated successfully',
            product: {
                ...updatedProduct,
                sha: result.sha,
                path: filePath,
                previousSha: fileSha
            },
            changes: {
                old: {
                    name: existingProduct.name,
                    price: existingProduct.variants?.[0]?.price,
                    discount: existingProduct.variants?.[0]?.discount,
                    ram: existingProduct.variants?.[0]?.ram,
                    storage: existingProduct.variants?.[0]?.storage
                },
                new: {
                    name: updatedProduct.name,
                    price: updatedProduct.variants?.[0]?.price,
                    discount: updatedProduct.variants?.[0]?.discount,
                    ram: updatedProduct.variants?.[0]?.ram,
                    storage: updatedProduct.variants?.[0]?.storage
                }
            },
            commit: {
                url: result.commit?.html_url,
                message: result.commit?.message
            },
            timestamp: new Date().toISOString()
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('❌ Error in update-product:', error);
        
        // ===== 19. HANDLE ERROR =====
        const gitHubError = handleGitHubError(error);
        
        return {
            statusCode: gitHubError.status || 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to update product',
                message: gitHubError.message || error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};