/**
 * GITHUB-CONFIG.JS - GitHub API Configuration
 * 
 * यह file GitHub API connection string और settings store करती है
 * Admin panel और Netlify functions दोनों में use होगी
 */

// ===== GitHub Configuration =====
const GITHUB_CONFIG = {
    // GitHub repository details
    OWNER: 'subhowrites',                    // तुम्हारा GitHub username
    REPO: 'banashree-mobile-',               // Data repository name (hyphen के साथ)
    BRANCH: 'main',                          // Branch name
    
    // API endpoints (Netlify functions के लिए)
    API: {
        // Netlify functions के URLs – production और local दोनों handle करेंगे
        getBaseUrl: function() {
            // अगर localhost पर है (development के लिए)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'http://localhost:8888/.netlify/functions';
            }
            // Production (Netlify) पर
            return '/.netlify/functions';
        },
        
        // Specific endpoints
        getProducts: function() { return `${this.getBaseUrl()}/get-products`; },
        addProduct: function() { return `${this.getBaseUrl()}/add-product`; },
        deleteProduct: function() { return `${this.getBaseUrl()}/delete-product`; },
        updateProduct: function() { return `${this.getBaseUrl()}/update-product`; },
        auth: function() { return `${this.getBaseUrl()}/auth`; }
    },
    
    // File paths in GitHub repository
    PATHS: {
        // Phone products folder
        PHONE_PRODUCTS: 'phone-products',
        
        // Other products folder
        PRODUCTS: 'products',
        
        // JSON files
        CATEGORIES: 'categories.json',
        TRENDING: 'trending.json',
        NEW_LAUNCH: 'new-launch.json',
        PAGINATION: 'pagination.json',
        CATEGORY_BOX: 'category-box.json'
    },
    
    // Admin credentials
    ADMIN_EMAIL: 'admin@banashree.com'
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
const GITHUB_HELPERS = {
    // Get API URL
    getApiUrl(endpoint) {
        return GITHUB_CONFIG.API.getBaseUrl() + endpoint;
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
    },
    
    // Get GitHub file path based on category
    getFilePath(product) {
        const phoneCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        
        const fileName = `${product.id || product.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        
        if (phoneCategories.includes(product.category)) {
            return `${GITHUB_CONFIG.PATHS.PHONE_PRODUCTS}/${fileName}`;
        } else {
            const categoryFolder = product.category.toLowerCase();
            return `${GITHUB_CONFIG.PATHS.PRODUCTS}/${categoryFolder}/${fileName}`;
        }
    },
    
    // Get all products from a category
    getCategoryPath(category) {
        const phoneCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        
        if (phoneCategories.includes(category)) {
            return GITHUB_CONFIG.PATHS.PHONE_PRODUCTS;
        } else if (category === 'All' || category === 'all') {
            return ''; // Root path for all
        } else {
            return `${GITHUB_CONFIG.PATHS.PRODUCTS}/${category.toLowerCase()}`;
        }
    }
};

// ===== Export everything =====
export { 
    GITHUB_CONFIG, 
    STORAGE_KEYS, 
    SESSION_TIMEOUT,
    GITHUB_HELPERS as Helpers 
};

// ===== Default export =====
export default {
    CONFIG: GITHUB_CONFIG,
    STORAGE_KEYS,
    SESSION_TIMEOUT,
    Helpers: GITHUB_HELPERS
};