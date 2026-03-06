/**
 * DATA-LOADER.JS - COMPLETE FIXED VERSION WITH FIREBASE SUPPORT
 * Phones: phone-products folder
 * Other products: products folder
 * Firebase products: Firestore database
 */

// ===== 1. FIREBASE IMPORTS (के लिए setup) =====
let firebaseModule = null;
let firebaseProductsCache = [];

// ===== 2. TRY TO LOAD FIREBASE (अगर available हो) =====
async function getFirebaseProducts() {
    // Agar already loaded hai to cache se do
    if (firebaseProductsCache.length > 0) {
        return firebaseProductsCache;
    }
    
    try {
        // Dynamic import - agar Firebase available ho to load karo
        if (!firebaseModule) {
            firebaseModule = await import('./admin/firebase.js');
        }
        
        const { db, collection, getDocs } = firebaseModule;
        
        console.log('🔥 Loading products from Firebase...');
        const products = [];
        const querySnapshot = await getDocs(collection(db, "products"));
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            products.push({
                ...data,
                id: doc.id,
                source: 'firebase',
                // Ensure category exists
                category: data.category || 'Uncategorized'
            });
        });
        
        console.log(`📦 Loaded ${products.length} products from Firebase`);
        firebaseProductsCache = products;
        return products;
        
    } catch (error) {
        console.warn('Firebase not available or error:', error.message);
        return [];
    }
}

const DataLoader = {
    basePath: 'data/',
    
    async loadCategories() {
        try {
            const response = await fetch(this.basePath + 'categories.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading categories:', error);
            return ["All", "Vivo", "iPhone", "Samsung"];
        }
    },
    
    async loadTrending() {
        try {
            const response = await fetch(this.basePath + 'trending.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading trending:', error);
            return [];
        }
    },
    
    async loadNewLaunch() {
        try {
            const response = await fetch(this.basePath + 'new-launch.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading new launch:', error);
            return [];
        }
    },
    
    async loadPagination() {
        try {
            const response = await fetch(this.basePath + 'pagination.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading pagination:', error);
            return { cardsPerPage: 40 };
        }
    },
    
    // ===== PHONE PRODUCTS IDs (phone-products folder) =====
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
    
    // ===== OTHER PRODUCTS IDs (products folder) =====
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
    
    // ===== LOAD PRODUCT FROM SPECIFIC FOLDER =====
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
        // Pehle phone-products folder mein dhundo
        let product = await this.loadProductFromFolder(productId, 'phone-products');
        if (product) return product;
        
        // Nahi mila to products folder mein dhundo
        product = await this.loadProductFromFolder(productId, 'products');
        if (product) return product;
        
        // Firebase mein dhundo
        const firebaseProducts = await getFirebaseProducts();
        product = firebaseProducts.find(p => p.id === productId);
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
        console.log('📱 Loading phones from phone-products folder...');
        const phoneIds = await this.loadPhoneProductIds();
        const jsonPhones = await this.loadProducts(phoneIds);
        
        // Firebase से भी phones लोड करो
        const allFirebase = await getFirebaseProducts();
        const firebasePhones = allFirebase.filter(p => 
            ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'].includes(p.category)
        );
        
        const allPhones = [...jsonPhones, ...firebasePhones];
        console.log(`📱 Total phones: ${allPhones.length} (JSON: ${jsonPhones.length}, Firebase: ${firebasePhones.length})`);
        
        return allPhones;
    },
    
    // ===== LOAD ALL OTHER PRODUCTS =====
    async loadAllOtherProducts() {
        console.log('📺 Loading other products from products folder...');
        const otherIds = await this.loadOtherProductIds();
        const jsonOthers = await this.loadProducts(otherIds);
        
        // Firebase से भी other products लोड करो
        const allFirebase = await getFirebaseProducts();
        const firebaseOthers = allFirebase.filter(p => 
            ['TV', 'AC', 'Earphones', 'Watch', 'Laptop', 'Tablet', 'Accessories'].includes(p.category)
        );
        
        const allOthers = [...jsonOthers, ...firebaseOthers];
        console.log(`📺 Total other products: ${allOthers.length} (JSON: ${jsonOthers.length}, Firebase: ${firebaseOthers.length})`);
        
        return allOthers;
    },
    
    // ===== LOAD ALL PRODUCTS (सभी sources से) =====
    async loadAllProducts() {
        const path = window.location.pathname;
        console.log('Loading all products for path:', path);
        
        // Parallel mein sab load karo
        const [jsonPhones, jsonOthers, firebaseProducts] = await Promise.all([
            this.loadProducts(await this.loadPhoneProductIds()),
            this.loadProducts(await this.loadOtherProductIds()),
            getFirebaseProducts()
        ]);
        
        const allProducts = [...jsonPhones, ...jsonOthers, ...firebaseProducts];
        console.log(`📊 Total products loaded: ${allProducts.length}`);
        console.log(`   📱 JSON Phones: ${jsonPhones.length}`);
        console.log(`   📺 JSON Others: ${jsonOthers.length}`);
        console.log(`   🔥 Firebase: ${firebaseProducts.length}`);
        
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
        
        // ⭐ FIXED: Special handling for Trending
        if (category === 'Trending') {
            const trendingIds = await this.loadTrending();
            console.log('Trending IDs:', trendingIds);
            const jsonProducts = await this.loadProducts(trendingIds);
            
            // Firebase से भी trending products लोड करो (अगर trending tagged हों)
            const firebaseProducts = await getFirebaseProducts();
            const firebaseTrending = firebaseProducts.filter(p => p.tags?.includes('trending'));
            
            return [...jsonProducts, ...firebaseTrending];
        }
        
        // ⭐ FIXED: Special handling for New Launch
        if (category === 'New Launch') {
            const newLaunchIds = await this.loadNewLaunch();
            console.log('New Launch IDs:', newLaunchIds);
            const jsonProducts = await this.loadProducts(newLaunchIds);
            
            // Firebase से भी new launch products लोड करो (अगर new tagged हों)
            const firebaseProducts = await getFirebaseProducts();
            const firebaseNew = firebaseProducts.filter(p => p.tags?.includes('new'));
            
            return [...jsonProducts, ...firebaseNew];
        }
        
        // For brand categories (iPhone, Samsung, Vivo, etc.)
        const brandCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        if (brandCategories.includes(category)) {
            const allPhones = await this.loadAllPhones();
            return allPhones.filter(p => p.category === category || p.brand === category);
        }
        
        // For other categories (TV, AC, etc.)
        const allOthers = await this.loadAllOtherProducts();
        const jsonFiltered = allOthers.filter(p => p.category === category);
        
        // Firebase products भी include करो
        const firebaseProducts = await getFirebaseProducts();
        const firebaseFiltered = firebaseProducts.filter(p => p.category === category);
        
        return [...jsonFiltered, ...firebaseFiltered];
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
    
    // ===== CLEAR FIREBASE CACHE (admin panel ke liye) =====
    clearFirebaseCache() {
        firebaseProductsCache = [];
        console.log('Firebase cache cleared');
    },
    
    // ===== REFRESH FIREBASE PRODUCTS =====
    async refreshFirebaseProducts() {
        this.clearFirebaseCache();
        return getFirebaseProducts();
    }
};

window.DataLoader = DataLoader;