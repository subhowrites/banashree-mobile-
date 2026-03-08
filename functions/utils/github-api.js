/**
 * GITHUB-API.JS - FIXED VERSION
 * GitHub database utility
 */

const { Octokit } = require("@octokit/rest");

// ===== ENV CONFIG =====
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

if (!GITHUB_TOKEN) console.error("❌ Missing GITHUB_TOKEN");
if (!GITHUB_OWNER) console.error("❌ Missing GITHUB_OWNER");
if (!GITHUB_REPO) console.error("❌ Missing GITHUB_REPO");


// ===== OCTOKIT =====
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
  userAgent: "Banashree-Mobile",
});


// ===== READ FILE =====
async function readFile(path) {

  try {

    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref: GITHUB_BRANCH
    });

    if (!data.content) return null;

    const decoded = Buffer.from(data.content, "base64").toString("utf8");

    let parsed;

    try {
      parsed = JSON.parse(decoded);
    } catch {
      parsed = decoded;
    }

    return {
      content: parsed,
      sha: data.sha,
      path: data.path
    };

  } catch (error) {

    if (error.status === 404) {
      return null;
    }

    console.error("Read error:", error);

    throw error;
  }

}


// ===== WRITE FILE =====
async function writeFile(path, content, sha = null, message = null) {

  try {

    const body = typeof content === "object"
      ? JSON.stringify(content, null, 2)
      : String(content);

    const encoded = Buffer.from(body).toString("base64");

    const commitMsg = message || (sha ? `Update ${path}` : `Create ${path}`);

    const { data } = await octokit.repos.createOrUpdateFileContents({

      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,

      message: commitMsg,

      content: encoded,

      sha: sha || undefined,

      branch: GITHUB_BRANCH

    });

    return {
      commit: data.commit,
      sha: data.content.sha
    };

  } catch (error) {

    console.error("Write error:", error);

    throw error;

  }

}


// ===== DELETE FILE =====
async function deleteFile(path, sha) {

  try {

    await octokit.repos.deleteFile({

      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      sha,

      message: `Delete ${path}`,

      branch: GITHUB_BRANCH

    });

    return true;

  } catch (error) {

    console.error("Delete error:", error);

    throw error;

  }

}


// ===== LIST FILES =====
async function listFiles(path) {

  try {

    const { data } = await octokit.repos.getContent({

      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref: GITHUB_BRANCH

    });

    if (!Array.isArray(data)) return [];

    return data
      .filter(item => item.type === "file")
      .map(file => ({
        name: file.name,
        path: file.path,
        sha: file.sha
      }));

  } catch (error) {

    if (error.status === 404) {
      return [];
    }

    console.error("List error:", error);

    throw error;

  }

}


// ===== GET ALL PRODUCTS =====
async function getAllProducts() {

  const products = [];

  try {

    const phoneFiles = await listFiles("phone-products");

    for (const file of phoneFiles) {

      const fileData = await readFile(file.path);

      if (fileData) {

        products.push({
          ...fileData.content,
          _id: file.name.replace(".json", ""),
          sha: fileData.sha,
          path: file.path
        });

      }

    }

    const folders = [
      "tv",
      "ac",
      "earphones",
      "watch",
      "laptop",
      "tablet",
      "accessories"
    ];

    for (const folder of folders) {

      const files = await listFiles(`products/${folder}`);

      for (const file of files) {

        const fileData = await readFile(file.path);

        if (fileData) {

          products.push({
            ...fileData.content,
            _id: file.name.replace(".json", ""),
            sha: fileData.sha,
            path: file.path
          });

        }

      }

    }

    return products;

  } catch (error) {

    console.error("Get products error:", error);

    throw error;

  }

}


// ===== CATEGORY PRODUCTS =====
async function getProductsByCategory(category) {

  const products = [];

  const phoneCategories = [
    "iPhone",
    "Samsung",
    "Vivo",
    "Oppo",
    "Redmi",
    "OnePlus",
    "Nothing"
  ];

  if (phoneCategories.includes(category)) {

    const files = await listFiles("phone-products");

    for (const file of files) {

      const data = await readFile(file.path);

      if (data && data.content.category === category) {

        products.push({
          ...data.content,
          _id: file.name.replace(".json", ""),
          sha: data.sha,
          path: file.path
        });

      }

    }

  } else {

    const files = await listFiles(`products/${category.toLowerCase()}`);

    for (const file of files) {

      const data = await readFile(file.path);

      if (data) {

        products.push({
          ...data.content,
          _id: file.name.replace(".json", ""),
          sha: data.sha,
          path: file.path
        });

      }

    }

  }

  return products;

}


// ===== JSON FILE =====
async function getJsonFile(file) {

  const data = await readFile(file);

  return data ? data.content : null;

}


// ===== PRODUCT PATH =====
function getProductPath(product) {

  const phoneCategories = [
    "iPhone",
    "Samsung",
    "Vivo",
    "Oppo",
    "Redmi",
    "OnePlus",
    "Nothing"
  ];

  const id =
    product.id ||
    product.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  if (phoneCategories.includes(product.category)) {

    return `phone-products/${id}.json`;

  }

  return `products/${product.category.toLowerCase()}/${id}.json`;

}


// ===== FILE EXISTS =====
async function fileExists(path) {

  const file = await readFile(path);

  return !!file;

}


// ===== ERROR HANDLER =====
function handleGitHubError(error) {

  console.error("GitHub error:", error);

  return {
    status: error.status || 500,
    message: error.message || "GitHub API error"
  };

}


// ===== EXPORT =====
module.exports = {

  readFile,
  writeFile,
  deleteFile,
  listFiles,

  getAllProducts,
  getProductsByCategory,
  getJsonFile,
  getProductPath,
  fileExists,

  handleGitHubError,

  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH

};