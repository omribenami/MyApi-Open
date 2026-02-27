import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Identity from './pages/Identity';
import Vault from './pages/Vault';
import Connectors from './pages/Connectors';
import Personas from './pages/Personas';
import Tokens from './pages/Tokens';
import Handshakes from './pages/Handshakes';
import AuditLog from './pages/AuditLog';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="identity" element={<Identity />} />
          <Route path="vault" element={<Vault />} />
          <Route path="connectors" element={<Connectors />} />
          <Route path="personas" element={<Personas />} />
          <Route path="tokens" element={<Tokens />} />
          <Route path="handshakes" element={<Handshakes />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
