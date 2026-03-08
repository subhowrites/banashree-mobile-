/**
 * DELETE-PRODUCT.JS
 * GitHub repository se product delete karta hai
 */

const {
  deleteFile,
  readFile,
  handleGitHubError
} = require("./github-api");


// ===== CORS =====
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
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


// ===== HANDLER =====
exports.handler = async (event) => {

  console.log("Delete product called");

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "DELETE") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "DELETE method required"
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

    const { id, sha, path } = body;

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

    await deleteFile(path, sha);

    return {

      statusCode: 200,

      headers,

      body: JSON.stringify({

        success: true,

        message: "Product deleted",

        id

      })

    };

  } catch (error) {

    console.error("Delete error:", error);

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