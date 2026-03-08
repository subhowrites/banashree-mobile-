/**
 * DELETE-PRODUCT.JS - Netlify Function
 * 
 * GitHub repository से product delete करता है
 * API Endpoint: /.netlify/functions/delete-product
 */

// ===== 1. IMPORTS =====
const { 
    deleteFile, 
    readFile,
    getProductPath,
    handleGitHubError 
} = require('./utils/github-api');

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
    
    const token = authHeader.replace('Bearer ', '');
    
    // In production, you would verify JWT token here
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
        errors.push('File SHA is required for deletion');
    } else if (typeof sha !== 'string') {
        errors.push('SHA must be a string');
    } else if (sha.length < 10) {
        errors.push('Invalid SHA format');
    }

    return errors;
}

// ===== 6. EXTRACT PRODUCT INFO FROM PATH =====
function extractProductInfo(path) {
    try {
        // Path format: phone-products/iphone-15.json or products/tv/lg-tv-43.json
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        const productId = fileName.replace('.json', '');
        
        let category = 'Unknown';
        if (path.startsWith('phone-products')) {
            category = 'Phone';
        } else if (path.startsWith('products/')) {
            category = parts[1]; // tv, ac, earphones, etc.
        }
        
        return {
            id: productId,
            category: category,
            path: path
        };
    } catch (error) {
        return null;
    }
}

// ===== 7. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('🗑️ delete-product function invoked');

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
        // ===== 9. GET PARAMETERS =====
        const params = event.queryStringParameters || {};
        let productId = params.id;
        let fileSha = params.sha;
        let filePath = params.path;
        
        // Also check if data is in request body
        let bodyData = null;
        if (event.body) {
            try {
                bodyData = JSON.parse(event.body);
                if (!productId && bodyData.id) productId = bodyData.id;
                if (!fileSha && bodyData.sha) fileSha = bodyData.sha;
                if (!filePath && bodyData.path) filePath = bodyData.path;
            } catch (e) {
                // Ignore body parsing errors
            }
        }

        console.log('Delete request:', { productId, fileSha, filePath });

        // ===== 10. VALIDATE INPUTS =====
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
                    error: 'File SHA is required for deletion',
                    message: 'Please provide the file SHA. This prevents accidental deletions.'
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

        // ===== 11. DETERMINE FILE PATH =====
        if (!filePath) {
            // If path not provided, try to find by ID (less efficient)
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'File path is required',
                    message: 'Please provide the file path for the product to delete.'
                })
            };
        }

        // ===== 12. VERIFY FILE EXISTS AND SHA MATCHES =====
        try {
            const fileData = await readFile(filePath);
            
            if (!fileData) {
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

            // Verify SHA matches (prevent accidental deletion of updated file)
            if (fileData.sha !== fileSha) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'SHA mismatch',
                        message: 'The file has been modified since you loaded it. Please refresh and try again.',
                        currentSha: fileData.sha,
                        providedSha: fileSha
                    })
                };
            }

            console.log(`✅ File verified: ${filePath} (SHA: ${fileSha})`);

            // ===== 13. DELETE THE FILE =====
            const commitMessage = `Delete product: ${fileData.content.name || productId}`;
            const result = await deleteFile(filePath, fileSha, commitMessage);
            
            console.log(`✅ Product deleted successfully: ${filePath}`);

            // ===== 14. EXTRACT PRODUCT INFO FOR RESPONSE =====
            const productInfo = extractProductInfo(filePath) || {
                id: productId,
                path: filePath
            };

            // ===== 15. RETURN SUCCESS RESPONSE =====
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Product deleted successfully',
                    deletedProduct: {
                        id: productInfo.id,
                        path: filePath,
                        sha: fileSha,
                        category: productInfo.category
                    },
                    timestamp: new Date().toISOString()
                })
            };

        } catch (readError) {
            console.error('❌ Error reading file before delete:', readError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to verify product before deletion',
                    message: readError.message
                })
            };
        }

    } catch (error) {
        console.error('❌ Error in delete-product:', error);
        
        // ===== 16. HANDLE ERROR =====
        const gitHubError = handleGitHubError(error);
        
        return {
            statusCode: gitHubError.status || 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to delete product',
                message: gitHubError.message || error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};