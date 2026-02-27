import { useState, useEffect } from 'react';
import { get, post } from '../api';

export default function Handshakes() {
  const [items, setItems] = useState([]);
  const load = () => get('/api/v1/handshakes').then(setItems);
  useEffect(() => { load(); }, []);

  const approve = async (id) => { await post(`/api/v1/handshakes/${id}/approve`); load(); };
  const deny = async (id) => { await post(`/api/v1/handshakes/${id}/deny`); load(); };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🤝 Handshakes</h1>
      <div className="space-y-2">
        {items.map(h => (
          <div key={h.id} className="bg-gray-900 p-4 rounded border border-gray-800">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-semibold">{h.agent_id}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${h.status==='pending'?'bg-yellow-900 text-yellow-400':h.status==='approved'?'bg-green-900 text-green-400':'bg-red-900 text-red-400'}`}>{h.status}</span>
                <p className="text-gray-400 text-sm mt-1">Scopes: {h.requested_scopes}</p>
                {h.message && <p className="text-gray-500 text-sm">{h.message}</p>}
              </div>
              {h.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => approve(h.id)} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm">Approve</button>
                  <button onClick={() => deny(h.id)} className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm">Deny</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500">No handshake requests.</p>}
      </div>
    </div>
  );
}
