/**
 * ADD-PRODUCT.JS
 * GitHub database me product add karta hai
 */

const {
  writeFile,
  getProductPath,
  fileExists,
  handleGitHubError
} = require("../github-api");


// ===== CORS HEADERS =====
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};


// ===== AUTH CHECK =====
function isAuthorized(event) {

  const authHeader =
    event.headers.authorization ||
    event.headers.Authorization;

  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "");

  return token && token.length > 10;
}


// ===== VALIDATION =====
function validateProduct(data) {

  const errors = [];

  if (!data.name) errors.push("Product name required");
  if (!data.brand) errors.push("Brand required");
  if (!data.category) errors.push("Category required");

  if (data.price === undefined) {
    errors.push("Price required");
  }

  if (isNaN(data.price)) {
    errors.push("Price must be number");
  }

  if (data.discount && (data.discount < 0 || data.discount > 100)) {
    errors.push("Discount must be 0-100");
  }

  return errors;

}


// ===== PRODUCT ID =====
function generateProductId(name) {

  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

}


// ===== VARIANT ID =====
function generateVariantId(storage, ram) {

  const s = storage.replace(/\s/g, "");
  const r = ram.replace(/\s/g, "");

  return `${s}-${r}`;

}


// ===== PRODUCT OBJECT =====
function createProduct(data) {

  const productId =
    data.id || generateProductId(data.name);

  const variantId =
    generateVariantId(
      data.storage || "128GB",
      data.ram || "8GB"
    );

  return {

    id: productId,

    name: data.name,

    brand: data.brand,

    category: data.category,

    image:
      data.image ||
      "https://via.placeholder.com/400x400?text=No+Image",

    colors: data.colors || [],

    variants: [
      {
        id: variantId,
        ram: data.ram || "8 GB",
        storage: data.storage || "128 GB",
        price: Number(data.price),
        discount: Number(data.discount) || 0,
        available: true
      }
    ],

    default: {
      color: "",
      variant: variantId
    },

    specs: {
      Processor: data.processor || "",
      Camera: data.camera || "",
      Battery: data.battery || "",
      Display: data.display || "",
      Description: data.description || ""
    },

    tags: data.tags || [],

    status: "active",

    createdAt: new Date().toISOString(),

    updatedAt: new Date().toISOString()

  };

}


// ===== HANDLER =====
exports.handler = async (event) => {

  console.log("Add product called");

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "POST required"
      })
    };
  }

  if (!isAuthorized(event)) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Unauthorized"
      })
    };
  }

  try {

    let body;

    try {

      body = JSON.parse(event.body);

    } catch {

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON"
        })
      };

    }

    const validationErrors = validateProduct(body);

    if (validationErrors.length > 0) {

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          errors: validationErrors
        })
      };

    }

    const product = createProduct(body);

    const filePath = getProductPath(product);

    const exists = await fileExists(filePath);

    if (exists) {

      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Product already exists"
        })
      };

    }

    const result = await writeFile(
      filePath,
      product,
      null,
      `Add product: ${product.name}`
    );

    return {

      statusCode: 201,

      headers,

      body: JSON.stringify({

        success: true,

        message: "Product added",

        product: {
          ...product,
          sha: result.sha,
          path: filePath
        }

      })

    };

  } catch (error) {

    console.error("Add product error:", error);

    const githubError = handleGitHubError(error);

    return {

      statusCode: githubError.status || 500,

      headers,

      body: JSON.stringify({

        success: false,

        error: githubError.message

      })

    };

  }

};