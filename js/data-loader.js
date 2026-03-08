/**
 * DATA-LOADER.JS
 * Cloudflare + Local Compatible Version
 * All products loaded from GitHub API via Cloudflare Functions
 */

// ===== API BASE URL DETECTOR =====
function getApiBase() {
    if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    ) {
        return "http://localhost:8788/api"; // Cloudflare local dev
    }

    return "/api"; // Production Cloudflare
}

// ===== 1. FETCH ALL PRODUCTS =====
async function fetchGitHubProducts() {
    try {
        const response = await fetch(`${getApiBase()}/get-products`);

        if (!response.ok) {
            console.warn("GitHub API not available");
            return [];
        }

        const data = await response.json();
        return data.data || data.products || [];
    } catch (error) {
        console.warn("Error fetching products:", error.message);
        return [];
    }
}

// ===== FETCH PRODUCTS BY CATEGORY =====
async function fetchGitHubProductsByCategory(category) {
    try {
        const response = await fetch(
            `${getApiBase()}/get-products?category=${encodeURIComponent(
                category
            )}`
        );

        if (!response.ok) return [];

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.warn("Category fetch error:", error.message);
        return [];
    }
}

// ===== FETCH JSON FILE =====
async function fetchGitHubJsonFile(type) {
    try {
        const response = await fetch(
            `${getApiBase()}/get-products?type=${encodeURIComponent(type)}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.warn("JSON fetch error:", error.message);
        return null;
    }
}

// ===== MAIN DATA LOADER =====
const DataLoader = {
    basePath: "data/",

    // ===== CATEGORIES =====
    async loadCategories() {
        try {
            const github = await fetchGitHubJsonFile("categories");

            if (github && github.length) return github;

            const response = await fetch(this.basePath + "categories.json");
            return await response.json();
        } catch {
            return ["All", "iPhone", "Samsung", "Vivo"];
        }
    },

    // ===== TRENDING =====
    async loadTrending() {
        try {
            const github = await fetchGitHubJsonFile("trending");

            if (github && github.length) return github;

            const response = await fetch(this.basePath + "trending.json");
            return await response.json();
        } catch {
            return [];
        }
    },

    // ===== NEW LAUNCH =====
    async loadNewLaunch() {
        try {
            const github = await fetchGitHubJsonFile("new-launch");

            if (github && github.length) return github;

            const response = await fetch(this.basePath + "new-launch.json");
            return await response.json();
        } catch {
            return [];
        }
    },

    // ===== LOAD PRODUCT =====
    async loadProduct(productId) {
        const products = await fetchGitHubProducts();

        const product = products.find(
            (p) => p.id === productId || p._id === productId
        );

        if (product) {
            product.source = "github";
            return product;
        }

        return null;
    },

    // ===== LOAD MULTIPLE PRODUCTS =====
    async loadProducts(productIds) {
        const promises = productIds.map((id) => this.loadProduct(id));
        const products = await Promise.all(promises);

        return products.filter((p) => p && p.status !== "inactive");
    },

    // ===== LOAD ALL PHONES =====
    async loadAllPhones() {
        const products = await fetchGitHubProducts();

        const phoneBrands = [
            "iPhone",
            "Samsung",
            "Vivo",
            "Oppo",
            "Redmi",
            "OnePlus",
            "Nothing",
        ];

        return products.filter(
            (p) =>
                phoneBrands.includes(p.brand) ||
                phoneBrands.includes(p.category)
        );
    },

    // ===== LOAD ALL PRODUCTS =====
    async loadAllProducts() {
        const products = await fetchGitHubProducts();

        console.log("Total products loaded:", products.length);

        return products;
    },

    // ===== CATEGORY FILTER =====
    async loadProductsByCategory(category) {
        if (category === "All") return this.loadAllProducts();

        const products = await fetchGitHubProductsByCategory(category);

        return products;
    },

    // ===== SEARCH =====
    async searchProducts(query) {
        const products = await this.loadAllProducts();
        const q = query.toLowerCase();

        return products.filter((p) => {
            return (
                p.name?.toLowerCase().includes(q) ||
                p.brand?.toLowerCase().includes(q) ||
                p.category?.toLowerCase().includes(q)
            );
        });
    },

    clearCache() {
        console.log("Cache cleared");
    },
};

window.DataLoader = DataLoader;