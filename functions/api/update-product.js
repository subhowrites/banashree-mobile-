/**
 * UPDATE-PRODUCT.JS
 * GitHub repository me existing product update karta hai
 */

const {
  writeFile,
  readFile,
  handleGitHubError
} = require("./api/github-api");


const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
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


// ===== VARIANT ID =====
function generateVariantId(storage, ram) {

  const s = storage.replace(/\s/g, "");
  const r = ram.replace(/\s/g, "");

  return `${s}-${r}`;

}


// ===== HANDLER =====
exports.handler = async (event) => {

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "PUT") {

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "PUT required"
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

    const {
      id,
      sha,
      path,
      name,
      brand,
      category,
      price,
      discount,
      ram,
      storage,
      image
    } = body;


    if (!id || !sha || !path) {

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "id, sha and path required"
        })
      };

    }


    const file = await readFile(path);

    if (!file) {

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Product not found"
        })
      };

    }


    if (file.sha !== sha) {

      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          error: "File changed, refresh dashboard"
        })
      };

    }


    const existing = file.content;

    const variantId = generateVariantId(
      storage || existing.variants?.[0]?.storage || "128 GB",
      ram || existing.variants?.[0]?.ram || "8 GB"
    );


    const updatedProduct = {

      ...existing,

      name: name || existing.name,

      brand: brand || existing.brand,

      category: category || existing.category,

      image: image || existing.image,

      variants: [
        {
          id: variantId,
          ram: ram || existing.variants?.[0]?.ram,
          storage: storage || existing.variants?.[0]?.storage,
          price:
            price !== undefined
              ? Number(price)
              : existing.variants?.[0]?.price,
          discount:
            discount !== undefined
              ? Number(discount)
              : existing.variants?.[0]?.discount,
          available: true
        }
      ],

      updatedAt: new Date().toISOString()

    };


    const result = await writeFile(
      path,
      updatedProduct,
      sha,
      `Update product: ${updatedProduct.name}`
    );


    return {

      statusCode: 200,

      headers,

      body: JSON.stringify({

        success: true,

        message: "Product updated",

        product: {
          ...updatedProduct,
          sha: result.sha,
          path
        }

      })

    };

  } catch (error) {

    console.error("Update error:", error);

    const githubError =
      handleGitHubError(error);

    return {

      statusCode:
        githubError.status || 500,

      headers,

      body: JSON.stringify({

        success: false,

        error: githubError.message

      })

    };

  }

};