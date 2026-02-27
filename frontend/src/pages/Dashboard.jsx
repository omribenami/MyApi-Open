import { useState, useEffect } from 'react';
import { get } from '../api';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});

  useEffect(() => {
    get('/api/v1/auth/me').then(setUser).catch(() => {});
    Promise.all([
      get('/api/v1/vault/tokens').then(d => d.length).catch(() => 0),
      get('/api/v1/connectors').then(d => d.length).catch(() => 0),
      get('/api/v1/personas').then(d => d.length).catch(() => 0),
      get('/api/v1/tokens').then(d => d.length).catch(() => 0),
      get('/api/v1/handshakes').then(d => d.filter(h => h.status === 'pending').length).catch(() => 0),
    ]).then(([vault, conn, pers, tokens, hs]) => setStats({ vault, conn, pers, tokens, hs }));
  }, []);

  const cards = [
    { label: 'Vault Secrets', value: stats.vault, color: 'text-yellow-400' },
    { label: 'Connectors', value: stats.conn, color: 'text-green-400' },
    { label: 'Personas', value: stats.pers, color: 'text-purple-400' },
    { label: 'Guest Tokens', value: stats.tokens, color: 'text-cyan-400' },
    { label: 'Pending Handshakes', value: stats.hs, color: 'text-orange-400' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      {user && <p className="text-gray-400 mb-6">Welcome back, {user.display_name}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className={`text-3xl font-bold ${c.color}`}>{c.value ?? '—'}</div>
            <div className="text-sm text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
