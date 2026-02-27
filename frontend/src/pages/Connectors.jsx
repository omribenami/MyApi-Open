import { useState, useEffect } from 'react';
import { get, post, del } from '../api';

export default function Connectors() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ service_type: '', label: '' });
  const load = () => get('/api/v1/connectors').then(setItems);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    await post('/api/v1/connectors', form);
    setForm({ service_type: '', label: '' });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🔌 Connectors</h1>
      <form onSubmit={add} className="flex gap-3 mb-6">
        <input className="p-2 rounded bg-gray-800 border border-gray-700 flex-1" placeholder="Service type (e.g. google_calendar)" value={form.service_type} onChange={e => setForm({...form, service_type: e.target.value})} required />
        <input className="p-2 rounded bg-gray-800 border border-gray-700 flex-1" placeholder="Label" value={form.label} onChange={e => setForm({...form, label: e.target.value})} required />
        <button className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">Add</button>
      </form>
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800">
            <div><span className="font-semibold">{c.label}</span> <span className="text-gray-500 text-sm ml-2">{c.service_type}</span> <span className={`text-xs ml-2 ${c.status==='active'?'text-green-400':'text-red-400'}`}>{c.status}</span></div>
            <button onClick={() => { del(`/api/v1/connectors/${c.id}`); load(); }} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
