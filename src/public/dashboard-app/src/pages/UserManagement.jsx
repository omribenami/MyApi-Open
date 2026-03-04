import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

const PLAN_OPTIONS = ['free', 'pro', 'enterprise'];

function UserManagement() {
  const masterToken = useAuthStore((s) => s.masterToken);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/users', {
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (masterToken) fetchUsers();
  }, [masterToken]);

  const updatePlan = async (userId, plan) => {
    setSavingUserId(userId);
    setError('');
    try {
      const res = await fetch(`/api/v1/users/${userId}/plan`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update plan');
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.data : u)));
    } catch (err) {
      setError(err.message || 'Failed to update plan');
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-slate-400 mt-2">Assign plans (Free/Pro/Enterprise) to users.</p>
      </div>

      {error && <div className="rounded-lg border border-red-700 bg-red-900/30 text-red-200 p-3 text-sm">{error}</div>}

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
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Plan</th>
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
                        {PLAN_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;
