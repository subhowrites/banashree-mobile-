/**
 * ADMIN-CONFIG.JS - MongoDB Configuration
 * Real code – no demo
 * 
 * यह file MongoDB connection string और settings store करती है
 */

// ===== MongoDB Configuration =====
const CONFIG = {
    // ⚠️ IMPORTANT: Netlify environment variable से लेना है
    // Local development के लिए यहाँ रख सकते हो, पर GitHub पर push मत करना!
    MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://banashree-mobile:banashree678543@banashree-mobile.wps3lj8.mongodb.net/banashree?retryWrites=true&w=majority",
    
    // Database name
    DB_NAME: "banashree",
    
    // Collections
    COLLECTIONS: {
        PRODUCTS: "products",
        USERS: "users",
        CATEGORIES: "categories"
    },
    
    // API endpoints (Netlify functions)
    API: {
        // Netlify functions के URLs – production और local दोनों handle करेंगे
        getBaseUrl: function() {
            // अगर localhost पर है
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'http://localhost:8888/.netlify/functions';
            }
            // Production (Netlify) पर
            return '/.netlify/functions';
        },
        
        // Specific endpoints
        getProducts: function() { return `${this.getBaseUrl()}/getProducts`; },
        addProduct: function() { return `${this.getBaseUrl()}/addProduct`; },
        deleteProduct: function() { return `${this.getBaseUrl()}/deleteProduct`; },
        updateProduct: function() { return `${this.getBaseUrl()}/updateProduct`; },
        auth: function() { return `${this.getBaseUrl()}/auth`; }
    },
    
    // Admin credentials (local storage के लिए)
    // ⚠️ Real password Netlify env में रखना, यहाँ सिर्फ demo है
    ADMIN_EMAIL: "admin@banashree.com",
    ADMIN_PASSWORD_HASH: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // "password" का SHA256 hash
};

// ===== Local Storage Keys =====
const STORAGE_KEYS = {
    AUTH_TOKEN: 'admin_auth_token',
    USER_DATA: 'admin_user_data',
    LOGIN_TIME: 'admin_login_time'
};

// ===== Session Timeout (24 hours) =====
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ===== Helper Functions =====
const CONFIG_HELPERS = {
    // Get API URL
    getApiUrl(endpoint) {
        return CONFIG.API.getBaseUrl() + endpoint;
    },
    
    // Check if user is logged in (based on local storage)
    isLoggedIn() {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const loginTime = localStorage.getItem(STORAGE_KEYS.LOGIN_TIME);
        
        if (!token || !loginTime) return false;
        
        // Check if session expired
        const now = new Date().getTime();
        if (now - parseInt(loginTime) > SESSION_TIMEOUT) {
            this.logout();
            return false;
        }
        
        return true;
    },
    
    // Set login data
    setLogin(userData, token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
        localStorage.setItem(STORAGE_KEYS.LOGIN_TIME, new Date().getTime().toString());
    },
    
    // Get user data
    getUserData() {
        const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        return data ? JSON.parse(data) : null;
    },
    
    // Logout
    logout() {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        localStorage.removeItem(STORAGE_KEYS.LOGIN_TIME);
    },
    
    // Get auth token
    getToken() {
        return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    }
};

// ===== Export everything =====
export { 
    CONFIG, 
    STORAGE_KEYS, 
    SESSION_TIMEOUT,
    CONFIG_HELPERS as Helpers 
};

// ===== Default export =====
export default {
    CONFIG,
    STORAGE_KEYS,
    SESSION_TIMEOUT,
    Helpers: CONFIG_HELPERS
};