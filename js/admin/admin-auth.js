/**
 * ADMIN-AUTH.JS - MONGODB AUTHENTICATION
 * 
 * यह file admin panel के login/logout और
 * session management को handle करती है
 * MongoDB + Netlify Functions के साथ
 */

// ===== 1. IMPORTS =====
import { CONFIG, Helpers, STORAGE_KEYS } from './admin-config.js';

// ===== 2. CURRENT USER STATE =====
let currentUser = null;
let authListeners = [];
let sessionCheckInterval = null;

// ===== 3. LOGIN FUNCTION =====
/**
 * Admin login karta hai
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Promise} - Success/Failure with message
 */
export async function adminLogin(email, password) {
  try {
    // Basic validation
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required'
      };
    }

    // Netlify Function se login verify
    const response = await fetch(CONFIG.API.auth(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Invalid email or password'
      };
    }

    // Success - store in local storage
    const userData = {
      email: data.user.email,
      name: data.user.name || email.split('@')[0],
      role: data.user.role || 'admin',
      id: data.user.id
    };

    // Use helpers from config
    Helpers.setLogin(userData, data.token);

    // Update current user
    currentUser = userData;

    // Start session monitoring
    startSessionMonitoring();

    return {
      success: true,
      user: userData,
      token: data.token
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.message || 'Network error. Please try again.'
    };
  }
}

// ===== 4. LOGOUT FUNCTION =====
/**
 * Admin logout karta hai
 * @returns {Promise} - Success/Failure
 */
export async function adminLogout() {
  try {
    // Get token for API call (optional - for server-side session cleanup)
    const token = Helpers.getToken();
    
    if (token) {
      // Optional: Call logout API to invalidate token on server
      try {
        await fetch(CONFIG.API.auth(), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (apiError) {
        // Ignore API error, still logout locally
        console.warn('Logout API error:', apiError);
      }
    }

    // Clear local storage using helpers
    Helpers.logout();
    
    // Clear current user
    currentUser = null;
    
    // Stop session monitoring
    stopSessionMonitoring();
    
    // Notify listeners
    notifyAuthListeners(null);

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      message: error.message || 'Logout failed'
    };
  }
}

// ===== 5. CHECK AUTH STATE =====
/**
 * Check karta hai ki user logged in hai ya nahi
 * @returns {Promise} - Current user or null
 */
export async function getCurrentUser() {
  return new Promise((resolve) => {
    // Pehle local storage check
    if (Helpers.isLoggedIn()) {
      const userData = Helpers.getUserData();
      
      // Verify token with server (optional but recommended)
      verifyToken(userData).then(isValid => {
        if (isValid) {
          currentUser = userData;
          resolve(userData);
        } else {
          // Token invalid, logout
          Helpers.logout();
          currentUser = null;
          resolve(null);
        }
      });
    } else {
      currentUser = null;
      resolve(null);
    }
  });
}

// ===== 6. VERIFY TOKEN WITH SERVER =====
/**
 * Token ko server se verify karta hai
 * @param {Object} userData - User data from local storage
 * @returns {Promise<boolean>} - Token valid hai ya nahi
 */
async function verifyToken(userData) {
  try {
    const token = Helpers.getToken();
    if (!token) return false;

    const response = await fetch(`${CONFIG.API.auth()}?verify=true`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.ok;
  } catch (error) {
    console.warn('Token verification failed:', error);
    // Agar API down hai to local storage pe trust karo
    return true;
  }
}

// ===== 7. SUBSCRIBE TO AUTH CHANGES =====
/**
 * Auth state change par callback register karta hai
 * @param {Function} callback - Function jo user change par call hoga
 * @returns {Function} - Unsubscribe function
 */
export function onAuthChange(callback) {
  // Add to listeners
  authListeners.push(callback);
  
  // Call immediately with current user
  callback(currentUser);
  
  // Return unsubscribe function
  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
  };
}

// ===== 8. NOTIFY ALL LISTENERS =====
function notifyAuthListeners(user) {
  authListeners.forEach(callback => {
    try {
      callback(user);
    } catch (error) {
      console.error('Auth listener error:', error);
    }
  });
}

// ===== 9. PROTECTED ROUTE CHECK =====
/**
 * Protected pages ke liye check karta hai
 * Agar user logged in nahi hai to redirect kar deta hai
 * @param {string} redirectUrl - Redirect URL (default: login.html)
 */
export async function requireAuth(redirectUrl = 'login.html') {
  const user = await getCurrentUser();
  
  if (!user) {
    // Store current URL for redirect after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = redirectUrl;
    return false;
  }
  
  return user;
}

// ===== 10. SESSION TIMEOUT HANDLER =====
/**
 * Session timeout handle karta hai
 * @param {number} timeoutMinutes - Minutes after which session expires
 */
export function startSessionMonitoring(timeoutMinutes = 30) {
  // Clear existing interval
  stopSessionMonitoring();
  
  const timeoutMs = timeoutMinutes * 60 * 1000;
  
  sessionCheckInterval = setInterval(() => {
    const loginTime = localStorage.getItem(STORAGE_KEYS.LOGIN_TIME);
    
    if (loginTime) {
      const timeSinceLogin = Date.now() - parseInt(loginTime);
      
      if (timeSinceLogin > timeoutMs) {
        // Session expired, logout automatically
        adminLogout().then(() => {
          alert('Session expired. Please login again.');
          window.location.href = 'login.html';
        });
      }
    }
  }, 60000); // Check every minute
}

// ===== 11. STOP SESSION MONITORING =====
function stopSessionMonitoring() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

// ===== 12. UPDATE LAST ACTION =====
/**
 * User activity par last action time update karta hai
 */
export function updateLastAction() {
  // Is function ki ab zaroorat nahi, but keep for compatibility
  // We're using login time based session now
}

// ===== 13. GET CURRENT USER SYNC =====
/**
 * Synchronously current user return karta hai (agar already loaded hai)
 */
export function getCurrentUserSync() {
  return currentUser || Helpers.getUserData();
}

// ===== 14. CHECK PERMISSION =====
/**
 * Check karta hai ki user ke paas specific permission hai ya nahi
 * @param {string} permission - Permission name
 */
export function hasPermission(permission) {
  const user = getCurrentUserSync();
  if (!user) return false;
  
  // Define permissions based on role
  const permissions = {
    'admin': ['add', 'edit', 'delete', 'view'],
    'editor': ['add', 'edit', 'view'],
    'viewer': ['view']
  };
  
  const role = user.role || 'admin';
  const userPermissions = permissions[role] || ['view'];
  return userPermissions.includes(permission);
}

// ===== 15. INITIALIZE AUTH =====
/**
 * Auth initialize karta hai and session timeout start karta hai
 */
export async function initAuth() {
  // Check local storage first
  if (Helpers.isLoggedIn()) {
    const userData = Helpers.getUserData();
    const isValid = await verifyToken(userData);
    
    if (isValid) {
      currentUser = userData;
      startSessionMonitoring();
    } else {
      Helpers.logout();
    }
  }
  
  // Return current user
  return currentUser;
}

// ===== 16. CHANGE PASSWORD (Optional) =====
/**
 * Admin password change karta hai
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 */
export async function changePassword(currentPassword, newPassword) {
  try {
    const token = Helpers.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${CONFIG.API.auth()}?changePassword=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Password change failed'
      };
    }

    return {
      success: true,
      message: 'Password changed successfully'
    };

  } catch (error) {
    console.error('Password change error:', error);
    return {
      success: false,
      message: error.message || 'Password change failed'
    };
  }
}

// ===== 17. DEFAULT EXPORT =====
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