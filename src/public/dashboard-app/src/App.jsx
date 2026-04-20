import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import OnboardingModal from './components/OnboardingModal';
import SessionExpiredOverlay from './components/SessionExpiredOverlay';
import { isOnboardingActive, wasModalDismissed, restartOnboarding } from './utils/onboardingUtils';
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
import BetaAdmin from './pages/BetaAdmin';
import Tickets from './pages/Tickets';
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
import LogIn from './pages/LogIn';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Onboarding from './pages/Onboarding';
import Activate from './pages/Activate';
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
  const [showSessionExpired, setShowSessionExpired] = useState(false);

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

  // New users enter onboarding mode immediately.
  useEffect(() => {
    if (isAuthenticated && user?.needsOnboarding) {
      restartOnboarding();
      setShowOnboarding(true);
    }
  }, [isAuthenticated, user?.needsOnboarding]);

  // If onboarding mode is still active and the modal was not dismissed, reopen it.
  useEffect(() => {
    if (isAuthenticated && isOnboardingActive() && !wasModalDismissed()) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated]);

  // Allow other components (e.g. Settings) to reopen the onboarding modal
  useEffect(() => {
    const onOpen = () => {
      restartOnboarding();
      setShowOnboarding(true);
    };
    window.addEventListener('myapi:open-onboarding', onOpen);
    return () => window.removeEventListener('myapi:open-onboarding', onOpen);
  }, []);

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
          // Confirm failed — fall through with null so the failure path runs
          return null;
        })
        .then((sessionUser) => {
          if (sessionUser?.user) {
            const { setMasterToken, setUser } = useAuthStore.getState();
            // /auth/me always returns the platform-generated master token in
            // bootstrap.masterToken (creating it on first login if needed).
            if (sessionUser.bootstrap?.masterToken) {
              setMasterToken(sessionUser.bootstrap.masterToken);
            }
            setUser(sessionUser.user);
            // If login was initiated from an OAuth consent page (e.g. agent-auth installer),
            // redirect back there instead of dropping the user on the dashboard home.
            const nextUrl = urlParams.get('next');
            if (nextUrl && (nextUrl.startsWith('/dashboard/') || nextUrl === '/dashboard')) {
              window.location.replace(nextUrl);
            } else {
              window.history.replaceState({}, document.title, '/dashboard/');
            }
          } else {
            // Confirm or auth/me failed — send user back to landing to re-authenticate
            window.location.replace('/');
          }
        })
        .catch(() => {
          window.location.replace('/');
        });
    } else if (oauthStatus === 'pending_2fa') {
      // User has 2FA enabled — redirect to the login page which has the 2FA input form.
      // Guard: if already on /login, don't redirect again (prevents infinite loop).
      if (!window.location.pathname.endsWith('/login')) {
        window.location.replace(`/dashboard/login${window.location.search}`);
      }
    } else if (oauthStatus === 'signup_required') {
      // New-user signup flow — Login.jsx handles it via its own useEffect.
      // Do NOT redirect; just let the router render the login page with the params intact.
    } else if (oauthStatus && oauthStatus !== 'connected') {
      // Unhandled oauth_status (e.g. unknown 'error') with no confirm token —
      // strip the params and redirect to landing so the user isn't stuck forever.
      window.location.replace('/');
    }
  }, []);

  // Show a friendly overlay when the session expires due to inactivity.
  // Only show it if the user was actively authenticated — not during login
  // flows, initial load, or after an explicit logout (which sets isAuthenticated
  // false before firing the event).
  useEffect(() => {
    const onAuthExpired = () => {
      const wasAuthenticated = useAuthStore.getState().isAuthenticated;
      forceUnauthenticated();
      if (wasAuthenticated) {
        setShowSessionExpired(true);
      }
    };
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

  // Unauthenticated users: redirect to landing page unless they're in an OAuth flow,
  // on the /authorize consent page, or on the dedicated /login page.
  if (!isAuthenticated) {
    const urlParams = new URLSearchParams(window.location.search);
    const isAuthorizePath = window.location.pathname.includes('/authorize');
    const isLoginPath = window.location.pathname.endsWith('/login');
    const isSignupPath = window.location.pathname.endsWith('/signup');
    const isDocsPath = window.location.pathname.includes('/platform-docs') || window.location.pathname.includes('/api-docs');
    if (!urlParams.has('oauth_status') && !isAuthorizePath && !isLoginPath && !isSignupPath && !isDocsPath) {
      window.location.replace('/');
      return null;
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      {showSessionExpired && (
        <SessionExpiredOverlay onDismiss={() => setShowSessionExpired(false)} />
      )}
      <Router basename="/dashboard">
        {isAuthenticated && showOnboarding && (
          <OnboardingModal onClose={() => setShowOnboarding(false)} />
        )}
        <Routes>
          {/* Unauthenticated Routes — only OAuth flows reach here; all others are
              redirected to the landing page before this Router mounts */}
          {!isAuthenticated && (
            <>
              <Route path="/authorize" element={<OAuthAuthorize />} />
              <Route path="/login" element={<LogIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/platform-docs" element={<PlatformDocs />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="/" element={<Login />} />
              <Route path="*" element={
                <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500" />
                    <p>Signing you in…</p>
                  </div>
                </div>
              } />
            </>
          )}

          {/* Authenticated Routes */}
          {isAuthenticated && (
            <>
              {/* OAuth consent page — no Layout/sidebar, standalone */}
              <Route path="/authorize" element={<OAuthAuthorize />} />
              {/* Device Flow activation — standalone, no sidebar */}
              <Route path="/activate" element={<Activate />} />
              {/* Post-signup onboarding wizard — standalone, no sidebar */}
              <Route path="/onboarding" element={<Onboarding />} />
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
              path="/beta"
              element={
                <ProtectedRoute>
                  <BetaAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <Tickets />
                </ProtectedRoute>
              }
            />
            <Route path="/platform-docs" element={<PlatformDocs />} />
            <Route path="/api-docs" element={<ApiDocs />} />
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
