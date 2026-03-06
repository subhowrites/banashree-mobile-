/**
 * GETPRODUCTS.JS - Netlify Function
 * 
 * MongoDB से सारे products लाकर return करता है
 * API Endpoint: /.netlify/functions/getProducts
 */

// ===== 1. IMPORTS =====
const { connectToDatabase, formatProduct, COLLECTIONS } = require('./utils/mongodb');

// ===== 2. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// ===== 3. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('📦 getProducts function invoked');
    
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
            brand,
            limit = 100,
            page = 1,
            sort = 'createdAt',
            order = 'desc',
            search
        } = params;

        console.log('Query params:', { category, brand, limit, page, sort, order, search });

        // ===== 5. BUILD FILTER =====
        const filter = { status: 'active' }; // Only active products

        if (category && category !== 'All' && category !== 'all') {
            filter.category = category;
        }

        if (brand) {
            filter.brand = brand;
        }

        // Search functionality
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        // ===== 6. BUILD SORT =====
        const sortOrder = order === 'asc' ? 1 : -1;
        const sortOptions = {};
        sortOptions[sort] = sortOrder;

        // ===== 7. PAGINATION =====
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // ===== 8. CONNECT TO DATABASE =====
        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTIONS.PRODUCTS);

        // ===== 9. GET TOTAL COUNT =====
        const totalCount = await collection.countDocuments(filter);

        // ===== 10. GET PRODUCTS =====
        const products = await collection
            .find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .toArray();

        // ===== 11. FORMAT PRODUCTS =====
        const formattedProducts = products.map(product => {
            const { _id, ...rest } = product;
            return {
                ...rest,
                id: _id.toString(),
                _id: _id.toString()
            };
        });

        console.log(`✅ Found ${formattedProducts.length} products (total: ${totalCount})`);

        // ===== 12. RETURN SUCCESS RESPONSE =====
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: formattedProducts,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limitNum)
                },
                filters: {
                    category: category || null,
                    brand: brand || null,
                    search: search || null
                }
            })
        };

    } catch (error) {
        console.error('❌ Error in getProducts:', error);

        // ===== 13. RETURN ERROR RESPONSE =====
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch products',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};