/**
 * MAIN.JS - COMPLETELY FIXED VERSION WITH CATEGORY FILTERING
 * Quick View, Product Click Fixed, Category Box, Page-wise filtering
 * AND NEW LAUNCH FEATURE CARD + SMART COMPARE BOX
 * AND PRODUCT DETAILS WITH COLOR + VARIANTS + PRICE
 * AND DISCOUNT ON PRODUCT CARDS + DYNAMIC RAM/STORAGE IN SPECS
 * AND FIXED TRENDING SECTION WITH DISCOUNT PRICE
 * AND AUTO-SCROLL FOR CATEGORIES WITH PAUSE ON TOUCH
 * AND FIREBASE SUPPORT FOR HYBRID PRODUCT MANAGEMENT
 */

// ===== IMPORT DATA-LOADER (already global) =====
// DataLoader is already available via window object

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize all features
    initSearch();
    initBottomNav();
    initTouchGestures();
    initCompareFeature();
    initMenu();
    
    // Load data based on page
    const path = window.location.pathname;
    
    if (path.includes('product.html')) {
        await loadProductDetail();
    } else {
        await loadCategories();
        await loadCategoryBoxes();
        await loadNewLaunchFeature();
        await loadTrending();
        await loadProducts();
        initSorting();
        
        setTimeout(initCategoryBoxScroll, 500);
        
        // ⭐ Initialize auto-scroll after everything is loaded
        setTimeout(() => {
            initCategoryAutoScroll();
            initCategoryBoxAutoScroll();
        }, 1000);
    }
});

// ===== GLOBAL VARIABLES =====
let allProducts = [];
let currentPage = 1;
let cardsPerPage = 40;
let currentFilter = 'All';
let currentSort = 'default';
let compareList = [];
let autoSMSEnabled = true;

// ===== NEW LAUNCH SLIDER VARIABLES =====
let newLaunchProducts = [];
let currentNewLaunchIndex = 0;
let newLaunchInterval = null;
let newLaunchTotalProducts = 0;

// ===== COMPARE BOX STATE =====
let isCompareExpanded = false;
let isEditMode = false;

// ===== PRODUCT DETAIL VARIABLES =====
let currentProduct = null;
let currentColorIndex = 0;
let currentVariantIndex = 0;

// ===== AUTO-SCROLL VARIABLES =====
let categoryScrollInterval = null;
let categoryBoxScrollInterval = null;
let categoryResumeTimeout = null;
let categoryBoxResumeTimeout = null;

// ===== CATEGORY BOX DATA =====
const categoryBoxData = [
    {
        name: 'Mobiles',
        image: 'assets/images/categories/mobiles.png',
        page: 'products.html',
        icon: '📱'
    },
    {
        name: 'Smart TVs',
        image: 'assets/images/categories/tvs.png',
        page: 'tv.html',
        icon: '📺'
    },
    {
        name: 'ACs',
        image: 'assets/images/categories/acs.png',
        page: 'ac.html',
        icon: '❄️'
    },
    {
        name: 'Earphones',
        image: 'assets/images/categories/earphones.png',
        page: 'earphones.html',
        icon: '🎧'
    },
    {
        name: 'Watches',
        image: 'assets/images/categories/watches.png',
        page: 'watches.html',
        icon: '⌚'
    },
    {
        name: 'Laptops',
        image: 'assets/images/categories/laptops.png',
        page: 'laptops.html',
        icon: '💻'
    },
    {
        name: 'Tablets',
        image: 'assets/images/categories/tablets.png',
        page: 'tablets.html',
        icon: '📟'
    },
    {
        name: 'Accessories',
        image: 'assets/images/categories/accessories.png',
        page: 'accessories.html',
        icon: '🔌'
    }
];

// ===== LOAD CATEGORY BOXES =====
function loadCategoryBoxes() {
    const container = document.getElementById('categoryBoxContainer');
    if (!container) return;
    
    container.innerHTML = categoryBoxData.map(category => `
        <a href="${category.page}" class="category-box-card">
            <img src="${category.image}" alt="${category.name}" class="category-box-image" onerror="this.src='https://via.placeholder.com/60x60?text=${encodeURIComponent(category.icon)}'">
            <span class="category-box-name">${category.name}</span>
        </a>
    `).join('');
}

// ===== CATEGORY BOX SCROLL FUNCTIONALITY =====
function initCategoryBoxScroll() {
    const container = document.getElementById('categoryBoxContainer');
    const prevBtn = document.getElementById('categoryBoxPrev');
    const nextBtn = document.getElementById('categoryBoxNext');
    
    if (!container || !prevBtn || !nextBtn) return;
    
    const scrollAmount = 300;
    
    prevBtn.addEventListener('click', () => {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', () => {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
    
    const updateButtons = () => {
        const isAtStart = container.scrollLeft <= 10;
        const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
        
        prevBtn.disabled = isAtStart;
        nextBtn.disabled = isAtEnd;
    };
    
    container.addEventListener('scroll', updateButtons);
    window.addEventListener('resize', updateButtons);
    setTimeout(updateButtons, 100);
}

// ===== FIXED: AUTO-SCROLL FOR CATEGORY CHIPS (All/Vivo/Oppo etc.) =====
function initCategoryAutoScroll() {
    const container = document.querySelector('.category-wrapper');
    if (!container) return;
    
    let isPaused = false;
    const scrollSpeed = 0.5;
    
    function startScroll() {
        if (categoryScrollInterval) clearInterval(categoryScrollInterval);
        
        categoryScrollInterval = setInterval(() => {
            if (!isPaused && container) {
                container.scrollLeft += scrollSpeed;
                
                if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
                    container.scrollLeft = 0;
                }
            }
        }, 20);
    }
    
    function pauseScroll() {
        isPaused = true;
        if (categoryResumeTimeout) clearTimeout(categoryResumeTimeout);
    }
    
    function resumeScroll() {
        if (categoryResumeTimeout) clearTimeout(categoryResumeTimeout);
        categoryResumeTimeout = setTimeout(() => {
            isPaused = false;
        }, 2000); // 2 seconds ke baad resume
    }
    
    // Touch events
    container.addEventListener('touchstart', pauseScroll, { passive: true });
    container.addEventListener('touchend', resumeScroll, { passive: true });
    container.addEventListener('touchcancel', resumeScroll, { passive: true });
    
    // Mouse events for desktop
    container.addEventListener('mouseenter', pauseScroll);
    container.addEventListener('mouseleave', resumeScroll);
    
    startScroll();
}

// ===== FIXED: AUTO-SCROLL FOR CATEGORY BOXES (Phones/TV/AC etc.) =====
function initCategoryBoxAutoScroll() {
    const container = document.querySelector('.category-box-container');
    if (!container) return;
    
    let isPaused = false;
    const scrollSpeed = 0.7;
    
    function startScroll() {
        if (categoryBoxScrollInterval) clearInterval(categoryBoxScrollInterval);
        
        categoryBoxScrollInterval = setInterval(() => {
            if (!isPaused && container) {
                container.scrollLeft += scrollSpeed;
                
                if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
                    container.scrollLeft = 0;
                }
            }
        }, 20);
    }
    
    function pauseScroll() {
        isPaused = true;
        if (categoryBoxResumeTimeout) clearTimeout(categoryBoxResumeTimeout);
    }
    
    function resumeScroll() {
        if (categoryBoxResumeTimeout) clearTimeout(categoryBoxResumeTimeout);
        categoryBoxResumeTimeout = setTimeout(() => {
            isPaused = false;
        }, 2000);
    }
    
    container.addEventListener('touchstart', pauseScroll, { passive: true });
    container.addEventListener('touchend', resumeScroll, { passive: true });
    container.addEventListener('touchcancel', resumeScroll, { passive: true });
    
    container.addEventListener('mouseenter', pauseScroll);
    container.addEventListener('mouseleave', resumeScroll);
    
    startScroll();
}

// ===== NEW LAUNCH FEATURE CARD =====
async function loadNewLaunchFeature() {
    const container = document.getElementById('newLaunchContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="new-launch-loader"><div class="spinner"></div></div>';
    
    try {
        const newLaunchIds = await DataLoader.loadNewLaunch();
        console.log('New Launch IDs:', newLaunchIds);
        
        if (!newLaunchIds || newLaunchIds.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        newLaunchProducts = await DataLoader.loadProducts(newLaunchIds);
        console.log('New Launch products loaded:', newLaunchProducts.length);
        
        if (newLaunchProducts.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        newLaunchTotalProducts = newLaunchProducts.length;
        currentNewLaunchIndex = 0;
        
        const sliderHTML = `
            <div class="new-launch-slider" id="newLaunchSlider">
                ${renderNewLaunchCard(0)}
            </div>
            ${newLaunchTotalProducts > 1 ? '<div class="new-launch-dots" id="newLaunchDots"></div>' : ''}
        `;
        
        container.innerHTML = sliderHTML;
        
        if (newLaunchTotalProducts > 1) {
            createNewLaunchDots();
            startNewLaunchSlider();
        }
        
        document.querySelector('.new-launch-card')?.addEventListener('click', function() {
            const product = newLaunchProducts[currentNewLaunchIndex];
            if (product) {
                window.location.href = `product.html?id=${product.id}`;
            }
        });
        
        document.querySelector('.new-launch-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            const product = newLaunchProducts[currentNewLaunchIndex];
            if (product) {
                window.location.href = `product.html?id=${product.id}`;
            }
        });
        
    } catch (error) {
        console.error('Error loading new launch feature:', error);
        container.innerHTML = '';
    }
}

function renderNewLaunchCard(index) {
    const product = newLaunchProducts[index];
    if (!product) return '';
    
    const description = product.specs 
        ? `${product.specs.RAM || ''} • ${product.specs.Storage || ''} • ${product.specs.Camera || ''}`.replace(/^ • | • $/g, '') 
        : 'Latest smartphone with amazing features';
    
    return `
        <div class="new-launch-card" data-product-id="${product.id}">
            <div class="new-launch-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200'">
            </div>
            <div class="new-launch-content">
                <span class="new-launch-badge">NEW LAUNCH</span>
                <h3 class="new-launch-name">${product.name}</h3>
                <p class="new-launch-description">${description}</p>
                <button class="new-launch-btn">View Details</button>
            </div>
        </div>
    `;
}

function createNewLaunchDots() {
    const dotsContainer = document.getElementById('newLaunchDots');
    if (!dotsContainer) return;
    
    let dotsHTML = '';
    for (let i = 0; i < newLaunchTotalProducts; i++) {
        dotsHTML += `<span class="new-launch-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`;
    }
    dotsContainer.innerHTML = dotsHTML;
    
    document.querySelectorAll('.new-launch-dot').forEach(dot => {
        dot.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            if (!isNaN(index) && index !== currentNewLaunchIndex) {
                goToNewLaunchSlide(index);
            }
        });
    });
}

function goToNewLaunchSlide(index) {
    if (index < 0 || index >= newLaunchTotalProducts || index === currentNewLaunchIndex) return;
    
    const slider = document.getElementById('newLaunchSlider');
    if (!slider) return;
    
    slider.style.opacity = '0';
    
    setTimeout(() => {
        currentNewLaunchIndex = index;
        slider.innerHTML = renderNewLaunchCard(index);
        slider.style.opacity = '1';
        
        document.querySelectorAll('.new-launch-dot').forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        
        document.querySelector('.new-launch-card')?.addEventListener('click', function() {
            const product = newLaunchProducts[currentNewLaunchIndex];
            if (product) {
                window.location.href = `product.html?id=${product.id}`;
            }
        });
        
        document.querySelector('.new-launch-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            const product = newLaunchProducts[currentNewLaunchIndex];
            if (product) {
                window.location.href = `product.html?id=${product.id}`;
            }
        });
        
    }, 200);
}

function startNewLaunchSlider() {
    if (newLaunchInterval) {
        clearInterval(newLaunchInterval);
    }
    
    newLaunchInterval = setInterval(() => {
        const nextIndex = (currentNewLaunchIndex + 1) % newLaunchTotalProducts;
        goToNewLaunchSlide(nextIndex);
    }, 3500);
}

function stopNewLaunchSlider() {
    if (newLaunchInterval) {
        clearInterval(newLaunchInterval);
        newLaunchInterval = null;
    }
}

document.addEventListener('mouseover', function(e) {
    if (e.target.closest('.new-launch-card')) {
        stopNewLaunchSlider();
    }
});

document.addEventListener('mouseout', function(e) {
    if (e.target.closest('.new-launch-card') && newLaunchTotalProducts > 1) {
        startNewLaunchSlider();
    }
});

// ===== MENU FUNCTIONALITY =====
function initMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const menuDropdown = document.getElementById('menuDropdown');
    
    if (menuToggle && menuDropdown) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            menuDropdown.classList.toggle('active');
        });
        
        document.addEventListener('click', function(e) {
            if (!menuToggle.contains(e.target) && !menuDropdown.contains(e.target)) {
                menuToggle.classList.remove('active');
                menuDropdown.classList.remove('active');
            }
        });
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                menuDropdown.classList.remove('active');
            });
        });
    }
}

// ===== SEARCH WITH AUTO-SUGGEST =====
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchSubmit = document.querySelector('.search-submit');
    const suggestionsDiv = document.getElementById('searchSuggestions');
    
    if (!searchInput) return;
    
    let debounceTimer;
    
    searchInput.addEventListener('input', function(e) {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length < 1) {
            suggestionsDiv.classList.remove('active');
            return;
        }
        
        debounceTimer = setTimeout(async () => {
            const results = await DataLoader.searchProducts(query);
            showSuggestions(results.slice(0, 10), query);
        }, 200);
    });
    
    if (searchSubmit) {
        searchSubmit.addEventListener('click', () => performSearch());
    }
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
    });
    
    function performSearch() {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            window.location.href = `products.html?search=${encodeURIComponent(query)}`;
        }
    }
    
    function showSuggestions(products, query) {
        if (!suggestionsDiv) return;
        
        if (products.length === 0) {
            suggestionsDiv.innerHTML = '<div class="suggestion-item" style="justify-content: center; color: #94a3b8;">No products found</div>';
            suggestionsDiv.classList.add('active');
            return;
        }
        
        suggestionsDiv.innerHTML = products.map(product => `
            <div class="suggestion-item" onclick="window.location.href='product.html?id=${product.id}'">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/44'">
                <span>${product.name}</span>
                <span style="margin-left: auto; font-weight: 600; color: #0f172a;">${product.price || ''}</span>
            </div>
        `).join('');
        
        suggestionsDiv.classList.add('active');
    }
    
    document.addEventListener('click', function(e) {
        if (suggestionsDiv && 
            !searchInput.contains(e.target) && 
            !suggestionsDiv.contains(e.target) && 
            !searchSubmit?.contains(e.target)) {
            suggestionsDiv.classList.remove('active');
        }
    });
}

// ===== TOUCH GESTURES =====
function initTouchGestures() {
    let touchStartX = 0, touchEndX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 100 && diff > 0 && window.location.pathname.includes('product.html')) {
            history.back();
        }
    }, { passive: true });
    
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener('touchend', async (e) => {
        const touchEndY = e.changedTouches[0].screenY;
        if (touchEndY - touchStartY > 150 && window.scrollY === 0) {
            showLoading(document.getElementById('productGrid'));
            await loadProducts();
        }
    }, { passive: true });
}

// ===== BOTTOM NAVIGATION =====
function initBottomNav() {
    if (document.querySelector('.bottom-nav')) return;
    
    const bottomNav = document.createElement('div');
    bottomNav.className = 'bottom-nav';
    bottomNav.innerHTML = `
        <a href="index.html" class="nav-item ${window.location.pathname.includes('index') || window.location.pathname === '/' ? 'active' : ''}">
            <span>🏠</span><span>Home</span>
        </a>
        <a href="products.html" class="nav-item ${window.location.pathname.includes('products') ? 'active' : ''}">
            <span>📱</span><span>Products</span>
        </a>
        <div class="nav-item" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
            <span>⬆️</span><span>Top</span>
        </div>
        <a href="tel:+917609074640" class="nav-item">
            <span>📞</span><span>Call</span>
        </a>
        <a href="https://wa.me/917609074640" class="nav-item" target="_blank">
            <span>💬</span><span>WhatsApp</span>
        </a>
    `;
    document.body.appendChild(bottomNav);
}

// ===== SORTING FUNCTIONALITY =====
function initSorting() {
    if (document.querySelector('.sorting-bar')) return;
    
    const sortBar = document.createElement('div');
    sortBar.className = 'sorting-bar';
    sortBar.innerHTML = `
        <select class="sort-select" id="sortSelect">
            <option value="default">Default</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
        </select>
    `;
    
    const productSection = document.querySelector('.product-section .container');
    if (productSection) {
        const productGrid = document.getElementById('productGrid');
        if (productGrid) productSection.insertBefore(sortBar, productGrid);
    }
    
    document.getElementById('sortSelect')?.addEventListener('change', function(e) {
        currentSort = e.target.value;
        currentPage = 1;
        renderProducts();
    });
}

// ===== CATEGORY FILTER FUNCTIONS =====
async function loadCategories() {
    const container = document.getElementById('categoryContainer');
    if (!container) return;
    
    if (window.currentCategory) {
        console.log('On category page:', window.currentCategory);
        return;
    }
    
    const categories = await DataLoader.loadCategories();
    
    container.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat === 'All' ? 'active' : ''}" data-category="${cat}">
            ${cat}
        </button>
    `).join('');
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterProducts(this.dataset.category);
        });
    });
}

// ===== FIXED: FILTER PRODUCTS FUNCTION =====
function filterProducts(category) {
    console.log('Filtering by category:', category, 'Current page category:', window.currentCategory);
    
    // Check if we're on homepage
    const path = window.location.pathname;
    const isHomePage = path === '/' || path.includes('index.html') || path === '';
    
    if (isHomePage) {
        // Homepage pe - redirect to products page
        if (category !== 'All') {
            window.location.href = `products.html?category=${encodeURIComponent(category)}`;
        } else {
            window.location.href = 'products.html';
        }
    } 
    else if (window.currentCategory) {
        // Category page pe (TV, AC, Earphones, etc.)
        if (category !== 'All') {
            currentFilter = category;
            currentPage = 1;
            renderProducts();
        } else {
            currentFilter = 'All';
            currentPage = 1;
            renderProducts();
        }
    } 
    else {
        // Products page pe (products.html)
        if (category !== 'All') {
            window.location.href = `products.html?category=${encodeURIComponent(category)}`;
        } else {
            // ⭐ FIX: Remove category parameter completely
            window.location.href = 'products.html';
        }
    }
}

// ===== TRENDING SECTION - FIXED WITH DISCOUNT PRICE =====
async function loadTrending() {
    const container = document.getElementById('trendingContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    // Load trending products - DataLoader now handles JSON + Firebase
    const products = await DataLoader.loadProductsByCategory('Trending');
    
    if (products.length === 0) {
        container.parentElement.style.display = 'none';
        return;
    }
    
    container.innerHTML = products.map(product => {
        // Get default variant and calculate discounted price
        let displayPrice = product.price || '';
        let originalPriceHtml = '';
        let discountBadgeHtml = '';
        
        // Find default variant
        const defaultVariantId = product.default?.variant;
        const defaultVariant = product.variants?.find(v => v.id === defaultVariantId) || product.variants?.[0];
        
        if (defaultVariant) {
            const price = defaultVariant.price;
            const discount = defaultVariant.discount || 0;
            const discountedPrice = discount > 0 ? Math.round(price * (1 - discount/100)) : price;
            
            displayPrice = `₹${discountedPrice.toLocaleString('en-IN')}`;
            
            if (discount > 0) {
                originalPriceHtml = `<span style="text-decoration: line-through; color: #94a3b8; margin-left: 6px; font-size: 12px;">₹${price.toLocaleString('en-IN')}</span>`;
                discountBadgeHtml = `<span style="background: #10b493; color: white; font-size: 10px; font-weight: 600; padding: 2px 5px; border-radius: 4px; margin-left: 6px;">${discount}% OFF</span>`;
            }
        }
        
        return `
            <div class="trending-card" onclick="window.location.href='product.html?id=${product.id}'">
                <span class="badge">🔥 TRENDING</span>
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/190x170'">
                <div class="card-content">
                    <div class="product-name">${product.name}</div>
                    <div style="font-size: 13px; color: #0f172a; margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap;">
                        ${displayPrice}
                        ${originalPriceHtml}
                        ${discountBadgeHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== FIXED: PRODUCT GRID WITH PROPER CATEGORY FILTERING =====
async function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    showLoading(grid);
    
    const paginationSettings = await DataLoader.loadPagination();
    cardsPerPage = paginationSettings.cardsPerPage || 40;
    
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const searchParam = urlParams.get('search');
    
    console.log('Category parameter:', categoryParam);
    console.log('Current page category:', window.currentCategory);
    
    let products = [];
    
    if (window.currentCategory) {
        console.log(`Loading products for category page: ${window.currentCategory}`);
        
        // Category pages ke liye (TV, AC, Earphones, etc.)
        if (window.currentCategory === 'TV') {
            products = await DataLoader.loadProductsByCategory('TV');
        } else if (window.currentCategory === 'AC') {
            products = await DataLoader.loadProductsByCategory('AC');
        } else if (window.currentCategory === 'Earphones') {
            products = await DataLoader.loadProductsByCategory('Earphones');
        } else if (window.currentCategory === 'Watch') {
            products = await DataLoader.loadProductsByCategory('Watch');
        } else if (window.currentCategory === 'Laptop') {
            products = await DataLoader.loadProductsByCategory('Laptop');
        } else if (window.currentCategory === 'Tablet') {
            products = await DataLoader.loadProductsByCategory('Tablet');
        } else if (window.currentCategory === 'Accessories') {
            products = await DataLoader.loadProductsByCategory('Accessories');
        } else {
            // Fallback - all phones
            products = await DataLoader.loadAllPhones();
        }
    } 
    else if (categoryParam) {
        // Filter by category from URL parameter
        if (categoryParam === 'New Launch') {
            console.log('Loading New Launch products...');
            products = await DataLoader.loadProductsByCategory('New Launch');
        } else if (categoryParam === 'Trending') {
            console.log('Loading Trending products...');
            products = await DataLoader.loadProductsByCategory('Trending');
        } else if (categoryParam !== 'All') {
            console.log(`Loading products for brand: ${categoryParam}`);
            const allPhones = await DataLoader.loadAllPhones();
            products = allPhones.filter(p => 
                p.brand === categoryParam || 
                p.category === categoryParam ||
                (categoryParam === 'iPhone' && p.brand === 'Apple') ||
                (categoryParam === 'Apple' && p.brand === 'iPhone')
            );
        } else {
            products = await DataLoader.loadAllPhones();
        }
    } 
    else if (searchParam) {
        // Search products
        console.log('Searching for:', searchParam);
        products = await DataLoader.searchProducts(searchParam);
    }
    else {
        // Default - all phones
        console.log('Loading all phones (homepage)');
        products = await DataLoader.loadAllPhones();
    }
    
    console.log('Loaded products:', products.length);
    allProducts = products;
    
    // Highlight active category button
    if (!window.currentCategory) {
        if (categoryParam) {
            document.querySelectorAll('.category-btn').forEach(btn => {
                if (btn.dataset.category === categoryParam) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        } else {
            document.querySelectorAll('.category-btn').forEach(btn => {
                if (btn.dataset.category === 'All') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }
    
    // Mark new products
    const newLaunchIds = await DataLoader.loadNewLaunch();
    allProducts = allProducts.map(p => ({
        ...p,
        isNew: newLaunchIds.includes(p.id) || p.tags?.includes('new')
    }));
    
    renderProducts();
}

function showLoading(element) {
    element.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
}

function getFilteredAndSortedProducts() {
    let filtered = currentFilter === 'All' 
        ? allProducts 
        : allProducts.filter(p => p.brand === currentFilter || p.category === currentFilter);
    
    switch(currentSort) {
        case 'price-low':
            filtered.sort((a, b) => {
                const variantA = a.variants?.[0] || { price: 0 };
                const variantB = b.variants?.[0] || { price: 0 };
                const priceA = variantA.price || 0;
                const priceB = variantB.price || 0;
                return priceA - priceB;
            });
            break;
        case 'price-high':
            filtered.sort((a, b) => {
                const variantA = a.variants?.[0] || { price: 0 };
                const variantB = b.variants?.[0] || { price: 0 };
                const priceA = variantA.price || 0;
                const priceB = variantB.price || 0;
                return priceB - priceA;
            });
            break;
        case 'name-asc':
            filtered.sort((a, b) => a.name?.localeCompare(b.name));
            break;
        case 'name-desc':
            filtered.sort((a, b) => b.name?.localeCompare(a.name));
            break;
    }
    
    return filtered;
}

// ===== RENDER PRODUCTS - UPDATED WITH DISCOUNT PRICE =====
function renderProducts() {
    const grid = document.getElementById('productGrid');
    const paginationDiv = document.getElementById('pagination');
    if (!grid) return;
    
    const filtered = getFilteredAndSortedProducts();
    const totalPages = Math.ceil(filtered.length / cardsPerPage);
    const start = (currentPage - 1) * cardsPerPage;
    const end = start + cardsPerPage;
    const pageProducts = filtered.slice(start, end);
    
    if (pageProducts.length === 0) {
        let message = '📱 No products found';
        if (window.currentCategory) {
            message = `📱 No ${window.currentCategory} products found`;
        }
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #64748b;">${message}</div>`;
    } else {
        grid.innerHTML = pageProducts.map(product => {
            // Get default variant and calculate discounted price
            let displayPrice = product.price || 'Contact for price';
            let originalPriceHtml = '';
            let discountBadgeHtml = '';
            
            // Find default variant
            const defaultVariantId = product.default?.variant;
            const defaultVariant = product.variants?.find(v => v.id === defaultVariantId) || product.variants?.[0];
            
            if (defaultVariant) {
                const price = defaultVariant.price;
                const discount = defaultVariant.discount || 0;
                const discountedPrice = discount > 0 ? Math.round(price * (1 - discount/100)) : price;
                
                displayPrice = `₹${discountedPrice.toLocaleString('en-IN')}`;
                
                if (discount > 0) {
                    originalPriceHtml = `<span class="original-price">₹${price.toLocaleString('en-IN')}</span>`;
                    discountBadgeHtml = `<span class="discount-badge">${discount}% OFF</span>`;
                }
            }
            
            return `
                <div class="product-card" data-product-id="${product.id}">
                    <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/170'">
                    <div class="product-info">
                        <div class="product-name">${product.name}</div>
                        <div class="product-price">
                            ${displayPrice}
                            ${originalPriceHtml}
                            ${discountBadgeHtml}
                        </div>
                        <div class="product-footer">
                            ${product.isNew ? '<span class="product-badge">NEW</span>' : '<span></span>'}
                            <button class="quick-view-btn" data-product-id="${product.id}">Quick View</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        setTimeout(attachProductListeners, 100);
    }
    
    renderPagination(totalPages);
}

// ===== ATTACH PRODUCT LISTENERS =====
function attachProductListeners() {
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.classList.contains('quick-view-btn')) return;
            const productId = this.dataset.productId;
            if (productId) window.location.href = `product.html?id=${productId}`;
        });
    });
    
    document.querySelectorAll('.quick-view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const productId = this.dataset.productId;
            if (productId) quickView(productId);
        });
    });
}

function renderPagination(totalPages) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '<button class="pagination-btn" ' + (currentPage === 1 ? 'disabled' : '') + ' onclick="changePage(' + (currentPage - 1) + ')">←</button>';
    
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += '<button class="pagination-btn" onclick="changePage(1)">1</button>';
        if (startPage > 2) html += '<span class="pagination-btn" style="border: none;">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-btn" style="border: none;">...</span>';
        html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    html += '<button class="pagination-btn" ' + (currentPage === totalPages ? 'disabled' : '') + ' onclick="changePage(' + (currentPage + 1) + ')">→</button>';
    
    paginationDiv.innerHTML = html;
}

window.changePage = function(page) {
    currentPage = page;
    renderProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ===== QUICK VIEW =====
async function quickView(productId) {
    if (!productId) return;
    
    const product = await DataLoader.loadProduct(productId);
    if (!product) {
        alert('Product not found!');
        return;
    }
    
    const existingModal = document.querySelector('.quick-view-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'quick-view-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.closest('.quick-view-modal').remove()">✕</span>
            <img src="${product.image}" alt="${product.name}" style="width:100%; max-height:200px; object-fit:contain; margin-bottom:16px;" onerror="this.src='https://via.placeholder.com/200'">
            <h3 style="font-size:20px; margin-bottom:8px;">${product.name}</h3>
            <div style="font-size:22px; font-weight:700; color:#0f172a; margin-bottom:16px;">
                ${product.variants?.[0] ? `₹${Math.round(product.variants[0].price * (1 - (product.variants[0].discount || 0)/100)).toLocaleString('en-IN')}` : (product.price || 'Contact for price')}
            </div>
            <div style="margin-bottom:16px;">
                ${Object.entries(product.specs || {}).slice(0, 4).map(([key, value]) => `
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                        <span style="color:#64748b;">${key}</span>
                        <span style="font-weight:500;">${value}</span>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex; gap:12px;">
                <a href="product.html?id=${product.id}" style="flex:1; background:#0f172a; color:white; text-align:center; padding:14px; border-radius:30px; text-decoration:none; font-weight:600;">View Full Details</a>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
}

// ===== SMART COMPARE FEATURE =====
function initCompareFeature() {
    const saved = localStorage.getItem('compareList');
    if (saved) {
        compareList = JSON.parse(saved);
    }
    
    createCompareBar();
    updateCompareBar();
}

function createCompareBar() {
    if (document.getElementById('compareBar')) return;
    
    const compareBar = document.createElement('div');
    compareBar.className = 'compare-bar';
    compareBar.id = 'compareBar';
    compareBar.innerHTML = `
        <div class="compare-header" id="compareHeader">
            <div class="compare-header-left">
                <span class="compare-count-badge" id="compareCountBadge">0</span>
                <span>items selected</span>
            </div>
            <div class="compare-toggle-icon" id="compareToggle">⬆️</div>
        </div>
        <div class="compare-products" id="compareProducts"></div>
        <div class="compare-actions">
            <button class="compare-btn compare-edit-btn" id="compareEditBtn">✏️ Edit</button>
            <button class="compare-btn" id="compareNowBtn">Compare Now</button>
        </div>
        <button class="clear-all-btn" id="clearAllBtn">Clear All</button>
    `;
    
    document.body.appendChild(compareBar);
    
    // Add event listeners
    document.getElementById('compareHeader').addEventListener('click', toggleCompareBox);
    document.getElementById('compareToggle').addEventListener('click', toggleCompareBox);
    document.getElementById('compareEditBtn').addEventListener('click', toggleEditMode);
    document.getElementById('compareNowBtn').addEventListener('click', compareProducts);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllCompare);
}

function updateCompareBar() {
    const compareBar = document.getElementById('compareBar');
    const countBadge = document.getElementById('compareCountBadge');
    const productsContainer = document.getElementById('compareProducts');
    
    if (!compareBar || !countBadge || !productsContainer) return;
    
    // Update count
    countBadge.textContent = compareList.length;
    
    // Show/hide based on list
    if (compareList.length > 0) {
        compareBar.classList.add('active');
        
        // Set initial state
        if (!isCompareExpanded) {
            compareBar.classList.add('collapsed');
            compareBar.classList.remove('expanded');
            document.getElementById('compareToggle').textContent = '⬆️';
        } else {
            compareBar.classList.add('expanded');
            compareBar.classList.remove('collapsed');
            document.getElementById('compareToggle').textContent = '⬇️';
        }
        
        // Render products
        renderCompareProducts();
    } else {
        compareBar.classList.remove('active', 'expanded', 'collapsed');
        isCompareExpanded = false;
        isEditMode = false;
    }
}

async function renderCompareProducts() {
    const container = document.getElementById('compareProducts');
    if (!container) return;
    
    if (compareList.length === 0) {
        container.innerHTML = '<div class="compare-empty">No items selected</div>';
        return;
    }
    
    // Load product details
    const products = await DataLoader.loadProducts(compareList);
    
    let html = '';
    for (const product of products) {
        if (!product) continue;
        
        html += `
            <div class="compare-product-item ${isEditMode ? 'edit-mode' : ''}" data-product-id="${product.id}">
                <div class="compare-product-info">
                    <img src="${product.image}" alt="${product.name}" class="compare-product-image" onerror="this.src='https://via.placeholder.com/32'">
                    <span class="compare-product-name">${product.name}</span>
                </div>
                <button class="compare-remove-btn" onclick="removeFromCompare('${product.id}')">✕</button>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Update edit button text
    const editBtn = document.getElementById('compareEditBtn');
    if (editBtn) {
        editBtn.textContent = isEditMode ? '✅ Done' : '✏️ Edit';
        if (isEditMode) {
            editBtn.classList.add('edit-mode-active');
        } else {
            editBtn.classList.remove('edit-mode-active');
        }
    }
}

function toggleCompareBox(e) {
    e.stopPropagation();
    
    const compareBar = document.getElementById('compareBar');
    if (!compareBar) return;
    
    isCompareExpanded = !isCompareExpanded;
    
    if (isCompareExpanded) {
        compareBar.classList.add('expanded');
        compareBar.classList.remove('collapsed');
        document.getElementById('compareToggle').textContent = '⬇️';
    } else {
        compareBar.classList.add('collapsed');
        compareBar.classList.remove('expanded');
        document.getElementById('compareToggle').textContent = '⬆️';
        
        // Exit edit mode when collapsing
        if (isEditMode) {
            isEditMode = false;
            renderCompareProducts();
        }
    }
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    renderCompareProducts();
}

window.removeFromCompare = function(productId) {
    addToCompare(productId); // This will toggle it off
};

function clearAllCompare() {
    compareList = [];
    localStorage.setItem('compareList', JSON.stringify(compareList));
    
    if (isEditMode) {
        isEditMode = false;
    }
    
    updateCompareBar();
    
    // Uncheck all checkboxes
    document.querySelectorAll('.compare-checkbox input').forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Update the addToCompare function
window.addToCompare = function(productId) {
    if (compareList.includes(productId)) {
        compareList = compareList.filter(id => id !== productId);
    } else {
        if (compareList.length >= 4) {
            alert('You can compare up to 4 products');
            return;
        }
        compareList.push(productId);
    }
    
    localStorage.setItem('compareList', JSON.stringify(compareList));
    
    // Update checkbox state
    const checkbox = document.getElementById(`compareCheckbox-${productId}`);
    if (checkbox) {
        checkbox.checked = compareList.includes(productId);
    }
    
    updateCompareBar();
};

// Update compareProducts function
window.compareProducts = function() {
    if (compareList.length < 2) {
        alert('Select at least 2 products to compare');
        return;
    }
    
    // You can implement comparison page here
    window.location.href = `compare.html?ids=${compareList.join(',')}`;
};

// ===== AUTO SMS SYSTEM =====
async function sendAutoSMS(messageType) {
    if (!autoSMSEnabled) return;
    
    try {
        const customers = await loadCustomers();
        const message = await loadMessageTemplate(messageType);
        console.log('Sending SMS to:', customers.length, 'customers');
        console.log('Message:', message);
        await logSMSSent(messageType, customers.length);
    } catch (error) {
        console.error('Auto SMS failed:', error);
    }
}

async function loadCustomers() {
    try {
        const response = await fetch('notifications/customers.txt');
        const text = await response.text();
        return text.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [name, phone, device] = line.split('|').map(s => s.trim());
                return { name, phone, device };
            });
    } catch {
        return [];
    }
}

async function loadMessageTemplate(type) {
    try {
        const response = await fetch('notifications/messages.txt');
        const text = await response.text();
        const sections = text.split('\n\n');
        const section = sections.find(s => s.startsWith(type + ':'));
        return section ? section.replace(type + ':', '').trim() : '';
    } catch {
        return '';
    }
}

async function logSMSSent(type, count) {
    const logEntry = `${new Date().toISOString()} | ${type} | Sent to ${count} customers\n`;
    console.log('SMS Log:', logEntry);
}

// ===== UPDATED: PRODUCT DETAIL PAGE WITH COLORS + VARIANTS =====
async function loadProductDetail() {
    const container = document.getElementById('productDetail');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Product not found</p>';
        return;
    }
    
    const product = await DataLoader.loadProduct(productId);
    
    if (!product) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Product not found</p>';
        return;
    }
    
    currentProduct = product;
    document.title = `${product.name} - Subho Mobile Shop`;
    
    // Set default selections
    if (product.colors && product.colors.length > 0) {
        // Find default color
        const defaultColorName = product.default?.color;
        currentColorIndex = product.colors.findIndex(c => c.name === defaultColorName);
        if (currentColorIndex === -1) currentColorIndex = 0;
    }
    
    if (product.variants && product.variants.length > 0) {
        // Find default variant
        const defaultVariantId = product.default?.variant;
        currentVariantIndex = product.variants.findIndex(v => v.id === defaultVariantId);
        if (currentVariantIndex === -1) currentVariantIndex = 0;
    }
    
    // Render the product detail with new structure
    container.innerHTML = renderProductDetail(product);
    
    // Initialize color and variant click handlers
    initProductDetailInteractions();
    
    if (product.tags?.includes('new')) {
        sendAutoSMS('NEW_PHONE');
    }
}

// ===== RENDER PRODUCT DETAIL WITH NEW STRUCTURE AND DYNAMIC RAM/STORAGE =====
function renderProductDetail(product) {
    const currentVariant = product.variants?.[currentVariantIndex];
    const currentColor = product.colors?.[currentColorIndex];
    
    // Calculate discounted price
    let displayPrice = '';
    let originalPrice = '';
    let discountBadge = '';
    
    if (currentVariant) {
        const price = currentVariant.price;
        const discount = currentVariant.discount || 0;
        const discountedPrice = discount > 0 ? Math.round(price * (1 - discount/100)) : price;
        
        displayPrice = `₹${discountedPrice.toLocaleString('en-IN')}`;
        
        if (discount > 0) {
            originalPrice = `<span class="original-price">₹${price.toLocaleString('en-IN')}</span>`;
            discountBadge = `<span class="discount-badge">${discount}% OFF</span>`;
        }
    }
    
    // Get current image
    const currentImage = currentColor?.images?.[0] || product.image;
    
    // Get RAM and Storage from variant or fallback to specs
    const ramFromVariant = currentVariant?.ram || product.specs?.RAM || '';
    const storageFromVariant = currentVariant?.storage || product.specs?.Storage || '';
    
    return `
        <div class="product-left">
            <div class="product-main-image">
                <img src="${currentImage}" alt="${product.name}" id="mainProductImage" onerror="this.src='${product.image}'">
            </div>
            
            ${product.colors && product.colors.length > 0 ? `
                <div class="color-variants">
                    <h4>Available Colors</h4>
                    <div class="color-box-container">
                        ${product.colors.map((color, index) => `
                            <div class="color-box ${index === currentColorIndex ? 'active' : ''}" 
                                 data-color-index="${index}"
                                 data-image="${color.images?.[0] || product.image}"
                                 title="${color.name}">
                                <img src="${color.images?.[0] || product.image}" 
                                     alt="${color.name}" 
                                     onerror="this.src='${product.image}'">
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="product-right">
            <h1 class="product-name">${product.name}</h1>
            
            <div class="price-section">
                <div class="current-price">
                    ${displayPrice || product.price || 'Call for price'}
                    ${originalPrice}
                    ${discountBadge}
                </div>
            </div>
            
            ${product.variants && product.variants.length > 0 ? `
                <div class="variant-section">
                    <h4>Select Storage & RAM</h4>
                    <div class="variant-grid">
                        ${product.variants.map((variant, index) => {
                            const discountedPrice = variant.discount > 0 
                                ? Math.round(variant.price * (1 - variant.discount/100)) 
                                : variant.price;
                            
                            return `
                                <div class="variant-box ${!variant.available ? 'unavailable' : ''} ${index === currentVariantIndex ? 'active' : ''}" 
                                     data-variant-index="${index}"
                                     data-ram="${variant.ram}"
                                     data-storage="${variant.storage}"
                                     ${!variant.available ? 'disabled' : ''}>
                                    <span class="variant-ram">${variant.storage} + ${variant.ram}</span>
                                    <span class="variant-price">₹${discountedPrice.toLocaleString('en-IN')}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="selected-info" id="selectedInfo">
                ${currentColor ? `<p>🎨 Selected Color: <span>${currentColor.name}</span></p>` : ''}
                ${currentVariant ? `<p>📦 Selected Variant: <span>${currentVariant.storage} + ${currentVariant.ram}</span></p>` : ''}
            </div>
            
            <p class="detail-availability">✅ Available at our shop</p>
            
            <div class="cta-buttons">
                <a href="tel:+917609074640" class="btn-call">📞 Call Now</a>
                <a href="https://wa.me/917609074640?text=Hi, I'm interested in ${product.name}" class="btn-whatsapp" target="_blank">💬 WhatsApp</a>
            </div>
            
            <div class="compare-checkbox">
                <input type="checkbox" id="compareCheckbox-${product.id}" ${compareList.includes(product.id) ? 'checked' : ''} onchange="addToCompare('${product.id}')">
                <label for="compareCheckbox-${product.id}">Add to compare</label>
            </div>
            
            <div class="specs-section">
                <h3 class="specs-title">📋 Full Specifications</h3>
                <div class="specs-list">
                    <!-- DYNAMIC: RAM from variant -->
                    <div class="spec-item" id="spec-ram">
                        <span class="spec-label">RAM:</span>
                        <span class="spec-value">${ramFromVariant}</span>
                    </div>
                    
                    <!-- DYNAMIC: Storage from variant -->
                    <div class="spec-item" id="spec-storage">
                        <span class="spec-label">Storage:</span>
                        <span class="spec-value">${storageFromVariant}</span>
                    </div>
                    
                    <!-- STATIC: Other specs from specs object (filter out RAM/Storage if present) -->
                    ${Object.entries(product.specs || {})
                        .filter(([key]) => key !== 'RAM' && key !== 'Storage')
                        .map(([key, value]) => `
                        <div class="spec-item">
                            <span class="spec-label">${key}:</span>
                            <span class="spec-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// ===== INIT PRODUCT DETAIL INTERACTIONS - UPDATED WITH SPECS UPDATE =====
function initProductDetailInteractions() {
    if (!currentProduct) return;
    
    // Color box click handlers
    document.querySelectorAll('.color-box').forEach(box => {
        box.addEventListener('click', function() {
            const index = parseInt(this.dataset.colorIndex);
            if (index === currentColorIndex) return;
            
            // Update active state
            document.querySelectorAll('.color-box').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update main image
            const newImage = this.dataset.image;
            document.getElementById('mainProductImage').src = newImage;
            
            // Update current color index
            currentColorIndex = index;
            
            // Update selected info
            updateSelectedInfo();
        });
    });
    
    // Variant box click handlers
    document.querySelectorAll('.variant-box:not(.unavailable)').forEach(box => {
        box.addEventListener('click', function() {
            const index = parseInt(this.dataset.variantIndex);
            if (index === currentVariantIndex) return;
            
            // Update active state
            document.querySelectorAll('.variant-box').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update current variant index
            currentVariantIndex = index;
            const variant = currentProduct.variants[currentVariantIndex];
            
            // Update price display
            updatePriceDisplay();
            
            // Update selected info
            updateSelectedInfo();
            
            // Update RAM and Storage in specs
            updateSpecsFromVariant(variant);
        });
    });
}

// ===== UPDATE PRICE DISPLAY =====
function updatePriceDisplay() {
    if (!currentProduct || !currentProduct.variants) return;
    
    const variant = currentProduct.variants[currentVariantIndex];
    if (!variant) return;
    
    const price = variant.price;
    const discount = variant.discount || 0;
    const discountedPrice = discount > 0 ? Math.round(price * (1 - discount/100)) : price;
    
    const priceSection = document.querySelector('.price-section .current-price');
    if (priceSection) {
        let html = `₹${discountedPrice.toLocaleString('en-IN')}`;
        
        if (discount > 0) {
            html += ` <span class="original-price">₹${price.toLocaleString('en-IN')}</span>`;
            html += ` <span class="discount-badge">${discount}% OFF</span>`;
        }
        
        priceSection.innerHTML = html;
    }
}

// ===== UPDATE SELECTED INFO =====
function updateSelectedInfo() {
    const selectedInfo = document.getElementById('selectedInfo');
    if (!selectedInfo || !currentProduct) return;
    
    let html = '';
    
    if (currentProduct.colors && currentProduct.colors[currentColorIndex]) {
        const color = currentProduct.colors[currentColorIndex];
        html += `<p>🎨 Selected Color: <span>${color.name}</span></p>`;
    }
    
    if (currentProduct.variants && currentProduct.variants[currentVariantIndex]) {
        const variant = currentProduct.variants[currentVariantIndex];
        html += `<p>📦 Selected Variant: <span>${variant.storage} + ${variant.ram}</span></p>`;
    }
    
    selectedInfo.innerHTML = html;
}

// ===== NEW FUNCTION: UPDATE SPECS FROM VARIANT =====
function updateSpecsFromVariant(variant) {
    if (!variant) return;
    
    const ramElement = document.querySelector('#spec-ram .spec-value');
    const storageElement = document.querySelector('#spec-storage .spec-value');
    
    if (ramElement && variant.ram) {
        ramElement.textContent = variant.ram;
    }
    
    if (storageElement && variant.storage) {
        storageElement.textContent = variant.storage;
    }
}