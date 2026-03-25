import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

async function apiRequest(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => '');

  if (!res.ok) {
    const err = new Error((typeof payload === 'object' ? payload?.error : payload) || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function formatError(err, fallback) {
  if (err?.status === 429) {
    const retryAfterSeconds = err?.payload?.retryAfterSeconds;
    return retryAfterSeconds
      ? `Too many requests. Please wait ${retryAfterSeconds}s and retry.`
      : 'Too many requests. Please wait a moment and retry.';
  }

  if (err?.status >= 500) {
    const serverMessage = typeof err?.payload === 'object' ? err?.payload?.error : '';
    return serverMessage || 'Internal server error. Please retry.';
  }

  return err?.message || fallback;
}

function UserManagement() {
  const masterToken = useAuthStore((s) => s.masterToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);
  const [plans, setPlans] = useState([]);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError('');
    setActionError('');

    try {
      const options = { credentials: 'include' };
      if (masterToken) {
        options.headers = { Authorization: `Bearer ${masterToken}` };
      }
      const data = await apiRequest('/api/v1/users', options);
      setUsers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setLoadError(formatError(err, 'Failed to load users'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const data = await apiRequest('/api/v1/billing/plans');
        setPlans(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setPlans([]);
      }
    };

    // Always fetch on mount and when masterToken changes
    // Use session cookies as fallback if no masterToken
    fetchUsers();
    loadPlans();
  }, [masterToken, currentWorkspace?.id]);

  const updatePlan = async (userId, plan) => {
    setSavingUserId(userId);
    setActionError('');

    try {
      const options = {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      };
      if (masterToken) {
        options.headers.Authorization = `Bearer ${masterToken}`;
      }
      const data = await apiRequest(`/api/v1/users/${userId}/plan`, options);

      setUsers((prev) => prev.map((u) => (u.id === userId ? data.data : u)));
    } catch (err) {
      setActionError(formatError(err, 'Failed to update plan'));
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete user ${user.email || user.username}? This will remove all related data.`)) return;
    setDeletingUserId(user.id);
    setActionError('');
    try {
      const options = {
        method: 'DELETE',
        credentials: 'include',
      };
      if (masterToken) {
        options.headers = { Authorization: `Bearer ${masterToken}` };
      }
      await apiRequest(`/api/v1/users/${user.id}`, options);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setActionError(formatError(err, 'Failed to delete user'));
    } finally {
      setDeletingUserId(null);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 mt-2">Assign plans (Free/Pro/Enterprise) to users.</p>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 text-red-200 p-3 text-sm flex items-center justify-between gap-4">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="text-red-300 hover:text-red-100">✕</button>
        </div>
      )}

      {loadError ? (
        <div className="rounded-lg border border-red-700 bg-red-900/30 text-red-200 p-5 text-sm space-y-3">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={fetchUsers}
            className="px-3 py-1.5 rounded border border-red-600 text-red-200 hover:bg-red-800/30 text-xs"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-slate-400">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-slate-400">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60 text-slate-300">
                  <tr>
                    <th className="text-left px-4 py-3">Username</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Account</th>
                    <th className="text-left px-4 py-3">Plan</th>
                    <th className="text-left px-4 py-3">Plan Active</th>
                    <th className="text-left px-4 py-3">Stripe Sub Status</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-slate-100">{user.username}</td>
                      <td className="px-4 py-3 text-slate-300">{user.email || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{user.status || 'active'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.plan || 'free'}
                          onChange={(e) => updatePlan(user.id, e.target.value)}
                          disabled={savingUserId === user.id}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        >
                          {(plans.length ? plans.map((p) => p.id) : ['free', 'pro', 'enterprise']).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${user.planActive ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-rose-900/40 text-rose-300 border border-rose-700'}`}>
                          {user.planActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{user.stripeSubscriptionStatus || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => deleteUser(user)}
                          disabled={deletingUserId === user.id}
                          className="px-2 py-1 rounded border border-rose-600 text-rose-300 hover:bg-rose-900/20 text-xs disabled:opacity-50"
                        >
                          {deletingUserId === user.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserManagement;
