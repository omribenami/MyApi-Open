import { clearAuthArtifacts, isLogoutInProgress, redirectToLoginOnce } from './authRuntime';

export async function apiRequest(path, options = {}) {
  if (isLogoutInProgress()) {
    const err = new Error('Logout in progress');
    err.code = 'MYAPI_LOGOUT_IN_PROGRESS';
    throw err;
  }

  const masterToken = localStorage.getItem('masterToken');
  let normalizedPath = path;
  if (path.startsWith('/api/v1')) normalizedPath = path.replace(/^\/api\/v1/, '');
  const url = `/api/v1${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (masterToken) headers.Authorization = `Bearer ${masterToken}`;

  try {
    const currentWorkspaceId = localStorage.getItem('currentWorkspace');
    if (currentWorkspaceId) headers['X-Workspace-ID'] = currentWorkspaceId;
  } catch { /* ignore storage errors */ }

  const fetchOptions = { ...options, headers, credentials: options.credentials || 'include' };
  if (options.body && typeof options.body === 'object') fetchOptions.body = JSON.stringify(options.body);

  const response = await fetch(url, fetchOptions);

  if (response.status === 429) {
    return response;
  }

  if (response.status === 401 || response.status === 403) {
    const data = await response.clone().json().catch(() => ({}));
    if (response.status === 403 && data?.code === 'DEVICE_APPROVAL_REQUIRED') {
      return response;
    }
    clearAuthArtifacts();
    redirectToLoginOnce();
  }

  return response;
}

export default apiRequest;
