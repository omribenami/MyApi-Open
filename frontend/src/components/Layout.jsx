import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const links = [
  { to: '/', label: '📊 Dashboard' },
  { to: '/identity', label: '🪪 Identity' },
  { to: '/vault', label: '🔐 Vault' },
  { to: '/connectors', label: '🔌 Connectors' },
  { to: '/personas', label: '🎭 Personas' },
  { to: '/tokens', label: '🎟️ Tokens' },
  { to: '/handshakes', label: '🤝 Handshakes' },
  { to: '/audit', label: '📋 Audit Log' },
];

export default function Layout() {
  const nav = useNavigate();
  const logout = () => { localStorage.removeItem('token'); nav('/login'); };

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
        <h1 className="text-xl font-bold text-cyan-400 mb-6">MyAPI Gateway</h1>
        <nav className="flex flex-col gap-1 flex-1">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? 'bg-cyan-900/40 text-cyan-300' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`
            }>{l.label}</NavLink>
          ))}
        </nav>
        <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 mt-4">Logout</button>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
