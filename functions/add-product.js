/**
 * ADD-PRODUCT.JS - Netlify Function
 * 
 * GitHub repository में नया product add करता है
 * API Endpoint: /.netlify/functions/add-product
 */

// ===== 1. IMPORTS =====
const { 
    writeFile, 
    getProductPath,
    fileExists,
    handleGitHubError 
} = require('./utils/github-api');

// ===== 2. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// ===== 3. AUTHENTICATION CHECK =====
function isAuthorized(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader) return false;
    
    const token = authHeader.replace('Bearer ', '');
    
    // In production, you would verify JWT token here
    // For now, just check if token exists
    return token && token.length > 10;
}

// ===== 4. VALIDATE PRODUCT DATA =====
function validateProduct(data) {
    const errors = [];

    // Required fields
    if (!data.name) errors.push('Product name is required');
    if (!data.brand) errors.push('Brand is required');
    if (!data.category) errors.push('Category is required');
    
    // Price validation
    if (data.price === undefined || data.price === null) {
        errors.push('Price is required');
    } else if (isNaN(data.price) || data.price < 0) {
        errors.push('Price must be a positive number');
    }

    // Discount validation
    if (data.discount !== undefined && data.discount !== null) {
        if (isNaN(data.discount) || data.discount < 0 || data.discount > 100) {
            errors.push('Discount must be between 0 and 100');
        }
    }

    // RAM validation
    if (data.ram && typeof data.ram !== 'string') {
        errors.push('RAM must be a string (e.g., "8 GB")');
    }
    
    // Storage validation
    if (data.storage && typeof data.storage !== 'string') {
        errors.push('Storage must be a string (e.g., "128 GB")');
    }

    return errors;
}

// ===== 5. GENERATE PRODUCT ID =====
function generateProductId(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, '-')           // spaces to hyphens
        .replace(/[^a-z0-9-]/g, '')      // remove special characters
        .replace(/-+/g, '-')              // multiple hyphens to single
        .replace(/^-|-$/g, '');           // trim hyphens from ends
}

// ===== 6. GENERATE VARIANT ID =====
function generateVariantId(storage, ram) {
    const storageClean = storage.replace(/\s+/g, '');
    const ramClean = ram.replace(/\s+/g, '');
    return `${storageClean}-${ramClean}`;
}

// ===== 7. CREATE PRODUCT OBJECT =====
function createProductObject(data) {
    const productId = data.id || generateProductId(data.name);
    const variantId = generateVariantId(
        data.storage || '128GB',
        data.ram || '8GB'
    );

    const product = {
        id: productId,
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

// ===== 8. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('📝 add-product function invoked');

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

    // ===== 9. AUTHENTICATION CHECK =====
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
        // ===== 10. PARSE REQUEST BODY =====
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

        // ===== 11. VALIDATE PRODUCT DATA =====
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

        // ===== 12. CREATE PRODUCT OBJECT =====
        const newProduct = createProductObject(productData);

        // ===== 13. DETERMINE FILE PATH =====
        const filePath = getProductPath(newProduct);
        console.log(`📁 Target path: ${filePath}`);

        // ===== 14. CHECK IF FILE ALREADY EXISTS =====
        const exists = await fileExists(filePath);
        if (exists) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Product already exists',
                    path: filePath,
                    message: `A product with ID ${newProduct.id} already exists. Use update instead.`
                })
            };
        }

        // ===== 15. WRITE TO GITHUB =====
        console.log(`💾 Writing product to GitHub: ${filePath}`);
        const result = await writeFile(
            filePath, 
            newProduct, 
            null, 
            `Add product: ${newProduct.name}`
        );

        console.log(`✅ Product added successfully with SHA: ${result.sha}`);

        // ===== 16. RETURN SUCCESS RESPONSE =====
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Product added successfully',
                product: {
                    ...newProduct,
                    sha: result.sha,
                    path: filePath,
                    commit: {
                        url: result.commit.html_url,
                        message: result.commit.message
                    }
                }
            })
        };

    } catch (error) {
        console.error('❌ Error in add-product:', error);
        
        // ===== 17. HANDLE ERROR =====
        const gitHubError = handleGitHubError(error);
        
        return {
            statusCode: gitHubError.status || 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to add product',
                message: gitHubError.message || error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};