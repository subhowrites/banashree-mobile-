/**
 * GET-PRODUCTS.JS
 * GitHub database se products fetch karta hai
 */

const {
  getAllProducts,
  getProductsByCategory,
  getJsonFile,
  handleGitHubError
} = require("./github-api");


const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json"
};


exports.handler = async (event) => {

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "GET required"
      })
    };

  }

  try {

    const params =
      event.queryStringParameters || {};

    const category = params.category;
    const type = params.type;

    let products = [];


    // ===== JSON FILE REQUEST =====
    if (type === "categories") {

      const data =
        await getJsonFile("categories.json");

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: data || []
        })
      };

    }


    if (type === "trending") {

      const data =
        await getJsonFile("trending.json");

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: data || []
        })
      };

    }


    // ===== PRODUCTS =====

    if (category) {

      products =
        await getProductsByCategory(category);

    } else {

      products =
        await getAllProducts();

    }


    return {

      statusCode: 200,

      headers,

      body: JSON.stringify({

        success: true,

        products,

        total: products.length

      })

    };

  } catch (error) {

    console.error("Get products error:", error);

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