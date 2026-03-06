/**
 * ADMIN-DASHBOARD.JS - MONGODB VERSION
 * 
 * यह file admin panel के dashboard को handle करती है:
 * - Products list display (from MongoDB)
 * - Add new product (via API)
 * - Delete product (via API)
 * - Edit product (via API)
 */

// ===== 1. IMPORTS =====
import { 
  CONFIG, 
  Helpers,
  STORAGE_KEYS 
} from './admin-config.js';

import { 
  requireAuth, 
  adminLogout, 
  onAuthChange,
  hasPermission,
  getCurrentUserSync
} from './admin-auth.js';

// ===== 2. GLOBAL VARIABLES =====
let currentProducts = [];
let imageFile = null;
let editMode = false;
let editingProductId = null;

// ===== 3. API HELPER =====
async function apiCall(endpoint, method = 'GET', data = null, isFormData = false) {
  const url = CONFIG.API[endpoint] ? CONFIG.API[endpoint]() : `${CONFIG.API.getBaseUrl()}/${endpoint}`;
  
  const options = {
    method,
    headers: {}
  };

  // Add auth token if available
  const token = Helpers.getToken();
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    if (isFormData) {
      options.body = data; // FormData for file uploads
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || responseData.message || 'API call failed');
    }

    return responseData;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// ===== 4. INITIALIZE DASHBOARD =====
export async function initDashboard() {
  console.log('🚀 Initializing admin dashboard with MongoDB...');
  
  // Check authentication
  const user = await requireAuth();
  if (!user) return;
  
  // Update UI with user info
  updateUserInfo(user);
  
  // Load products
  await loadProducts();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup image preview
  setupImagePreview();
  
  // Setup auth state change
  onAuthChange((user) => {
    if (user) {
      updateUserInfo(user);
    }
  });
}

// ===== 5. UPDATE USER INFO =====
function updateUserInfo(user) {
  const userEmailEl = document.getElementById('userEmail');
  const userNameEl = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  
  if (userEmailEl) userEmailEl.textContent = user.email;
  
  const displayName = user.name || user.email.split('@')[0];
  if (userNameEl) userNameEl.textContent = displayName;
  if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();
  
  // Update permissions based UI
  updatePermissionsUI();
}

// ===== 6. UPDATE PERMISSIONS UI =====
function updatePermissionsUI() {
  const deleteBtns = document.querySelectorAll('.delete-product-btn, .delete-btn');
  const addForm = document.getElementById('addProductForm');
  const editBtns = document.querySelectorAll('.edit-product-btn, .edit-btn');
  
  if (!hasPermission('delete')) {
    deleteBtns.forEach(btn => btn.style.display = 'none');
  }
  
  if (!hasPermission('add') && addForm) {
    addForm.style.display = 'none';
  }
  
  if (!hasPermission('edit')) {
    editBtns.forEach(btn => btn.style.display = 'none');
  }
}

// ===== 7. LOAD PRODUCTS FROM MONGODB =====
export async function loadProducts() {
  const productListDiv = document.getElementById('productList');
  if (!productListDiv) return;
  
  try {
    productListDiv.innerHTML = '<div class="loading">Loading products from MongoDB...</div>';
    
    // Call Netlify function to get products
    const data = await apiCall('getProducts');
    
    currentProducts = data.products || data || [];
    
    console.log(`📦 Loaded ${currentProducts.length} products from MongoDB`);
    
    // Render products
    renderProductList();
    
    // Update stats
    updateStats();
    
  } catch (error) {
    console.error('Error loading products:', error);
    productListDiv.innerHTML = `<div class="error">Error loading products: ${error.message}</div>`;
  }
}

// ===== 8. UPDATE STATS =====
function updateStats() {
  const totalProductsEl = document.getElementById('totalProducts');
  const totalCategoriesEl = document.getElementById('totalCategories');
  const productsWithImageEl = document.getElementById('productsWithImage');
  const productsOnDiscountEl = document.getElementById('productsOnDiscount');
  
  if (totalProductsEl) {
    totalProductsEl.textContent = currentProducts.length;
  }
  
  if (totalCategoriesEl) {
    const categories = [...new Set(currentProducts.map(p => p.category).filter(Boolean))];
    totalCategoriesEl.textContent = categories.length;
  }
  
  if (productsWithImageEl) {
    const withImage = currentProducts.filter(p => p.image && p.image !== '').length;
    productsWithImageEl.textContent = withImage;
  }
  
  if (productsOnDiscountEl) {
    const onDiscount = currentProducts.filter(p => {
      const variant = p.variants?.[0];
      return variant?.discount && variant.discount > 0;
    }).length;
    productsOnDiscountEl.textContent = onDiscount;
  }
}

// ===== 9. RENDER PRODUCT LIST =====
function renderProductList() {
  const productListDiv = document.getElementById('productList');
  if (!productListDiv) return;
  
  if (currentProducts.length === 0) {
    productListDiv.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h3>No products found</h3><p>Click "Add New Product" to create your first product</p></div>';
    return;
  }
  
  let html = '<div class="product-grid-admin">';
  
  currentProducts.forEach(product => {
    const variant = product.variants?.[0] || {};
    const price = variant.price || 'N/A';
    const discount = variant.discount || 0;
    const finalPrice = discount > 0 ? Math.round(price * (1 - discount/100)) : price;
    
    // Get product ID (MongoDB _id)
    const productId = product._id || product.id;
    
    html += `
      <div class="product-card-admin" data-id="${productId}">
        <div class="product-image-admin">
          <img src="${product.image || 'https://via.placeholder.com/200x200?text=No+Image'}" 
               alt="${product.name}" 
               onerror="this.src='https://via.placeholder.com/200x200?text=No+Image'">
        </div>
        <div class="product-info-admin">
          <h3>${product.name}</h3>
          <p class="product-brand">
            <i class="fas fa-tag"></i> ${product.brand || 'No Brand'} | 
            <i class="fas fa-folder"></i> ${product.category || 'Uncategorized'}
          </p>
          <p class="product-price">
            ₹${typeof finalPrice === 'number' ? finalPrice.toLocaleString('en-IN') : finalPrice}
            ${discount > 0 ? `<span class="product-original-price">₹${price.toLocaleString('en-IN')}</span>` : ''}
          </p>
          ${discount > 0 ? `<span class="product-discount">${discount}% OFF</span>` : ''}
          <p class="product-id" style="font-size: 11px; color: #999; margin-top: 5px;">
            ID: ${productId.substring(0, 8)}...
          </p>
        </div>
        <div class="product-actions-admin">
          ${hasPermission('edit') ? `<button class="edit-btn" onclick="window.editProduct('${productId}')"><i class="fas fa-edit"></i> Edit</button>` : ''}
          ${hasPermission('delete') ? `<button class="delete-btn" onclick="window.deleteProduct('${productId}')"><i class="fas fa-trash"></i> Delete</button>` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add stats
  html += `
    <div class="stats-admin">
      <p><i class="fas fa-database"></i> Total Products: <strong>${currentProducts.length}</strong></p>
      <p><i class="fas fa-tags"></i> Source: <strong>MongoDB Atlas</strong></p>
    </div>
  `;
  
  productListDiv.innerHTML = html;
  
  // Make functions global for onclick
  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;
}

// ===== 10. SETUP EVENT LISTENERS =====
function setupEventListeners() {
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Add product form
  const addForm = document.getElementById('addProductForm');
  if (addForm) {
    addForm.addEventListener('submit', handleAddProduct);
  }
  
  // Cancel edit button
  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', resetForm);
  }
  
  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadProducts());
  }
  
  // Search input
  const searchInput = document.getElementById('searchProducts');
  const searchBtn = document.getElementById('searchBtn');
  
  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => filterProducts(searchInput.value));
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') filterProducts(searchInput.value);
    });
  }
}

// ===== 11. FILTER PRODUCTS =====
function filterProducts(searchTerm) {
  const cards = document.querySelectorAll('.product-card-admin');
  const term = searchTerm.toLowerCase();
  
  cards.forEach(card => {
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const brand = card.querySelector('.product-brand')?.textContent.toLowerCase() || '';
    
    if (title.includes(term) || brand.includes(term)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// ===== 12. SETUP IMAGE PREVIEW =====
function setupImagePreview() {
  const imageInput = document.getElementById('productImage');
  const previewDiv = document.getElementById('imagePreview');
  const uploadArea = document.getElementById('imageUploadArea');
  
  if (!imageInput || !previewDiv) return;
  
  // Click on upload area
  if (uploadArea) {
    uploadArea.addEventListener('click', () => {
      imageInput.click();
    });
    
    // Drag & drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = CONFIG.COLORS?.primary || '#667eea';
      uploadArea.style.background = '#f7fafc';
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '#e2e8f0';
      uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#e2e8f0';
      uploadArea.style.background = 'transparent';
      
      if (e.dataTransfer.files.length > 0) {
        imageInput.files = e.dataTransfer.files;
        handleImageSelect(e.dataTransfer.files[0]);
      }
    });
  }
  
  imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageSelect(e.target.files[0]);
    } else {
      resetImagePreview();
    }
  });
}

// ===== 13. HANDLE IMAGE SELECT =====
function handleImageSelect(file) {
  const previewDiv = document.getElementById('imagePreview');
  
  if (!file) {
    resetImagePreview();
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (JPEG, PNG, etc.)');
    resetImagePreview();
    return;
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size should be less than 5MB');
    resetImagePreview();
    return;
  }
  
  imageFile = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewDiv.innerHTML = `<img src="${e.target.result}" alt="Preview" class="show">`;
    previewDiv.classList.add('show');
  };
  reader.readAsDataURL(file);
}

// ===== 14. RESET IMAGE PREVIEW =====
function resetImagePreview() {
  const previewDiv = document.getElementById('imagePreview');
  const imageInput = document.getElementById('productImage');
  
  if (previewDiv) {
    previewDiv.innerHTML = '';
    previewDiv.classList.remove('show');
  }
  
  if (imageInput) imageInput.value = '';
  imageFile = null;
}

// ===== 15. HANDLE ADD/EDIT PRODUCT =====
async function handleAddProduct(e) {
  e.preventDefault();
  
  // Check permission
  if (!hasPermission('add') && !editMode) {
    alert('You do not have permission to add products');
    return;
  }
  
  // Get form values
  const formData = {
    name: document.getElementById('productName')?.value,
    brand: document.getElementById('productBrand')?.value,
    category: document.getElementById('productCategory')?.value,
    price: parseFloat(document.getElementById('productPrice')?.value),
    discount: parseFloat(document.getElementById('productDiscount')?.value) || 0,
    ram: document.getElementById('productRam')?.value || '8 GB',
    storage: document.getElementById('productStorage')?.value || '128 GB',
    processor: document.getElementById('productProcessor')?.value || '',
    camera: document.getElementById('productCamera')?.value || '',
    battery: document.getElementById('productBattery')?.value || '',
    display: document.getElementById('productDisplay')?.value || '',
    description: document.getElementById('productDescription')?.value || ''
  };
  
  // Validate required fields
  if (!formData.name || !formData.brand || !formData.category || !formData.price) {
    alert('Please fill all required fields');
    return;
  }
  
  // Disable submit button
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = editMode ? 'Updating...' : 'Adding...';
  
  try {
    // Handle image upload (first)
    let imageUrl = document.getElementById('currentImage')?.value || '';
    
    if (imageFile) {
      // For now, we'll use a placeholder
      // In production, you'd upload to Cloudinary or similar
      alert('Image upload requires Cloudinary or similar service. Using placeholder for now.');
      imageUrl = `https://via.placeholder.com/400x400?text=${encodeURIComponent(formData.name)}`;
    }
    
    // Create variant ID
    const variantId = `${formData.storage.replace(/\s/g, '')}-${formData.ram.replace(/\s/g, '')}`;
    
    // Create product object
    const productData = {
      name: formData.name,
      brand: formData.brand,
      category: formData.category,
      image: imageUrl,
      colors: [],
      variants: [{
        id: variantId,
        ram: formData.ram,
        storage: formData.storage,
        price: formData.price,
        discount: formData.discount,
        available: true
      }],
      default: {
        color: "",
        variant: variantId
      },
      specs: {
        Processor: formData.processor,
        Camera: formData.camera,
        Battery: formData.battery,
        Display: formData.display,
        Description: formData.description
      },
      tags: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    let result;
    
    if (editMode && editingProductId) {
      // Update existing product
      result = await apiCall('updateProduct', 'PUT', {
        id: editingProductId,
        ...productData
      });
    } else {
      // Add new product
      result = await apiCall('addProduct', 'POST', productData);
    }
    
    // Reset form and reload
    resetForm();
    await loadProducts();
    
    alert(editMode ? 'Product updated successfully!' : 'Product added successfully!');
    
  } catch (error) {
    console.error('Error saving product:', error);
    alert('Error saving product: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===== 16. DELETE PRODUCT =====
export async function deleteProduct(productId) {
  // Check permission
  if (!hasPermission('delete')) {
    alert('You do not have permission to delete products');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
  
  const deleteBtn = event?.target;
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
  }
  
  try {
    await apiCall('deleteProduct', 'DELETE', { id: productId });
    
    // Reload products
    await loadProducts();
    
    alert('Product deleted successfully!');
    
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Error deleting product: ' + error.message);
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete';
    }
  }
}

// ===== 17. EDIT PRODUCT =====
export async function editProduct(productId) {
  // Check permission
  if (!hasPermission('edit')) {
    alert('You do not have permission to edit products');
    return;
  }
  
  const product = currentProducts.find(p => (p._id === productId || p.id === productId));
  if (!product) return;
  
  editMode = true;
  editingProductId = productId;
  
  // Fill form with product data
  document.getElementById('productName').value = product.name || '';
  document.getElementById('productBrand').value = product.brand || '';
  document.getElementById('productCategory').value = product.category || '';
  
  const variant = product.variants?.[0] || {};
  document.getElementById('productPrice').value = variant.price || '';
  document.getElementById('productDiscount').value = variant.discount || '';
  document.getElementById('productRam').value = variant.ram || '8 GB';
  document.getElementById('productStorage').value = variant.storage || '128 GB';
  
  const specs = product.specs || {};
  document.getElementById('productProcessor').value = specs.Processor || '';
  document.getElementById('productCamera').value = specs.Camera || '';
  document.getElementById('productBattery').value = specs.Battery || '';
  document.getElementById('productDisplay').value = specs.Display || '';
  document.getElementById('productDescription').value = specs.Description || '';
  
  // Show current image
  const previewDiv = document.getElementById('imagePreview');
  if (previewDiv && product.image) {
    previewDiv.innerHTML = `<img src="${product.image}" alt="Current" class="show">`;
    previewDiv.classList.add('show');
  }
  
  // Store current image URL
  let currentImageInput = document.getElementById('currentImage');
  if (!currentImageInput) {
    currentImageInput = document.createElement('input');
    currentImageInput.type = 'hidden';
    currentImageInput.id = 'currentImage';
    document.getElementById('addProductForm').appendChild(currentImageInput);
  }
  currentImageInput.value = product.image || '';
  
  // Change form title
  const formTitle = document.getElementById('formTitle');
  if (formTitle) formTitle.textContent = 'Edit Product';
  
  // Show cancel button
  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
  
  // Scroll to form
  document.getElementById('addProductForm').scrollIntoView({ behavior: 'smooth' });
}

// ===== 18. RESET FORM =====
function resetForm() {
  const form = document.getElementById('addProductForm');
  if (form) form.reset();
  
  resetImagePreview();
  
  imageFile = null;
  editMode = false;
  editingProductId = null;
  
  const formTitle = document.getElementById('formTitle');
  if (formTitle) formTitle.textContent = 'Add New Product';
  
  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'none';
  
  const currentImageInput = document.getElementById('currentImage');
  if (currentImageInput) currentImageInput.value = '';
}

// ===== 19. HANDLE LOGOUT =====
async function handleLogout() {
  const result = await adminLogout();
  if (result.success) {
    window.location.href = 'login.html';
  } else {
    alert(result.message);
  }
}

// ===== 20. EXPORT FUNCTIONS =====
export default {
  initDashboard,
  loadProducts,
  deleteProduct,
  editProduct
};

// Auto-initialize when script loads
if (typeof window !== 'undefined' && window.location.pathname.includes('admin')) {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dashboard-main') || document.querySelector('.dashboard-container')) {
      initDashboard();
    }
  });
}