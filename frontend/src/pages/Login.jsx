import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await post('/api/v1/auth/register', { username, password, email });
      }
      const data = await post('/api/v1/auth/login', { username, password });
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refresh', data.refresh_token);
      nav('/');
    } catch (err) { setError(err.message || 'Failed'); }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form onSubmit={submit} className="bg-gray-900 p-8 rounded-xl w-96 space-y-4 border border-gray-800">
        <h2 className="text-2xl font-bold text-cyan-400 text-center">MyAPI Gateway</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input className="w-full p-2 rounded bg-gray-800 border border-gray-700" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        {isRegister && <input className="w-full p-2 rounded bg-gray-800 border border-gray-700" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />}
        <input className="w-full p-2 rounded bg-gray-800 border border-gray-700" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">{isRegister ? 'Register' : 'Login'}</button>
        <p className="text-center text-sm text-gray-400 cursor-pointer" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Already have account? Login' : 'Need account? Register'}
        </p>
      </form>
    </div>
  );
}
