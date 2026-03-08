/**
 * AUTH.JS
 * Admin authentication using GitHub database
 */

const { readFile, writeFile } = require('./github-api');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'banashree-secret';
const USERS_FILE = 'users.json';

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Content-Type": "application/json"
};


// ===== HASH PASSWORD =====
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}


// ===== TOKEN =====
function generateToken(user) {

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

}


// ===== VERIFY TOKEN =====
function verifyToken(token) {

  try {

    const decoded = jwt.verify(token, JWT_SECRET);

    return {
      valid: true,
      user: decoded
    };

  } catch {

    return { valid: false };

  }

}


// ===== GET USERS =====
async function getUsers() {

  const file = await readFile(USERS_FILE);

  if (!file) {

    const defaultUsers = [

      {
        id: "1",
        email: "admin@banashree.com",
        passwordHash: hashPassword("admin123"),
        name: "Admin",
        role: "admin",
        isActive: true,
        createdAt: new Date().toISOString()
      }

    ];

    await writeFile(
      USERS_FILE,
      defaultUsers,
      null,
      "Create users.json"
    );

    return defaultUsers;

  }

  return file.content;

}


// ===== LOGIN =====
async function login(event) {

  let body;

  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "Invalid JSON"
      })
    };
  }

  const { email, password } = body;

  if (!email || !password) {

    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "Email and password required"
      })
    };

  }

  const users = await getUsers();

  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {

    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: "Invalid credentials"
      })
    };

  }

  const passwordHash = hashPassword(password);

  if (passwordHash !== user.passwordHash) {

    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: "Invalid credentials"
      })
    };

  }

  const token = generateToken(user);

  return {

    statusCode: 200,

    body: JSON.stringify({

      success: true,

      message: "Login successful",

      token,

      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }

    })

  };

}


// ===== VERIFY =====
function verify(event) {

  const authHeader =
    event.headers.authorization ||
    event.headers.Authorization;

  if (!authHeader) {

    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: "No token"
      })
    };

  }

  const token = authHeader.replace("Bearer ", "");

  const result = verifyToken(token);

  if (!result.valid) {

    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: "Invalid token"
      })
    };

  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      user: result.user
    })
  };

}


// ===== LOGOUT =====
function logout() {

  return {

    statusCode: 200,

    body: JSON.stringify({

      success: true,

      message: "Logged out"

    })

  };

}


// ===== MAIN HANDLER =====
exports.handler = async (event) => {

  if (event.httpMethod === "OPTIONS") {

    return {
      statusCode: 200,
      headers,
      body: ""
    };

  }

  try {

    const params =
      event.queryStringParameters || {};

    if (event.httpMethod === "POST" && !params.action) {

      const result = await login(event);

      return { ...result, headers };

    }

    if (event.httpMethod === "GET" && params.verify === "true") {

      const result = verify(event);

      return { ...result, headers };

    }

    if (event.httpMethod === "DELETE") {

      const result = logout();

      return { ...result, headers };

    }

    return {

      statusCode: 404,

      headers,

      body: JSON.stringify({
        success: false,
        error: "Endpoint not found"
      })

    };

  } catch (error) {

    console.error("Auth error:", error);

    return {

      statusCode: 500,

      headers,

      body: JSON.stringify({
        success: false,
        error: "Server error"
      })

    };

  }

};