/**
 * GITHUB-DASHBOARD.JS - FIXED VERSION
 * Works with Cloudflare / Netlify functions
 */

// ===== IMPORTS =====
import {
  GITHUB_CONFIG,
  Helpers
} from './github-config.js';

import {
  requireAuth,
  adminLogout,
  onAuthChange,
  hasPermission
} from './github-auth.js';

// ===== GLOBAL VARIABLES =====
let currentProducts = [];
let imageFile = null;
let editMode = false;
let editingProductId = null;
let editingProductSha = null;


// ===== API HELPER =====
async function apiCall(endpoint, method = 'GET', data = null) {

  const url = GITHUB_CONFIG.API[endpoint]
    ? GITHUB_CONFIG.API[endpoint]()
    : `${GITHUB_CONFIG.API.getBaseUrl()}/${endpoint}`;

  const options = {
    method,
    headers: {}
  };

  const token = Helpers.getToken();

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  try {

    const response = await fetch(url, options);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || "API error");
    }

    return result;

  } catch (error) {

    console.error("API error:", error);

    alert("Server error: " + error.message);

    throw error;

  }

}


// ===== INITIALIZE DASHBOARD =====
export async function initDashboard() {

  const user = await requireAuth();

  if (!user) return;

  updateUserInfo(user);

  await loadProducts();

  setupEventListeners();

}


// ===== USER INFO =====
function updateUserInfo(user) {

  const email = document.getElementById("userEmail");
  const name = document.getElementById("userName");
  const avatar = document.getElementById("userAvatar");

  if (email) email.textContent = user.email;

  const displayName = user.name || user.email.split("@")[0];

  if (name) name.textContent = displayName;

  if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();

}


// ===== LOAD PRODUCTS =====
export async function loadProducts() {

  const list = document.getElementById("productList");

  if (!list) return;

  list.innerHTML = "Loading products...";

  try {

    const data = await apiCall("getProducts");

    currentProducts = data.products || data || [];

    renderProductList();

  } catch (error) {

    list.innerHTML = "Failed to load products";

  }

}


// ===== RENDER PRODUCTS =====
function renderProductList() {

  const container = document.getElementById("productList");

  if (!container) return;

  if (currentProducts.length === 0) {

    container.innerHTML = "No products found";

    return;

  }

  let html = '<div class="product-grid-admin">';

  currentProducts.forEach(product => {

    const variant = product.variants?.[0] || {};

    const price = variant.price || 0;

    const discount = variant.discount || 0;

    const finalPrice = discount
      ? Math.round(price * (1 - discount / 100))
      : price;

    const productId = product.id || product._id;

    const sha = product.sha || "";

    html += `

<div class="product-card-admin">

<img src="${product.image || 'https://via.placeholder.com/200'}">

<h3>${product.name}</h3>

<p>${product.brand || ''}</p>

<p>₹${finalPrice}</p>

<button onclick="window.editProduct('${productId}','${sha}')">Edit</button>

<button onclick="window.deleteProduct('${productId}','${sha}')">Delete</button>

</div>

`;

  });

  html += "</div>";

  container.innerHTML = html;

  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;

}


// ===== ADD PRODUCT =====
async function handleAddProduct(e) {

  e.preventDefault();

  const name = document.getElementById("productName").value;
  const brand = document.getElementById("productBrand").value;
  const category = document.getElementById("productCategory").value;
  const price = document.getElementById("productPrice").value;

  if (!name || !brand || !category || !price) {

    alert("Fill all fields");

    return;

  }

  const product = {

    id: name.toLowerCase().replace(/\s/g, "-"),

    name,
    brand,
    category,

    variants: [{
      id: "default",
      price: parseFloat(price),
      discount: 0
    }]

  };

  try {

    if (editMode) {

      await apiCall("updateProduct", "PUT", {
        id: editingProductId,
        sha: editingProductSha,
        ...product
      });

    } else {

      await apiCall("addProduct", "POST", product);

    }

    await loadProducts();

    alert("Product saved");

  } catch (error) {

    alert(error.message);

  }

}


// ===== DELETE PRODUCT =====
export async function deleteProduct(id, sha) {

  if (!confirm("Delete product?")) return;

  try {

    await apiCall("deleteProduct", "DELETE", { id, sha });

    await loadProducts();

    alert("Product deleted");

  } catch (error) {

    alert(error.message);

  }

}


// ===== EDIT PRODUCT =====
export function editProduct(id, sha) {

  const product = currentProducts.find(p => p.id === id || p._id === id);

  if (!product) return;

  editMode = true;

  editingProductId = id;

  editingProductSha = sha;

  document.getElementById("productName").value = product.name;
  document.getElementById("productBrand").value = product.brand;
  document.getElementById("productCategory").value = product.category;

}


// ===== EVENTS =====
function setupEventListeners() {

  const form = document.getElementById("addProductForm");

  if (form) {

    form.addEventListener("submit", handleAddProduct);

  }

  const logout = document.getElementById("logoutBtn");

  if (logout) {

    logout.addEventListener("click", async () => {

      await adminLogout();

      window.location.href = "login.html";

    });

  }

}


// ===== AUTO INIT =====
document.addEventListener("DOMContentLoaded", () => {

  initDashboard();

});