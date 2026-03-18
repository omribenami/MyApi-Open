/**
 * Unified API Request Helper
 * 
 * Wraps fetch() to add Authorization header and handle common errors.
 * Use this instead of fetch() or axios for API calls.
 * 
 * Example:
 *   const res = await apiRequest('/devices/approve/abc123', {
 *     method: 'POST',
 *     body: { reason: 'approved' }
 *   });
 */

export async function apiRequest(path, options = {}) {
  const masterToken = localStorage.getItem('masterToken');
  
  // Normalize path: remove leading /api/v1 if present
  let normalizedPath = path;
  if (path.startsWith('/api/v1')) {
    normalizedPath = path.replace(/^\/api\/v1/, '');
  }
  
  // Build full URL
  const url = `/api/v1${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add auth token if available
  if (masterToken) {
    headers['Authorization'] = `Bearer ${masterToken}`;
  }
  
  // Prepare request options
  const fetchOptions = {
    ...options,
    headers,
  };
  
  // Convert body to JSON if it's an object
  if (options.body && typeof options.body === 'object') {
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Handle 401 - redirect to login
    if (response.status === 401) {
      localStorage.removeItem('masterToken');
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    
    // Handle 403 - likely device not approved
    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      if (data.code === 'DEVICE_APPROVAL_REQUIRED') {
        // Return the 403 response so caller can handle device approval UI
        return response;
      }
    }
    
    return response;
  } catch (err) {
    console.error(`API request failed (${options.method || 'GET'} ${url}):`, err);
    throw err;
  }
}

export default apiRequest;
