/**
 * GITHUB-AUTH.JS - FIXED VERSION
 * Handles admin authentication
 */

import { GITHUB_CONFIG, Helpers, STORAGE_KEYS } from './github-config.js';

// ===== CURRENT USER =====
let currentUser = null;
let authListeners = [];
let sessionCheckInterval = null;


// ===== LOGIN =====
export async function adminLogin(email, password) {

  try {

    if (!email || !password) {
      return {
        success: false,
        message: "Email and password required"
      };
    }

    const response = await fetch(GITHUB_CONFIG.API.auth(), {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email,
        password
      })

    });

    const data = await response.json();

    if (!response.ok || !data.success) {

      return {
        success: false,
        message: data.error || data.message || "Login failed"
      };

    }

    const userData = {

      id: data.user.id,

      email: data.user.email,

      name: data.user.name || email.split("@")[0],

      role: data.user.role || "admin"

    };

    Helpers.setLogin(userData, data.token);

    currentUser = userData;

    startSessionMonitoring();

    notifyAuthListeners(userData);

    return {

      success: true,

      user: userData,

      token: data.token

    };

  } catch (error) {

    console.error("Login error:", error);

    return {

      success: false,

      message: "Network error. Try again."

    };

  }

}


// ===== LOGOUT =====
export async function adminLogout() {

  try {

    const token = Helpers.getToken();

    if (token) {

      try {

        await fetch(GITHUB_CONFIG.API.auth(), {

          method: "DELETE",

          headers: {
            "Authorization": `Bearer ${token}`
          }

        });

      } catch (e) {

        console.warn("Logout API failed");

      }

    }

    Helpers.logout();

    currentUser = null;

    stopSessionMonitoring();

    notifyAuthListeners(null);

    return {

      success: true,

      message: "Logged out"

    };

  } catch (error) {

    console.error(error);

    return {

      success: false,

      message: "Logout failed"

    };

  }

}


// ===== GET CURRENT USER =====
export async function getCurrentUser() {

  if (!Helpers.isLoggedIn()) {

    currentUser = null;

    return null;

  }

  const userData = Helpers.getUserData();

  const isValid = await verifyToken();

  if (!isValid) {

    Helpers.logout();

    currentUser = null;

    return null;

  }

  currentUser = userData;

  return userData;

}


// ===== VERIFY TOKEN =====
async function verifyToken() {

  try {

    const token = Helpers.getToken();

    if (!token) return false;

    const response = await fetch(`${GITHUB_CONFIG.API.auth()}?verify=true`, {

      headers: {
        "Authorization": `Bearer ${token}`
      }

    });

    return response.ok;

  } catch (error) {

    console.warn("Token verify failed");

    return true;

  }

}


// ===== AUTH LISTENER =====
export function onAuthChange(callback) {

  authListeners.push(callback);

  callback(currentUser);

  return () => {

    authListeners = authListeners.filter(cb => cb !== callback);

  };

}


// ===== NOTIFY LISTENERS =====
function notifyAuthListeners(user) {

  authListeners.forEach(cb => {

    try {

      cb(user);

    } catch (e) {

      console.error(e);

    }

  });

}


// ===== PROTECTED PAGE =====
export async function requireAuth(redirect = "login.html") {

  const user = await getCurrentUser();

  if (!user) {

    sessionStorage.setItem("redirectAfterLogin", window.location.href);

    window.location.href = redirect;

    return false;

  }

  return user;

}


// ===== SESSION MONITOR =====
export function startSessionMonitoring(timeoutMinutes = 30) {

  stopSessionMonitoring();

  const timeout = timeoutMinutes * 60 * 1000;

  sessionCheckInterval = setInterval(() => {

    const loginTime = localStorage.getItem(STORAGE_KEYS.LOGIN_TIME);

    if (!loginTime) return;

    const diff = Date.now() - parseInt(loginTime);

    if (diff > timeout) {

      adminLogout().then(() => {

        alert("Session expired");

        window.location.href = "login.html";

      });

    }

  }, 60000);

}


// ===== STOP SESSION =====
function stopSessionMonitoring() {

  if (sessionCheckInterval) {

    clearInterval(sessionCheckInterval);

    sessionCheckInterval = null;

  }

}


// ===== GET USER SYNC =====
export function getCurrentUserSync() {

  return currentUser || Helpers.getUserData();

}


// ===== PERMISSION =====
export function hasPermission(permission) {

  const user = getCurrentUserSync();

  if (!user) return false;

  const roles = {

    admin: ["add","edit","delete","view"],

    editor: ["add","edit","view"],

    viewer: ["view"]

  };

  const role = user.role || "admin";

  return roles[role]?.includes(permission);

}


// ===== INIT AUTH =====
export async function initAuth() {

  if (Helpers.isLoggedIn()) {

    const user = Helpers.getUserData();

    const valid = await verifyToken();

    if (valid) {

      currentUser = user;

      startSessionMonitoring();

    } else {

      Helpers.logout();

    }

  }

  return currentUser;

}


// ===== CHANGE PASSWORD =====
export async function changePassword(currentPassword,newPassword){

  try{

    const token = Helpers.getToken();

    if(!token) throw new Error("Not authenticated");

    const res = await fetch(`${GITHUB_CONFIG.API.auth()}?changePassword=true`,{

      method:"POST",

      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${token}`
      },

      body:JSON.stringify({
        currentPassword,
        newPassword
      })

    });

    const data = await res.json();

    if(!res.ok){

      return{
        success:false,
        message:data.message || "Password change failed"
      }

    }

    return{
      success:true,
      message:"Password changed"
    }

  }catch(e){

    return{
      success:false,
      message:e.message
    }

  }

}


// ===== EXPORT =====
export default {

  adminLogin,

  adminLogout,

  getCurrentUser,

  onAuthChange,

  requireAuth,

  getCurrentUserSync,

  hasPermission,

  initAuth,

  changePassword

};