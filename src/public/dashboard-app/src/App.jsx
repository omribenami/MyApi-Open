import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import LandingPage from './pages/LandingPage';
import SignUp from './pages/SignUp';
import LogIn from './pages/LogIn';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
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

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const initialize = useAuthStore((state) => state.initialize);
  const fetchWorkspaces = useAuthStore((state) => state.fetchWorkspaces);
  const handleLogout = useAuthStore((state) => state.logout);
  const forceUnauthenticated = useAuthStore((state) => state.forceUnauthenticated);

  // Initialize auth store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load workspaces once authenticated
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

  // Authenticated - show dashboard with router
  // Unauthenticated users get routed through landing/signup/login pages
  return (
    <QueryClientProvider client={queryClient}>
      <Router basename="/dashboard">
        <Routes>
          {/* Unauthenticated Routes */}
          {!isAuthenticated && (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/login" element={<LogIn />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}

          {/* Authenticated Routes */}
          {isAuthenticated && (
            <>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route
                path="/*"
                element={
                  <Layout onLogout={handleLogout}>
                    <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <ServiceConnectors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tokens"
              element={
                <ProtectedRoute>
                  <TokenVault />
                </ProtectedRoute>
              }
            />
            <Route
              path="/access-tokens"
              element={
                <ProtectedRoute>
                  <AccessTokens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personas"
              element={
                <ProtectedRoute>
                  <Personas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/identity"
              element={
                <ProtectedRoute>
                  <Identity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge"
              element={
                <ProtectedRoute>
                  <KnowledgeBase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/platform-docs"
              element={
                <ProtectedRoute>
                  <PlatformDocs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/api-docs"
              element={
                <ProtectedRoute>
                  <ApiDocs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/skills"
              element={
                <ProtectedRoute>
                  <Skills />
                </ProtectedRoute>
              }
            />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route
              path="/my-listings"
              element={
                <ProtectedRoute>
                  <MyListings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <DeviceManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/device-management"
              element={
                <ProtectedRoute>
                  <DeviceManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity"
              element={
                <ProtectedRoute>
                  <ActivityLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/team"
              element={
                <ProtectedRoute>
                  <TeamSettings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                }
              />
            </>
          )}
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
