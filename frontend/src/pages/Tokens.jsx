import { useState, useEffect } from 'react';
import { get, post, del } from '../api';

export default function Tokens() {
  const [items, setItems] = useState([]);
  const [newToken, setNewToken] = useState(null);
  const [form, setForm] = useState({ label: '', scope: '*', expires_in_days: 30 });
  const load = () => get('/api/v1/tokens').then(setItems);
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const res = await post('/api/v1/tokens', form);
    setNewToken(res.raw_token);
    setForm({ label: '', scope: '*', expires_in_days: 30 });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🎟️ Guest Tokens</h1>
      <form onSubmit={create} className="flex gap-3 mb-4">
        <input className="p-2 rounded bg-gray-800 border border-gray-700 flex-1" placeholder="Label" value={form.label} onChange={e => setForm({...form, label: e.target.value})} />
        <input className="p-2 rounded bg-gray-800 border border-gray-700 w-32" placeholder="Scope" value={form.scope} onChange={e => setForm({...form, scope: e.target.value})} />
        <button className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">Create</button>
      </form>
      {newToken && (
        <div className="bg-green-900/30 border border-green-700 p-3 rounded mb-4">
          <p className="text-sm text-green-300">Token created (copy now, shown only once):</p>
          <code className="text-green-400 text-xs break-all">{newToken}</code>
        </div>
      )}
      <div className="space-y-2">
        {items.map(t => (
          <div key={t.id} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800">
            <div>
              <span className="font-semibold">{t.label || 'Unnamed'}</span>
              <span className="text-gray-500 text-sm ml-2">scope: {t.scope}</span>
              {t.revoked_at && <span className="ml-2 text-xs text-red-400">REVOKED</span>}
            </div>
            <button onClick={() => { del(`/api/v1/tokens/${t.id}`); load(); }} className="text-red-400 hover:text-red-300 text-sm">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  );
}
