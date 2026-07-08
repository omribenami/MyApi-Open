import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import OnboardingModal from './components/OnboardingModal';
import SessionExpiredOverlay from './components/SessionExpiredOverlay';
import ProductTour from './components/ProductTour';
import { useTourStore, tourSeen, markTourSeen } from './stores/tourStore';
import { ESSENTIALS } from './stores/tourSteps';
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
import Organization from './pages/Organization';
import UserManagement from './pages/UserManagement';
import BetaAdmin from './pages/BetaAdmin';
import Broadcast from './pages/Broadcast';
import Tickets from './pages/Tickets';
import Analytics from './pages/Analytics';
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
import Automations from './pages/Automations';
import OAuthAuthorize from './pages/OAuthAuthorize';
import SignUp from './pages/SignUp';
import SigningIn from './pages/SigningIn';
import RestoringSession from './pages/RestoringSession';
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
  const [_showOnboarding, setShowOnboarding] = useState(false);
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

  // New users go to the onboarding wizard instead of the old modal.
  useEffect(() => {
    if (isAuthenticated && user?.needsOnboarding) {
      const onOnboarding = window.location.pathname.includes('/onboarding');
      if (!onOnboarding) {
        window.location.replace('/dashboard/onboarding');
      }
    }
  }, [isAuthenticated, user?.needsOnboarding]);

  // Kick off the guided product tour once — only AFTER onboarding is fully done
  // and the user is settled inside the real dashboard shell. We never start it
  // during the standalone onboarding wizard (which has no sidebar/targets) so the
  // tour and onboarding don't collide.
  useEffect(() => {
    if (!isAuthenticated || user?.needsOnboarding || tourSeen()) return;
    if (isOnboardingActive()) return; // onboarding checklist still in progress
    const path = window.location.pathname;
    if (path.includes('/onboarding') || path.includes('/authorize') || path.includes('/activate')) return;
    const t = setTimeout(() => {
      if (tourSeen() || isOnboardingActive() || useAuthStore.getState().user?.needsOnboarding) return;
      // Only start once the dashboard shell (and its nav targets) is actually mounted.
      if (!document.querySelector('[data-tour="dashboard"]')) return;
      markTourSeen();
      useTourStore.getState().start(ESSENTIALS);
    }, 1200);
    return () => clearTimeout(t);
  }, [isAuthenticated, user?.needsOnboarding]);

  // Explicit "Take a tour" request from the onboarding finish step. Unlike the
  // auto-start above (which fires once and bails if targets aren't mounted yet),
  // this polls until the dashboard shell mounts so the tour reliably starts even
  // when navigation out of the wizard is slow.
  useEffect(() => {
    if (!isAuthenticated || user?.needsOnboarding) return;
    let pending = false;
    try { pending = sessionStorage.getItem('myapi_pending_tour') === '1'; } catch { /* ignore */ }
    if (!pending) return;
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      if (document.querySelector('[data-tour="dashboard"]')) {
        clearInterval(iv);
        try { sessionStorage.removeItem('myapi_pending_tour'); } catch { /* ignore */ }
        markTourSeen();
        useTourStore.getState().start(ESSENTIALS);
      } else if (tries > 40) { // give up after ~10s
        clearInterval(iv);
        try { sessionStorage.removeItem('myapi_pending_tour'); } catch { /* ignore */ }
      }
    }, 250);
    return () => clearInterval(iv);
  }, [isAuthenticated, user?.needsOnboarding]);

  // Legacy: if onboarding mode flag is set and modal not yet dismissed, redirect to wizard.
  useEffect(() => {
    if (isAuthenticated && isOnboardingActive() && !wasModalDismissed()) {
      const onOnboarding = window.location.pathname.includes('/onboarding');
      if (!onOnboarding) {
        window.location.replace('/dashboard/onboarding');
      }
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
    // When the callback lands on /signup, that page handles it — skip to avoid double-processing.
    if (window.location.pathname.endsWith('/signup')) return;

    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth_status');
    const confirmToken = urlParams.get('token');
    const oauthMode = urlParams.get('mode');
    const nextUrl = urlParams.get('next');

    // For service-connect flows, redirect to the intended destination with OAuth params
    // so the target page (e.g. ServiceConnectors) can show the success state.
    if (oauthStatus === 'connected' && (oauthMode === 'connect' || oauthMode === 'signup') && nextUrl) {
      const decoded = decodeURIComponent(nextUrl);
      // Only allow internal redirects under /dashboard/ to prevent open redirects
      if (decoded.startsWith('/dashboard/') || decoded === '/dashboard') {
        if (oauthMode === 'signup' && decoded === '/dashboard/') {
          // Signup with no specific returnTo — check needsOnboarding via /auth/me
          fetch('/api/v1/auth/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(result => {
              if (result?.user?.needsOnboarding) {
                window.location.replace('/dashboard/onboarding');
              } else {
                window.location.replace('/dashboard/');
              }
            })
            .catch(() => window.location.replace('/dashboard/'));
          return;
        }
        const target = new URL(decoded, window.location.origin);
        const oauthService = urlParams.get('oauth_service');
        if (oauthService) target.searchParams.set('oauth_service', oauthService);
        target.searchParams.set('oauth_status', 'connected');
        target.searchParams.set('mode', oauthMode);
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
            // New users go to the onboarding wizard; returning users go to dashboard or next URL.
            const nextUrl = urlParams.get('next');
            if (sessionUser.user?.needsOnboarding) {
              window.location.replace('/dashboard/onboarding');
            } else if (nextUrl && (nextUrl.startsWith('/dashboard/') || nextUrl === '/dashboard')) {
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
      // User has 2FA enabled — landing page handles the 2FA form.
      window.location.replace(`/${window.location.search}`);
    } else if (oauthStatus === 'signup_required') {
      // No account for this OAuth identity — route to /signup so SignUp.jsx can complete the flow.
      if (!window.location.pathname.endsWith('/signup')) {
        window.location.replace(`/dashboard/signup${window.location.search}`);
      }
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
    return <RestoringSession onSignOut={() => { window.location.href = '/'; }} />;
  }

  // Unauthenticated users: redirect to landing page unless they're in an in-progress
  // OAuth flow that another page is actively processing (signup_required / confirm_login
  // / pending_2fa), or on the /authorize consent / /signup / docs pages.
  if (!isAuthenticated) {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth_status');
    const isAuthorizePath = window.location.pathname.includes('/authorize');
    const isSignupPath = window.location.pathname.endsWith('/signup');
    const isDocsPath = window.location.pathname.includes('/platform-docs') || window.location.pathname.includes('/api-docs');
    // Only these oauth_status values represent an in-progress callback that a page
    // is actively processing. Other statuses (connected/error/etc) with no session
    // mean the flow already finished — send the user back to landing to retry.
    const isInProgressCallback = ['signup_required', 'confirm_login', 'pending_2fa'].includes(oauthStatus);
    if (!isAuthorizePath && !isSignupPath && !isDocsPath && !isInProgressCallback) {
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
        {/* Onboarding handled by /onboarding route — no modal needed */}
        <Routes>
          {/* Unauthenticated Routes — only OAuth flows reach here; all others are
              redirected to the landing page before this Router mounts */}
          {!isAuthenticated && (
            <>
              <Route path="/authorize" element={<OAuthAuthorize />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/platform-docs" element={<PlatformDocs />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="*" element={
                <SigningIn
                  serviceKey={new URLSearchParams(window.location.search).get('oauth_service') || undefined}
                  onCancel={() => { window.location.href = '/'; }}
                />
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
            <Route path="/connect-agent" element={<Navigate to="/connectors" replace />} />
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
              path="/broadcast"
              element={
                <ProtectedRoute>
                  <Broadcast />
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
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
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
              path="/automations"
              element={
                <ProtectedRoute>
                  <Automations />
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
            <Route
              path="/organization"
              element={
                <ProtectedRoute>
                  <Organization />
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
        {isAuthenticated && <ProductTour />}
      </Router>
    </QueryClientProvider>
  );
}

export default App;
