/**
 * AUTH.JS - Netlify Function
 * 
 * Admin authentication के लिए:
 * - Login (JWT token generate)
 * - Logout (token invalidate)
 * - Verify token
 * - Change password
 * 
 * API Endpoint: /.netlify/functions/auth
 */

// ===== 1. IMPORTS =====
const { connectToDatabase, COLLECTIONS } = require('./utils/mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ===== 2. CONFIGURATION =====
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

// ===== 3. CORS HEADERS =====
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
};

// ===== 4. PASSWORD HASHING =====
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// ===== 5. GENERATE JWT TOKEN =====
function generateToken(user) {
    const payload = {
        id: user._id.toString(),
        email: user.email,
        role: user.role || 'admin',
        name: user.name || user.email.split('@')[0]
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    
    // Generate refresh token
    const refreshToken = jwt.sign(
        { id: user._id.toString(), type: 'refresh' },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { token, refreshToken, expiresIn: JWT_EXPIRY };
}

// ===== 6. VERIFY JWT TOKEN =====
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { valid: true, decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// ===== 7. CREATE ADMIN USER (FIRST TIME SETUP) =====
async function createAdminUserIfNotExists(db) {
    const usersCollection = db.collection(COLLECTIONS.USERS);
    
    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ role: 'admin' });
    
    if (!existingAdmin) {
        // Create default admin
        const defaultAdmin = {
            email: 'admin@banashree.com',
            passwordHash: hashPassword('admin123'),
            name: 'Admin User',
            role: 'admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };
        
        await usersCollection.insertOne(defaultAdmin);
        console.log('✅ Default admin user created');
    }
}

// ===== 8. LOGIN HANDLER =====
async function handleLogin(event) {
    try {
        const { email, password } = JSON.parse(event.body);

        // Validation
        if (!email || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    error: 'Email and password are required'
                })
            };
        }

        // Connect to database
        const { db } = await connectToDatabase();
        const usersCollection = db.collection(COLLECTIONS.USERS);

        // Find user by email
        const user = await usersCollection.findOne({ email: email.toLowerCase() });

        if (!user) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid email or password'
                })
            };
        }

        // Check if user is active
        if (user.isActive === false) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    error: 'Account is disabled. Contact administrator.'
                })
            };
        }

        // Verify password
        const passwordHash = hashPassword(password);
        if (user.passwordHash !== passwordHash) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid email or password'
                })
            };
        }

        // Update last login
        await usersCollection.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    lastLogin: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                } 
            }
        );

        // Generate tokens
        const { token, refreshToken, expiresIn } = generateToken(user);

        // Remove sensitive data
        const { passwordHash: _, ...userWithoutPassword } = user;

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Login successful',
                token,
                refreshToken,
                expiresIn,
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    name: user.name || user.email.split('@')[0],
                    role: user.role
                }
            })
        };

    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Login failed',
                message: error.message
            })
        };
    }
}

// ===== 9. VERIFY TOKEN HANDLER =====
async function handleVerify(event) {
    try {
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'No token provided'
                })
            };
        }

        const token = authHeader.replace('Bearer ', '');
        const verification = verifyToken(token);

        if (!verification.valid) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid or expired token',
                    details: verification.error
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Token is valid',
                user: verification.decoded
            })
        };

    } catch (error) {
        console.error('Verify error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Token verification failed'
            })
        };
    }
}

// ===== 10. REFRESH TOKEN HANDLER =====
async function handleRefresh(event) {
    try {
        const { refreshToken } = JSON.parse(event.body);

        if (!refreshToken) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    error: 'Refresh token is required'
                })
            };
        }

        // Verify refresh token
        const verification = verifyToken(refreshToken);

        if (!verification.valid || verification.decoded.type !== 'refresh') {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid refresh token'
                })
            };
        }

        // Connect to database
        const { db } = await connectToDatabase();
        const usersCollection = db.collection(COLLECTIONS.USERS);

        // Find user
        const user = await usersCollection.findOne({ 
            _id: new (require('mongodb')).ObjectId(verification.decoded.id) 
        });

        if (!user) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'User not found'
                })
            };
        }

        // Generate new tokens
        const { token, refreshToken: newRefreshToken, expiresIn } = generateToken(user);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                token,
                refreshToken: newRefreshToken,
                expiresIn
            })
        };

    } catch (error) {
        console.error('Refresh error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Token refresh failed'
            })
        };
    }
}

// ===== 11. CHANGE PASSWORD HANDLER =====
async function handleChangePassword(event) {
    try {
        // Verify token first
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'No token provided'
                })
            };
        }

        const token = authHeader.replace('Bearer ', '');
        const verification = verifyToken(token);

        if (!verification.valid) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid or expired token'
                })
            };
        }

        const { currentPassword, newPassword } = JSON.parse(event.body);

        // Validate new password
        if (!newPassword || newPassword.length < 6) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    error: 'New password must be at least 6 characters long'
                })
            };
        }

        // Connect to database
        const { db } = await connectToDatabase();
        const usersCollection = db.collection(COLLECTIONS.USERS);

        // Find user
        const user = await usersCollection.findOne({ 
            _id: new (require('mongodb')).ObjectId(verification.decoded.id) 
        });

        if (!user) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    success: false,
                    error: 'User not found'
                })
            };
        }

        // Verify current password
        const currentPasswordHash = hashPassword(currentPassword);
        if (user.passwordHash !== currentPasswordHash) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    error: 'Current password is incorrect'
                })
            };
        }

        // Update password
        const newPasswordHash = hashPassword(newPassword);
        await usersCollection.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    passwordHash: newPasswordHash,
                    updatedAt: new Date().toISOString()
                } 
            }
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Password changed successfully'
            })
        };

    } catch (error) {
        console.error('Change password error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Password change failed'
            })
        };
    }
}

// ===== 12. LOGOUT HANDLER =====
async function handleLogout(event) {
    try {
        // In a real implementation, you might want to blacklist the token
        // For now, just return success (client will remove token)
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Logout successful'
            })
        };

    } catch (error) {
        console.error('Logout error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Logout failed'
            })
        };
    }
}

// ===== 13. MAIN HANDLER =====
exports.handler = async (event) => {
    console.log('🔐 auth function invoked');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Path:', event.path);

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Connect to database and ensure admin user exists (for first time)
        const { db } = await connectToDatabase();
        await createAdminUserIfNotExists(db);

        // Route based on HTTP method and query parameters
        const params = event.queryStringParameters || {};

        // GET /auth?verify=true - Verify token
        if (event.httpMethod === 'GET' && params.verify === 'true') {
            const result = await handleVerify(event);
            return { ...result, headers };
        }

        // POST /auth - Login
        if (event.httpMethod === 'POST' && !params.action) {
            const result = await handleLogin(event);
            return { ...result, headers };
        }

        // POST /auth?action=refresh - Refresh token
        if (event.httpMethod === 'POST' && params.action === 'refresh') {
            const result = await handleRefresh(event);
            return { ...result, headers };
        }

        // POST /auth?action=change-password - Change password
        if (event.httpMethod === 'POST' && params.action === 'change-password') {
            const result = await handleChangePassword(event);
            return { ...result, headers };
        }

        // DELETE /auth - Logout
        if (event.httpMethod === 'DELETE') {
            const result = await handleLogout(event);
            return { ...result, headers };
        }

        // Invalid endpoint
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Endpoint not found'
            })
        };

    } catch (error) {
        console.error('Auth function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Authentication service error',
                message: error.message
            })
        };
    }
};