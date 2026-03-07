/**
 * GET-PRODUCTS.JS - Netlify Function
 * 
 * GitHub से सारे products लाकर return करता है
 * API Endpoint: /.netlify/functions/get-products
 */

// ===== 1. IMPORTS =====
const { 
    getAllProducts, 
    getProductsByCategory, 
    getJsonFile,
    handleGitHubError 
} = require('./utils/github-api');

// ===== 2. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// ===== 3. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('📦 get-products function invoked');
    
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed. Use GET.' 
            })
        };
    }

    try {
        // ===== 4. PARSE QUERY PARAMETERS =====
        const params = event.queryStringParameters || {};
        const {
            category,
            type,
            limit = 100,
            page = 1,
            sort = 'name',
            order = 'asc'
        } = params;

        console.log('Query params:', { category, type, limit, page, sort, order });

        let products = [];
        let totalCount = 0;
        let responseData = {};

        // ===== 5. HANDLE DIFFERENT REQUEST TYPES =====
        
        // Case 1: Get categories.json
        if (type === 'categories') {
            const categories = await getJsonFile('categories.json');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: categories || []
                })
            };
        }
        
        // Case 2: Get trending.json
        if (type === 'trending') {
            const trending = await getJsonFile('trending.json');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: trending || []
                })
            };
        }
        
        // Case 3: Get new-launch.json
        if (type === 'new-launch') {
            const newLaunch = await getJsonFile('new-launch.json');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: newLaunch || []
                })
            };
        }
        
        // Case 4: Get pagination.json
        if (type === 'pagination') {
            const pagination = await getJsonFile('pagination.json');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: pagination || { cardsPerPage: 40 }
                })
            };
        }
        
        // Case 5: Get category-box.json
        if (type === 'category-box') {
            const categoryBox = await getJsonFile('category-box.json');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: categoryBox || []
                })
            };
        }
        
        // Case 6: Get products by category
        if (category) {
            products = await getProductsByCategory(category);
            totalCount = products.length;
            responseData.category = category;
        } 
        // Case 7: Get all products
        else {
            products = await getAllProducts();
            totalCount = products.length;
        }

        console.log(`✅ Found ${products.length} products`);

        // ===== 6. APPLY SORTING =====
        if (sort) {
            products.sort((a, b) => {
                let valA, valB;
                
                // Handle nested fields like variants[0].price
                if (sort === 'price') {
                    valA = a.variants?.[0]?.price || 0;
                    valB = b.variants?.[0]?.price || 0;
                } else {
                    valA = a[sort] || '';
                    valB = b[sort] || '';
                }
                
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return order === 'asc' ? valA - valB : valB - valA;
                } else {
                    const strA = String(valA).toLowerCase();
                    const strB = String(valB).toLowerCase();
                    if (order === 'asc') {
                        return strA.localeCompare(strB);
                    } else {
                        return strB.localeCompare(strA);
                    }
                }
            });
        }

        // ===== 7. APPLY PAGINATION =====
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedProducts = products.slice(startIndex, endIndex);

        // ===== 8. RETURN SUCCESS RESPONSE =====
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: paginatedProducts,
                products: paginatedProducts, // For backward compatibility
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limitNum),
                    hasNextPage: endIndex < totalCount,
                    hasPrevPage: pageNum > 1
                },
                filters: {
                    category: category || null,
                    type: type || null
                },
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Error in get-products:', error);
        
        // ===== 9. HANDLE ERROR =====
        const gitHubError = handleGitHubError(error);
        
        return {
            statusCode: gitHubError.status || 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch products',
                message: gitHubError.message || error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};