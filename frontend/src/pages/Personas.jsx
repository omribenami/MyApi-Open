import { useState, useEffect } from 'react';
import { get, post, put, del } from '../api';

export default function Personas() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', soul_md: '', skills_json: '[]' });
  const load = () => get('/api/v1/personas').then(setItems);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    await post('/api/v1/personas', form);
    setForm({ name: '', soul_md: '', skills_json: '[]' });
    load();
  };

  const activate = async (id) => { await post(`/api/v1/personas/${id}/activate`); load(); };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🎭 Personas</h1>
      <form onSubmit={add} className="space-y-3 mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800">
        <input className="w-full p-2 rounded bg-gray-800 border border-gray-700" placeholder="Persona name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <textarea className="w-full p-2 rounded bg-gray-800 border border-gray-700 h-24" placeholder="SOUL.md content" value={form.soul_md} onChange={e => setForm({...form, soul_md: e.target.value})} />
        <button className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">Create Persona</button>
      </form>
      <div className="space-y-2">
        {items.map(p => (
          <div key={p.id} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800">
            <div>
              <span className="font-semibold">{p.name}</span>
              {p.is_active && <span className="ml-2 text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded">ACTIVE</span>}
            </div>
            <div className="flex gap-2">
              {!p.is_active && <button onClick={() => activate(p.id)} className="text-cyan-400 hover:text-cyan-300 text-sm">Activate</button>}
              <button onClick={() => { del(`/api/v1/personas/${p.id}`); load(); }} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
