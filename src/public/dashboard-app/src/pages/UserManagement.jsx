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

  const selectStyle = {
    background: 'var(--bg-sunk)',
    border: '1px solid var(--line)',
    color: 'var(--ink)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    outline: 'none',
  };

  return (
    <div className="ui-page">
      {/* Header */}
      <div className="ui-page-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="ui-title">User Management</h1>
            <p className="ui-subtitle mt-1">Assign plans (Free / Pro / Enterprise) to users.</p>
          </div>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div
          className="ui-card p-3 text-[13px] flex items-center justify-between gap-4"
          style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-bg)' }}
        >
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>✕</button>
        </div>
      )}

      {/* Load error */}
      {loadError ? (
        <div
          className="ui-card p-4 text-[13px] space-y-3"
          style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-bg)' }}
        >
          <p>{loadError}</p>
          <button type="button" onClick={fetchUsers} className="ui-button text-[12px]">
            Retry
          </button>
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between">
              <span className="ink font-semibold text-[14px]">Users ({users.length})</span>
              <button type="button" onClick={fetchUsers} className="ui-button text-[12px]">Refresh</button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 ui-subtitle text-[13px]">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-6 ui-subtitle text-[13px]">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead style={{ background: 'var(--bg-sunk)', borderBottom: '1px solid var(--line)' }}>
                  <tr>
                    {['Username', 'Email', 'Account', 'Plan', 'Plan Active', 'Stripe Sub Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 font-medium micro">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <tr
                      key={user.id}
                      style={{ borderBottom: i < users.length - 1 ? '1px solid var(--line-2)' : 'none' }}
                    >
                      <td className="px-5 py-2.5 ink mono text-[12px]">{user.username}</td>
                      <td className="px-5 py-2.5 ink-2">{user.email || '—'}</td>
                      <td className="px-5 py-2.5 ink-2">{user.status || 'active'}</td>
                      <td className="px-5 py-2.5">
                        <select
                          value={user.plan || 'free'}
                          onChange={(e) => updatePlan(user.id, e.target.value)}
                          disabled={savingUserId === user.id}
                          style={selectStyle}
                        >
                          {(plans.length ? plans.map((p) => p.id) : ['free', 'pro', 'enterprise']).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium"
                          style={user.planActive
                            ? { borderColor: 'var(--green)',  background: 'var(--green-bg)',  color: 'var(--green)' }
                            : { borderColor: 'var(--red)',    background: 'var(--red-bg)',    color: 'var(--red)' }
                          }
                        >
                          {user.planActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 ink-3">{user.stripeSubscriptionStatus || '—'}</td>
                      <td className="px-5 py-2.5">
                        <button
                          type="button"
                          onClick={() => deleteUser(user)}
                          disabled={deletingUserId === user.id}
                          className="btn btn-ghost text-[12px] disabled:opacity-50"
                          style={{ color: 'var(--red)' }}
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
