import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import OnboardingModal from './components/OnboardingModal';
import { wasOnboardingDismissed } from './utils/onboardingUtils';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import ServiceConnectors from './pages/ServiceConnectors';
import TokenVault from './pages/TokenVault';
import AccessTokens from './pages/AccessTokens';
import Personas from './pages/Personas';
import KnowledgeBase from './pages/KnowledgeBase';
import Identity from './pages/Identity';
import Settings from './pages/Settings';
import EnterpriseSettings from './pages/EnterpriseSettings';
import UserManagement from './pages/UserManagement';
import PlatformDocs from './pages/PlatformDocs';
import ApiDocs from './pages/ApiDocs';
import Marketplace from './pages/Marketplace';
import MyListings from './pages/MyListings';
import Skills from './pages/Skills';
import DeviceManagement from './pages/DeviceManagement';
import ActivityLog from './pages/ActivityLog';
import NotificationCenter from './pages/NotificationCenter';
import TeamSettings from './pages/TeamSettings';
import Connectors from './pages/Connectors';
import Memory from './pages/Memory';
import OAuthAuthorize from './pages/OAuthAuthorize';
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
  const handleLogout = useAuthStore((state) => state.logout);
  const forceUnauthenticated = useAuthStore((state) => state.forceUnauthenticated);
  const fetchWorkspaces = useAuthStore((state) => state.fetchWorkspaces);
  const user = useAuthStore((state) => state.user);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Initialize auth store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Keep workspace context loaded globally for switcher + scoped UX
  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
    }
  }, [isAuthenticated, fetchWorkspaces]);

  // Show onboarding modal for new users
  useEffect(() => {
    if (isAuthenticated && user?.needsOnboarding && !wasOnboardingDismissed()) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, user?.needsOnboarding]);

  // Handle OAuth callbacks at app level (runs before router decides which component to show)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth_status');
    const confirmToken = urlParams.get('token');
    const oauthMode = urlParams.get('mode');
    const nextUrl = urlParams.get('next');

    // For service-connect flows, redirect to the intended destination with OAuth params
    // so the target page (e.g. ServiceConnectors) can show the success state.
    if (oauthStatus === 'connected' && oauthMode === 'connect' && nextUrl) {
      const decoded = decodeURIComponent(nextUrl);
      // Only allow internal redirects under /dashboard/ to prevent open redirects
      if (decoded.startsWith('/dashboard/') || decoded === '/dashboard') {
        const target = new URL(decoded, window.location.origin);
        const oauthService = urlParams.get('oauth_service');
        if (oauthService) target.searchParams.set('oauth_service', oauthService);
        target.searchParams.set('oauth_status', 'connected');
        target.searchParams.set('mode', 'connect');
        window.location.replace(target.toString());
        return;
      }
    }

    if (oauthStatus === 'confirm_login' && confirmToken) {
      // Step 1: Confirm the OAuth login with the backend
      fetch('/api/v1/oauth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: confirmToken })
      })
        .then(res => res.ok ? res.json() : null)
        .then(result => {
          if (result?.ok) {
            // Step 2: Confirmation succeeded, now fetch user data
            return fetch('/api/v1/auth/me', { credentials: 'include' })
              .then(res => res.ok ? res.json() : null);
          }
        })
        .then(sessionUser => {
          if (sessionUser?.user) {
            const { setMasterToken, setUser } = useAuthStore.getState();
            if (sessionUser.user?.bootstrap?.masterToken) {
              setMasterToken(sessionUser.user.bootstrap.masterToken);
            }
            setUser(sessionUser.user);
            // Clear OAuth params from URL
            window.history.replaceState({}, document.title, '/dashboard/');
          }
        })
        .catch(() => {
          // Silently fail - user will see dashboard or login based on auth state
        });
    }
  }, []);

  // Load workspaces once authenticated
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
        {isAuthenticated && showOnboarding && (
          <OnboardingModal onClose={() => setShowOnboarding(false)} />
        )}
        <Routes>
          {/* Unauthenticated Routes */}
          {!isAuthenticated && (
            <>
              <Route path="/" element={<Login />} />
              <Route path="/authorize" element={<OAuthAuthorize />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}

          {/* Authenticated Routes */}
          {isAuthenticated && (
            <>
              {/* OAuth consent page — no Layout/sidebar, standalone */}
              <Route path="/authorize" element={<OAuthAuthorize />} />
              <Route
                path="/*"
                element={
                  <Layout onLogout={handleLogout}>
                    <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/connectors"
              element={
                <ProtectedRoute>
                  <Connectors />
                </ProtectedRoute>
              }
            />
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
            <Route
              path="/memory"
              element={
                <ProtectedRoute>
                  <Memory />
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
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationCenter />
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
            <Route
              path="/enterprise"
              element={
                <ProtectedRoute>
                  <EnterpriseSettings />
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
