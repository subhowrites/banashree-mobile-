/**
 * DATA-LOADER.JS - COMPLETE FIXED VERSION WITH GITHUB API SUPPORT
 * Phones: phone-products folder in GitHub
 * Other products: products folder in GitHub
 * All data from GitHub API (no MongoDB)
 */

// ===== 1. GITHUB API FUNCTIONS =====
async function fetchGitHubProducts() {
    try {
        // Determine API URL based on environment
        const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8888/.netlify/functions'
            : '/.netlify/functions';
        
        // Get all products
        const response = await fetch(`${baseUrl}/get-products`);
        
        if (!response.ok) {
            console.warn('GitHub API not available:', response.status);
            return [];
        }
        
        const data = await response.json();
        return data.data || data.products || data || [];
        
    } catch (error) {
        console.warn('Error fetching GitHub products:', error.message);
        return [];
    }
}

async function fetchGitHubProductsByCategory(category) {
    try {
        const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8888/.netlify/functions'
            : '/.netlify/functions';
        
        const response = await fetch(`${baseUrl}/get-products?category=${encodeURIComponent(category)}`);
        
        if (!response.ok) {
            return [];
        }
        
        const data = await response.json();
        return data.data || data.products || data || [];
        
    } catch (error) {
        console.warn(`Error fetching ${category} products:`, error.message);
        return [];
    }
}

async function fetchGitHubJsonFile(type) {
    try {
        const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8888/.netlify/functions'
            : '/.netlify/functions';
        
        const response = await fetch(`${baseUrl}/get-products?type=${encodeURIComponent(type)}`);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        return data.data || data.products || data || [];
        
    } catch (error) {
        console.warn(`Error fetching ${type}:`, error.message);
        return null;
    }
}

const DataLoader = {
    basePath: 'data/',
    
    async loadCategories() {
        try {
            // First try GitHub API
            const githubCategories = await fetchGitHubJsonFile('categories');
            if (githubCategories && githubCategories.length > 0) {
                return githubCategories;
            }
            
            // Fallback to local JSON
            const response = await fetch(this.basePath + 'categories.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading categories:', error);
            return ["All", "Vivo", "iPhone", "Samsung"];
        }
    },
    
    async loadTrending() {
        try {
            // First try GitHub API
            const githubTrending = await fetchGitHubJsonFile('trending');
            if (githubTrending && githubTrending.length > 0) {
                return githubTrending;
            }
            
            // Fallback to local JSON
            const response = await fetch(this.basePath + 'trending.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading trending:', error);
            return [];
        }
    },
    
    async loadNewLaunch() {
        try {
            // First try GitHub API
            const githubNewLaunch = await fetchGitHubJsonFile('new-launch');
            if (githubNewLaunch && githubNewLaunch.length > 0) {
                return githubNewLaunch;
            }
            
            // Fallback to local JSON
            const response = await fetch(this.basePath + 'new-launch.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading new launch:', error);
            return [];
        }
    },
    
    async loadPagination() {
        try {
            // First try GitHub API
            const githubPagination = await fetchGitHubJsonFile('pagination');
            if (githubPagination) {
                return githubPagination;
            }
            
            // Fallback to local JSON
            const response = await fetch(this.basePath + 'pagination.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading pagination:', error);
            return { cardsPerPage: 40 };
        }
    },
    
    async loadCategoryBox() {
        try {
            // First try GitHub API
            const githubCategoryBox = await fetchGitHubJsonFile('category-box');
            if (githubCategoryBox && githubCategoryBox.length > 0) {
                return githubCategoryBox;
            }
            
            // Fallback to local JSON
            const response = await fetch(this.basePath + 'category-box.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading category box:', error);
            return [];
        }
    },
    
    // ===== PHONE PRODUCTS IDs (local fallback) =====
    async loadPhoneProductIds() {
        return [
            // Mobiles
            'iphone-15',
            'samsung-s23',
            'vivo-v30',
            'oppo-reno12-5g',
            'redmi-13-5g',
            'nothing-phone-2',
            'oneplus-nord-15r',
            'google-pixel-8',
            'vivo-v29',
            'samsung-a54',
            'realme-12-pro'
        ];
    },
    
    // ===== OTHER PRODUCTS IDs (local fallback) =====
    async loadOtherProductIds() {
        return [
            // TVs
            'samsung-tv-55',
            'lg-tv-43',
            'sony-tv-65',
            'mi-tv-5x',
            
            // ACs
            'lg-ac-1.5ton',
            'samsung-ac-2ton',
            'voltas-ac-1ton',
            'daikin-ac-1.5ton',
            
            // Earphones
            'boat-earphones-131',
            'jbl-earphones-100',
            'sony-earphones-500',
            'realme-earphones-air',
            
            // Watches
            'apple-watch-9',
            'samsung-watch-6',
            'noise-watch-4',
            'boat-watch-storm',
            
            // Laptops
            'dell-laptop-15',
            'hp-laptop-14',
            'lenovo-laptop-16',
            'apple-macbook-air',
            
            // Tablets
            'apple-ipad-10',
            'samsung-tab-s9',
            'lenovo-tab-p12',
            
            // Accessories
            'charger-20w',
            'powerbank-20000',
            'cable-type-c',
            'cover-iphone-15'
        ];
    },
    
    // ===== LOAD PRODUCT FROM SPECIFIC FOLDER (local fallback) =====
    async loadProductFromFolder(productId, folder) {
        try {
            const response = await fetch(`${this.basePath}${folder}/${productId}.json`);
            if (!response.ok) {
                return null;
            }
            const product = await response.json();
            product.source = 'json';
            product.sourceFolder = folder;
            return product;
        } catch (error) {
            return null;
        }
    },
    
    // ===== LOAD PRODUCT (AUTO-DETECT FOLDER) =====
    async loadProduct(productId) {
        // First try GitHub API
        try {
            const allProducts = await fetchGitHubProducts();
            const product = allProducts.find(p => p.id === productId || p._id === productId);
            if (product) {
                product.source = 'github';
                return product;
            }
        } catch (error) {
            console.warn('GitHub product fetch failed, trying local JSON...');
        }
        
        // Fallback to local JSON
        let product = await this.loadProductFromFolder(productId, 'phone-products');
        if (product) return product;
        
        product = await this.loadProductFromFolder(productId, 'products');
        if (product) return product;
        
        console.warn(`Product ${productId} not found in any source`);
        return null;
    },
    
    // ===== LOAD PRODUCTS BY IDs =====
    async loadProducts(productIds) {
        const promises = productIds.map(id => this.loadProduct(id));
        const products = await Promise.all(promises);
        return products.filter(p => p !== null && p.status === 'active');
    },
    
    // ===== LOAD ALL PHONES (for homepage & products page) =====
    async loadAllPhones() {
        console.log('📱 Loading phones from GitHub API...');
        
        // Get all products from GitHub
        const allGitHub = await fetchGitHubProducts();
        
        // Filter phones
        const phoneCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        const githubPhones = allGitHub.filter(p => 
            phoneCategories.includes(p.category) || phoneCategories.includes(p.brand)
        );
        
        // Also try local JSON as fallback
        const phoneIds = await this.loadPhoneProductIds();
        const jsonPhones = await this.loadProducts(phoneIds);
        
        // Merge (GitHub takes priority, but avoid duplicates)
        const allPhones = [...githubPhones];
        
        // Add JSON phones that aren't already in GitHub
        jsonPhones.forEach(jsonPhone => {
            if (!allPhones.some(p => p.id === jsonPhone.id || p.name === jsonPhone.name)) {
                allPhones.push(jsonPhone);
            }
        });
        
        console.log(`📱 Total phones: ${allPhones.length} (GitHub: ${githubPhones.length}, JSON: ${jsonPhones.length})`);
        
        return allPhones;
    },
    
    // ===== LOAD ALL OTHER PRODUCTS =====
    async loadAllOtherProducts() {
        console.log('📺 Loading other products from GitHub API...');
        
        // Get all products from GitHub
        const allGitHub = await fetchGitHubProducts();
        
        // Filter non-phone products
        const phoneCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        const githubOthers = allGitHub.filter(p => 
            !phoneCategories.includes(p.category) && !phoneCategories.includes(p.brand)
        );
        
        // Also try local JSON as fallback
        const otherIds = await this.loadOtherProductIds();
        const jsonOthers = await this.loadProducts(otherIds);
        
        // Merge (GitHub takes priority)
        const allOthers = [...githubOthers];
        
        // Add JSON products that aren't already in GitHub
        jsonOthers.forEach(jsonProduct => {
            if (!allOthers.some(p => p.id === jsonProduct.id || p.name === jsonProduct.name)) {
                allOthers.push(jsonProduct);
            }
        });
        
        console.log(`📺 Total other products: ${allOthers.length} (GitHub: ${githubOthers.length}, JSON: ${jsonOthers.length})`);
        
        return allOthers;
    },
    
    // ===== LOAD ALL PRODUCTS (सभी sources से) =====
    async loadAllProducts() {
        const path = window.location.pathname;
        console.log('Loading all products for path:', path);
        
        // Get all from GitHub first
        const githubProducts = await fetchGitHubProducts();
        
        // Also get local JSON as fallback
        const [jsonPhones, jsonOthers] = await Promise.all([
            this.loadProducts(await this.loadPhoneProductIds()),
            this.loadProducts(await this.loadOtherProductIds())
        ]);
        
        // Merge (GitHub takes priority)
        const allProducts = [...githubProducts];
        
        // Add JSON products that aren't already in GitHub
        [...jsonPhones, ...jsonOthers].forEach(jsonProduct => {
            if (!allProducts.some(p => p.id === jsonProduct.id || p.name === jsonProduct.name)) {
                allProducts.push(jsonProduct);
            }
        });
        
        console.log(`📊 Total products loaded: ${allProducts.length}`);
        console.log(`   🔥 GitHub: ${githubProducts.length}`);
        console.log(`   📱 JSON Phones: ${jsonPhones.length}`);
        console.log(`   📺 JSON Others: ${jsonOthers.length}`);
        
        return allProducts;
    },
    
    // ===== LOAD ALL PRODUCTS (for homepage & other pages) =====
    async loadAllProductsForPage() {
        const path = window.location.pathname;
        console.log('Loading for path:', path);
        
        // Homepage and products page - सिर्फ phones
        if (path === '/' || path.includes('index.html') || path.includes('products.html')) {
            return this.loadAllPhones();
        }
        
        // Category pages ke liye - सिर्फ उस category के products
        if (window.currentCategory) {
            return this.loadProductsByCategory(window.currentCategory);
        }
        
        // Fallback - सारे products
        return this.loadAllProducts();
    },
    
    // ===== LOAD PRODUCTS BY CATEGORY =====
    async loadProductsByCategory(category) {
        console.log(`Loading products for category: ${category}`);
        
        // First try GitHub API with category filter
        const githubProducts = await fetchGitHubProductsByCategory(category);
        
        // Special handling for Trending
        if (category === 'Trending') {
            const trendingIds = await this.loadTrending();
            const jsonProducts = await this.loadProducts(trendingIds);
            
            // GitHub से भी trending products लोड करो (अगर trending tagged हों)
            const githubTrending = githubProducts.filter(p => p.tags?.includes('trending'));
            
            return [...githubTrending, ...jsonProducts];
        }
        
        // Special handling for New Launch
        if (category === 'New Launch') {
            const newLaunchIds = await this.loadNewLaunch();
            const jsonProducts = await this.loadProducts(newLaunchIds);
            
            // GitHub से भी new launch products लोड करो (अगर new tagged हों)
            const githubNew = githubProducts.filter(p => p.tags?.includes('new'));
            
            return [...githubNew, ...jsonProducts];
        }
        
        // For brand categories (iPhone, Samsung, Vivo, etc.)
        const brandCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        if (brandCategories.includes(category)) {
            const allPhones = await this.loadAllPhones();
            return allPhones.filter(p => p.category === category || p.brand === category);
        }
        
        // For other categories (TV, AC, etc.) - use GitHub results
        return githubProducts;
    },
    
    // ===== SEARCH PRODUCTS =====
    async searchProducts(query) {
        const allProducts = await this.loadAllProducts();
        const lowerQuery = query.toLowerCase();
        
        return allProducts.filter(product => {
            return (
                (product.name && product.name.toLowerCase().includes(lowerQuery)) ||
                (product.brand && product.brand.toLowerCase().includes(lowerQuery)) ||
                (product.category && product.category.toLowerCase().includes(lowerQuery))
            );
        });
    },
    
    // ===== REFRESH GITHUB CACHE =====
    clearCache() {
        // No cache in this version, but function kept for compatibility
        console.log('Cache cleared (if any)');
    }
};

window.DataLoader = DataLoader;