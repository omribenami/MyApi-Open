import { useState, useEffect } from 'react';
import { get, put } from '../api';

const TYPES = ['user_md', 'soul_md', 'memory_md'];

export default function Identity() {
  const [docs, setDocs] = useState({});
  const [active, setActive] = useState('user_md');
  const [saving, setSaving] = useState(false);

  useEffect(() => { get('/api/v1/identity').then(list => {
    const m = {}; list.forEach(d => m[d.doc_type] = d.content); setDocs(m);
  }); }, []);

  const save = async () => {
    setSaving(true);
    await put(`/api/v1/identity/${active}`, { content: docs[active] || '' });
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Identity Documents</h1>
      <div className="flex gap-2 mb-4">
        {TYPES.map(t => (
          <button key={t} onClick={() => setActive(t)}
            className={`px-4 py-1.5 rounded text-sm ${active === t ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
            {t.replace('_', '.').toUpperCase()}
          </button>
        ))}
      </div>
      <textarea className="w-full h-96 bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm"
        value={docs[active] || ''} onChange={e => setDocs({ ...docs, [active]: e.target.value })} />
      <button onClick={save} className="mt-3 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
