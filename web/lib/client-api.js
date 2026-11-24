/**
 * Client-side API fetch helper for Cognify.
 * Automatically sends credentials (cookies) and parses errors.
 */

/**
 * Perform a fetch request to the Cognify API.
 * @param {string} endpoint - e.g. '/api/auth/login'
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let body = options.body;

  // For mutating methods, ensure Content-Type is set unless body is FormData
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      // Let browser set multipart/form-data boundary
      delete headers['Content-Type'];
      delete headers['content-type'];
    } else {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      if (body && typeof body === 'object') {
        body = JSON.stringify(body);
      } else if (body === undefined || body === null) {
        body = '{}';
      }
    }
  } else if (body && typeof body === 'object' && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, {
    credentials: 'include',
    ...options,
    method,
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.code = data?.error?.code || 'API_ERROR';
    err.data = data;
    throw err;
  }

  return data;
}
