import Cookies from 'js-cookie';
import toast from 'react-hot-toast';


export default function errorResponse(err) {
  if (err.response && err.response.status === 500) {
    toast.error(err.response.statusText || "Internal Server Error");
  } else if (err.response && err.response.data) {
    const errors = err.response.data.data; // Access the nested `data` object

    if (errors) {
      // Extract and show all error messages
      Object.entries(errors).forEach(([key, messages]) => {
        messages.forEach(message => toast.error(message));
      });
    } else {
      toast.error(err.response.data.message || "An error occurred");
    }
  } else {
    toast.error("An unexpected error occurred");
  }
  console.log(err);
  throw new Error(err);
}


/**
 * Safely retrieves data from localStorage
 * @param {string} key - The localStorage key to retrieve
 * @param {any} defaultValue - Default value to return if key doesn't exist or on error
 * @returns {any} The stored value or defaultValue
 */
export const getLocal = (key, defaultValue = null) => {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;

    // Try to parse JSON, return as-is if it fails
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch (error) {
    console.error(`Error retrieving ${key} from localStorage:`, error);
    return defaultValue;
  }
};

/**
 * Safely stores data in localStorage
 * @param {string} key - The localStorage key to set
 * @param {any} value - The value to store
 * @returns {boolean} True if successful, false otherwise
 */
export const setLocal = (key, value) => {
  if (typeof window === 'undefined') return false;

  try {
    // Convert non-string values to JSON
    const valueToStore = typeof value === 'string'
      ? value
      : JSON.stringify(value);

    localStorage.setItem(key, valueToStore);
    return true;
  } catch (error) {
    console.error(`Error storing ${key} in localStorage:`, error);
    return false;
  }
};

/**
 * Clears all authentication data (localStorage and cookies)
 * @param {Array<string>} [specificKeys=['old_token']] - Specific localStorage keys to clear
 * @param {Array<string>} [specificCookies=['old_token']] - Specific cookies to clear
 * @param {boolean} [shouldReload=true] - Whether to reload the page after logout
 * @returns {boolean} True if successful, false if any operations fail
 */
export const logout = (specificKeys = ['old_token'], specificCookies = ['old_token'], shouldReload = true) => {
  if (typeof window === 'undefined') return false;

  try {
    // Clear localStorage items
    if (specificKeys.length === 0) {
      // Clear all localStorage if no specific keys provided
      localStorage.clear();
    } else {
      // Clear only specific keys
      specificKeys.forEach(key => localStorage.removeItem(key));
    }

    // Clear cookies using js-cookie
    if (specificCookies.length > 0) {
      specificCookies.forEach(cookieName => {
        Cookies.remove(cookieName, { path: '/' });
      });
    }

    // Reload the page to apply the logged out state
    if (shouldReload) {
      window.location.href = '/auth/login';
    }

    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    return false;
  }
};

/**
 * Constructs a full image URL from a path
 * @param {string} path - The image path (filename or full URL)
 * @param {string} type - The content type (e.g. 'post', 'reply', 'comment', 'client') - optional
 * @returns {string} The complete valid URL
 */
export const getImageUrl = (path, type = 'post') => {
  if (!path) return '';

  // Convert to string just in case
  const pathStr = String(path);

  // If it's already a full URL, return it
  if (pathStr.startsWith('http://') || pathStr.startsWith('https://')) {
    return pathStr;
  }

  // Base URL from env
  const baseUrl = process.env.NEXT_PUBLIC_FILE_PATH?.replace(/\/+$/, '') || '';

  // Clean the path (remove leading slashes)
  const cleanPath = pathStr.replace(/^\/+/, '');

  // Check if the path already starts with the type prefix to avoid duplication
  // e.g., if type is 'post' and path is 'post/images/...', don't add 'post/' again
  if (type && cleanPath.startsWith(`${type}/`)) {
    return `${baseUrl}/${cleanPath}`;
  }

  if (type) {
    return `${baseUrl}/${type}/${cleanPath}`;
  }

  return `${baseUrl}/${cleanPath}`;
};

/**
 * Notification / actor profile avatars. Paths under `client/` must use getImageUrl(..., 'client');
 * naive `base + path` breaks when env base has no trailing slash or path is wrong type.
 */
export const resolveActorAvatarUrl = (path) => {
  if (path == null || path === "") return "";
  const pathStr = String(path).trim();
  if (pathStr.startsWith("http://") || pathStr.startsWith("https://")) return pathStr;
  const clean = pathStr.replace(/^\/+/, "");
  const baseUrl = process.env.NEXT_PUBLIC_FILE_PATH?.replace(/\/+$/, "") || "";
  if (clean.startsWith("client/")) return getImageUrl(pathStr, "client");
  if (clean.startsWith("post/")) return getImageUrl(pathStr, "post");
  return `${baseUrl}/${clean}`;
};
