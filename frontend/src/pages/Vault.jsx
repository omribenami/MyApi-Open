import { useState, useEffect } from 'react';
import { get, post, del } from '../api';

export default function Vault() {
  const [tokens, setTokens] = useState([]);
  const [form, setForm] = useState({ label: '', value: '', service_type: 'generic', description: '' });

  const load = () => get('/api/v1/vault/tokens').then(setTokens);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    await post('/api/v1/vault/tokens', form);
    setForm({ label: '', value: '', service_type: 'generic', description: '' });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🔐 Vault</h1>
      <form onSubmit={add} className="grid grid-cols-2 gap-3 mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800">
        <input className="p-2 rounded bg-gray-800 border border-gray-700" placeholder="Label" value={form.label} onChange={e => setForm({...form, label: e.target.value})} required />
        <input className="p-2 rounded bg-gray-800 border border-gray-700" placeholder="Service type" value={form.service_type} onChange={e => setForm({...form, service_type: e.target.value})} />
        <input className="p-2 rounded bg-gray-800 border border-gray-700 col-span-2" placeholder="Secret value" type="password" value={form.value} onChange={e => setForm({...form, value: e.target.value})} required />
        <input className="p-2 rounded bg-gray-800 border border-gray-700 col-span-2" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <button className="col-span-2 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">Add Secret</button>
      </form>
      <div className="space-y-2">
        {tokens.map(t => (
          <div key={t.id} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800">
            <div><span className="font-semibold">{t.label}</span> <span className="text-gray-500 text-sm ml-2">{t.service_type}</span><br/><span className="text-gray-400 text-xs">{t.description}</span></div>
            <button onClick={() => { del(`/api/v1/vault/tokens/${t.id}`); load(); }} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
          </div>
        ))}
        {tokens.length === 0 && <p className="text-gray-500">No secrets stored yet.</p>}
      </div>
    </div>
  );
}
