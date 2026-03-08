/**
 * GITHUB-API.JS - GitHub API Utility for Netlify Functions
 * 
 * यह file सभी Netlify functions के लिए common GitHub API helper provide करती है
 * - Read files from GitHub
 * - Write files to GitHub
 * - Delete files from GitHub
 * - List files in directory
 */

// ===== 1. IMPORTS =====
const { Octokit } = require('@octokit/rest');

// ===== 2. CONFIGURATION =====
// GitHub credentials from environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is not set');
}

if (!GITHUB_OWNER) {
    console.error('❌ GITHUB_OWNER environment variable is not set');
}

if (!GITHUB_REPO) {
    console.error('❌ GITHUB_REPO environment variable is not set');
}

// ===== 3. OCTOKIT INSTANCE =====
let octokit = null;

function getOctokit() {
    if (!octokit) {
        octokit = new Octokit({ 
            auth: GITHUB_TOKEN,
            userAgent: 'Banashree-Mobile-App v1.0',
            baseUrl: 'https://api.github.com',
            log: {
                debug: () => {},
                info: console.log,
                warn: console.warn,
                error: console.error
            }
        });
    }
    return octokit;
}

// ===== 4. READ FILE FROM GITHUB =====
/**
 * GitHub से file read करता है
 * @param {string} path - File path in repository
 * @returns {Promise<{content: any, sha: string, path: string}>}
 */
async function readFile(path) {
    try {
        const octokit = getOctokit();
        console.log(`📖 Reading file: ${path}`);
        
        const { data } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: path,
            ref: GITHUB_BRANCH
        });
        
        // GitHub returns content as base64
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        let parsedContent;
        
        try {
            parsedContent = JSON.parse(content);
        } catch (e) {
            parsedContent = content; // Not JSON, return as string
        }
        
        return {
            content: parsedContent,
            sha: data.sha,
            path: data.path,
            size: data.size
        };
    } catch (error) {
        if (error.status === 404) {
            console.log(`⚠️ File not found: ${path}`);
            return null;
        }
        console.error('❌ Error reading file:', error);
        throw error;
    }
}

// ===== 5. WRITE FILE TO GITHUB =====
/**
 * GitHub पर file write/update करता है
 * @param {string} path - File path in repository
 * @param {any} content - File content (will be JSON.stringify'ed)
 * @param {string} sha - SHA of existing file (for updates)
 * @param {string} message - Commit message
 * @returns {Promise<{commit: any, content: any}>}
 */
async function writeFile(path, content, sha = null, message = null) {
    try {
        const octokit = getOctokit();
        
        // Convert content to JSON string if it's an object
        const contentString = typeof content === 'object' 
            ? JSON.stringify(content, null, 2) 
            : String(content);
        
        const commitMessage = message || (sha ? `Update ${path}` : `Create ${path}`);
        
        console.log(`📝 Writing file: ${path} (${sha ? 'update' : 'create'})`);
        
        const { data } = await octokit.repos.createOrUpdateFileContents({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: path,
            message: commitMessage,
            content: Buffer.from(contentString).toString('base64'),
            sha: sha, // For updates, sha is required
            branch: GITHUB_BRANCH
        });
        
        return {
            commit: data.commit,
            content: data.content,
            sha: data.content.sha
        };
    } catch (error) {
        console.error('❌ Error writing file:', error);
        throw error;
    }
}

// ===== 6. DELETE FILE FROM GITHUB =====
/**
 * GitHub से file delete करता है
 * @param {string} path - File path in repository
 * @param {string} sha - SHA of file to delete
 * @param {string} message - Commit message
 * @returns {Promise<boolean>}
 */
async function deleteFile(path, sha, message = null) {
    try {
        const octokit = getOctokit();
        const commitMessage = message || `Delete ${path}`;
        
        console.log(`🗑️ Deleting file: ${path}`);
        
        await octokit.repos.deleteFile({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: path,
            message: commitMessage,
            sha: sha,
            branch: GITHUB_BRANCH
        });
        
        return true;
    } catch (error) {
        console.error('❌ Error deleting file:', error);
        throw error;
    }
}

// ===== 7. LIST FILES IN DIRECTORY =====
/**
 * Directory में सभी files list करता है
 * @param {string} path - Directory path
 * @returns {Promise<Array>}
 */
async function listFiles(path) {
    try {
        const octokit = getOctokit();
        console.log(`📂 Listing files in: ${path || 'root'}`);
        
        const { data } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: path || '',
            ref: GITHUB_BRANCH
        });
        
        // Filter only files (not directories)
        return data
            .filter(item => item.type === 'file')
            .map(file => ({
                name: file.name,
                path: file.path,
                sha: file.sha,
                size: file.size,
                download_url: file.download_url
            }));
    } catch (error) {
        if (error.status === 404) {
            return []; // Directory doesn't exist
        }
        console.error('❌ Error listing files:', error);
        throw error;
    }
}

// ===== 8. GET ALL PRODUCTS =====
/**
 * सभी products को load करता है (phone-products और products folders से)
 * @returns {Promise<Array>}
 */
async function getAllProducts() {
    try {
        const products = [];
        
        // 1. Get all phone products
        const phoneFiles = await listFiles('phone-products');
        for (const file of phoneFiles) {
            if (file.name.endsWith('.json')) {
                const fileData = await readFile(file.path);
                if (fileData) {
                    products.push({
                        ...fileData.content,
                        _id: file.name.replace('.json', ''),
                        sha: fileData.sha,
                        path: file.path,
                        source: 'phone-products'
                    });
                }
            }
        }
        
        // 2. Get all other products from categories
        const categoryFolders = ['tv', 'ac', 'earphones', 'watch', 'laptop', 'tablet', 'accessories'];
        
        for (const category of categoryFolders) {
            const categoryFiles = await listFiles(`products/${category}`);
            for (const file of categoryFiles) {
                if (file.name.endsWith('.json')) {
                    const fileData = await readFile(file.path);
                    if (fileData) {
                        products.push({
                            ...fileData.content,
                            _id: file.name.replace('.json', ''),
                            sha: fileData.sha,
                            path: file.path,
                            source: `products/${category}`
                        });
                    }
                }
            }
        }
        
        return products;
    } catch (error) {
        console.error('❌ Error getting all products:', error);
        throw error;
    }
}

// ===== 9. GET PRODUCT BY CATEGORY =====
/**
 * Category के according products लोड करता है
 * @param {string} category - Category name
 * @returns {Promise<Array>}
 */
async function getProductsByCategory(category) {
    try {
        const products = [];
        
        // Phone categories
        const phoneCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
        
        if (phoneCategories.includes(category)) {
            // Phone products folder
            const phoneFiles = await listFiles('phone-products');
            for (const file of phoneFiles) {
                if (file.name.endsWith('.json')) {
                    const fileData = await readFile(file.path);
                    if (fileData && fileData.content.category === category) {
                        products.push({
                            ...fileData.content,
                            _id: file.name.replace('.json', ''),
                            sha: fileData.sha,
                            path: file.path
                        });
                    }
                }
            }
        } else {
            // Other categories
            const categoryPath = `products/${category.toLowerCase()}`;
            const categoryFiles = await listFiles(categoryPath);
            
            for (const file of categoryFiles) {
                if (file.name.endsWith('.json')) {
                    const fileData = await readFile(file.path);
                    if (fileData) {
                        products.push({
                            ...fileData.content,
                            _id: file.name.replace('.json', ''),
                            sha: fileData.sha,
                            path: file.path
                        });
                    }
                }
            }
        }
        
        return products;
    } catch (error) {
        console.error(`❌ Error getting products for category ${category}:`, error);
        throw error;
    }
}

// ===== 10. GET JSON FILE =====
/**
 * JSON file को read करता है (categories.json, trending.json, etc.)
 * @param {string} fileName - JSON file name
 * @returns {Promise<any>}
 */
async function getJsonFile(fileName) {
    try {
        const fileData = await readFile(fileName);
        return fileData ? fileData.content : null;
    } catch (error) {
        console.error(`❌ Error reading ${fileName}:`, error);
        return null;
    }
}

// ===== 11. DETERMINE PRODUCT PATH =====
/**
 * Product की category के according path decide करता है
 * @param {Object} product - Product object
 * @returns {string} - GitHub file path
 */
function getProductPath(product) {
    const phoneCategories = ['iPhone', 'Samsung', 'Vivo', 'Oppo', 'Redmi', 'OnePlus', 'Nothing'];
    const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (phoneCategories.includes(product.category)) {
        return `phone-products/${productId}.json`;
    } else {
        const categoryFolder = product.category.toLowerCase();
        return `products/${categoryFolder}/${productId}.json`;
    }
}

// ===== 12. CHECK IF FILE EXISTS =====
/**
 * Check karta hai file exist karti hai ya nahi
 * @param {string} path - File path
 * @returns {Promise<boolean>}
 */
async function fileExists(path) {
    try {
        const file = await readFile(path);
        return file !== null;
    } catch (error) {
        return false;
    }
}

// ===== 13. ERROR HANDLING =====
/**
 * GitHub API errors ko handle करता है
 * @param {Error} error - GitHub API error
 * @returns {Object} - Formatted error
 */
function handleGitHubError(error) {
    console.error('GitHub API Error:', error);
    
    if (error.status === 401) {
        return {
            status: 401,
            message: 'GitHub authentication failed. Check your token.'
        };
    }
    
    if (error.status === 403) {
        return {
            status: 403,
            message: 'GitHub permission denied. Token may have insufficient scopes.'
        };
    }
    
    if (error.status === 404) {
        return {
            status: 404,
            message: 'File or repository not found.'
        };
    }
    
    if (error.status === 409) {
        return {
            status: 409,
            message: 'Conflict. The file may have been modified by someone else.'
        };
    }
    
    return {
        status: 500,
        message: error.message || 'GitHub API error'
    };
}

// ===== 14. EXPORTS =====
module.exports = {
    // Core functions
    readFile,
    writeFile,
    deleteFile,
    listFiles,
    
    // Product functions
    getAllProducts,
    getProductsByCategory,
    getJsonFile,
    getProductPath,
    fileExists,
    
    // Error handling
    handleGitHubError,
    
    // Constants
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH
};