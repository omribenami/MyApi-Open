import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceConnectors from './pages/ServiceConnectors';
import TokenVault from './pages/TokenVault';
import AccessTokens from './pages/AccessTokens';
import Personas from './pages/Personas';
import KnowledgeBase from './pages/KnowledgeBase';
import Identity from './pages/Identity';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import PlatformDocs from './pages/PlatformDocs';
import ApiDocs from './pages/ApiDocs';
import Marketplace from './pages/Marketplace';
import MyListings from './pages/MyListings';
import Skills from './pages/Skills';
import DeviceManagement from './pages/DeviceManagement';
import ActivityLog from './pages/ActivityLog';
import TeamSettings from './pages/TeamSettings';
import Layout from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function AuthedLayout({ children, onLogout }) {
  return (
    <ProtectedRoute>
      <Layout onLogout={onLogout}>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const initialize = useAuthStore((state) => state.initialize);
  const fetchWorkspaces = useAuthStore((state) => state.fetchWorkspaces);
  const handleLogout = useAuthStore((state) => state.logout);
  const forceUnauthenticated = useAuthStore((state) => state.forceUnauthenticated);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated && isInitialized) {
      fetchWorkspaces();
    }
  }, [isAuthenticated, isInitialized, fetchWorkspaces]);

  useEffect(() => {
    const onAuthExpired = () => forceUnauthenticated();
    window.addEventListener('myapi:auth-expired', onAuthExpired);
    return () => window.removeEventListener('myapi:auth-expired', onAuthExpired);
  }, [forceUnauthenticated]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500" />
          <p>Restoring your session…</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router basename="/dashboard">
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />} />

          <Route path="/home" element={<AuthedLayout onLogout={handleLogout}><Dashboard /></AuthedLayout>} />
          <Route path="/services" element={<AuthedLayout onLogout={handleLogout}><ServiceConnectors /></AuthedLayout>} />
          <Route path="/tokens" element={<AuthedLayout onLogout={handleLogout}><TokenVault /></AuthedLayout>} />
          <Route path="/access-tokens" element={<AuthedLayout onLogout={handleLogout}><AccessTokens /></AuthedLayout>} />
          <Route path="/personas" element={<AuthedLayout onLogout={handleLogout}><Personas /></AuthedLayout>} />
          <Route path="/identity" element={<AuthedLayout onLogout={handleLogout}><Identity /></AuthedLayout>} />
          <Route path="/knowledge" element={<AuthedLayout onLogout={handleLogout}><KnowledgeBase /></AuthedLayout>} />
          <Route path="/settings" element={<AuthedLayout onLogout={handleLogout}><Settings /></AuthedLayout>} />
          <Route path="/users" element={<AuthedLayout onLogout={handleLogout}><UserManagement /></AuthedLayout>} />
          <Route path="/platform-docs" element={<AuthedLayout onLogout={handleLogout}><PlatformDocs /></AuthedLayout>} />
          <Route path="/api-docs" element={<AuthedLayout onLogout={handleLogout}><ApiDocs /></AuthedLayout>} />
          <Route path="/skills" element={<AuthedLayout onLogout={handleLogout}><Skills /></AuthedLayout>} />
          <Route path="/marketplace" element={<AuthedLayout onLogout={handleLogout}><Marketplace /></AuthedLayout>} />
          <Route path="/my-listings" element={<AuthedLayout onLogout={handleLogout}><MyListings /></AuthedLayout>} />
          <Route path="/devices" element={<AuthedLayout onLogout={handleLogout}><DeviceManagement /></AuthedLayout>} />
          <Route path="/device-management" element={<AuthedLayout onLogout={handleLogout}><DeviceManagement /></AuthedLayout>} />
          <Route path="/activity" element={<AuthedLayout onLogout={handleLogout}><ActivityLog /></AuthedLayout>} />
          <Route path="/settings/team" element={<AuthedLayout onLogout={handleLogout}><TeamSettings /></AuthedLayout>} />

          <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/'} replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
