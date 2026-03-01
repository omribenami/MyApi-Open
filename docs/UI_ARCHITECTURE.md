# MyApi Dashboard - UI Architecture Document

## 1. Architecture Overview

**Technology Stack**:
- **Framework**: React 18+ (with hooks)
- **Routing**: React Router v6+
- **State Management**: Zustand (global store) + React Query (server state)
- **Styling**: Tailwind CSS + CSS Modules (for scoped styles)
- **UI Components**: Headless UI / Radix UI (accessibility built-in)
- **Forms**: React Hook Form + Zod (validation)
- **Data Fetching**: TanStack Query (React Query) v4+
- **WebSocket**: Socket.IO or native WebSocket API
- **Build**: Vite or Create React App

---

## 2. Component Hierarchy

### High-Level Structure

```
App
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── SearchBar (optional)
│   │   ├── ThemeToggle
│   │   ├── NotificationBell
│   │   └── ProfileMenu
│   │       ├── Profile dropdown
│   │       ├── Logout
│   │       └── Settings
│   ├── Sidebar
│   │   ├── NavItem (Services)
│   │   ├── NavItem (Tokens)
│   │   ├── NavItem (Personas)
│   │   ├── NavItem (Identity)
│   │   ├── NavItem (Knowledge Base)
│   │   └── NavItem (Settings)
│   └── MainContent
│       ├── TabNavigation
│       │   ├── Tab 1: Services
│       │   ├── Tab 2: Tokens Vault
│       │   ├── Tab 3: Personas
│       │   ├── Tab 4: Identity
│       │   ├── Tab 5: Knowledge Base
│       │   └── Tab 6: Settings
│       └── Content (per tab)
├── Modals
│   ├── OAuthFlow modal
│   ├── TokenCreateForm modal
│   ├── PersonaPreview modal
│   ├── ConfirmAction modal
│   └── EditIdentity modal
├── Notifications
│   └── Toast container
├── ErrorBoundary
└── LoadingSkeletons

```

### Detailed Component Files Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Icon.tsx
│   │   ├── Alert.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Spinner.tsx
│   │   └── ErrorBoundary.tsx
│   │
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   ├── TabNavigation.tsx
│   │   └── PageWrapper.tsx
│   │
│   ├── tabs/
│   │   ├── ServicesTab.tsx
│   │   ├── TokensTab.tsx
│   │   ├── PersonasTab.tsx
│   │   ├── IdentityTab.tsx
│   │   ├── KnowledgeBaseTab.tsx
│   │   └── SettingsTab.tsx
│   │
│   ├── services/
│   │   ├── ServiceCard.tsx
│   │   ├── ServiceConnectButton.tsx
│   │   ├── ServiceStatusBadge.tsx
│   │   └── OAuthFlowModal.tsx
│   │
│   ├── tokens/
│   │   ├── TokenCard.tsx
│   │   ├── TokenList.tsx
│   │   ├── TokenCreateForm.tsx
│   │   ├── TokenRevealButton.tsx
│   │   ├── TokenCopyButton.tsx
│   │   └── ScopeSelector.tsx
│   │
│   ├── personas/
│   │   ├── PersonaCard.tsx
│   │   ├── PersonaList.tsx
│   │   ├── PersonaCreateForm.tsx
│   │   ├── PersonaPreviewModal.tsx
│   │   └── PersonaSwitch.tsx
│   │
│   ├── identity/
│   │   ├── IdentitySplitView.tsx
│   │   ├── UserProfileEditor.tsx
│   │   ├── SoulEditorModal.tsx
│   │   ├── ContextPreview.tsx
│   │   └── MarkdownEditor.tsx
│   │
│   ├── knowledge-base/
│   │   ├── KBViewer.tsx
│   │   ├── KBEditor.tsx
│   │   ├── DocumentList.tsx
│   │   ├── DocumentUpload.tsx
│   │   ├── KBSearch.tsx
│   │   └── KBStatistics.tsx
│   │
│   ├── settings/
│   │   ├── ProfileSettings.tsx
│   │   ├── SecuritySettings.tsx
│   │   ├── PrivacySettings.tsx
│   │   ├── WebhookSettings.tsx
│   │   ├── DangerZone.tsx
│   │   └── DeleteAccountModal.tsx
│   │
│   └── modals/
│       ├── ConfirmActionModal.tsx
│       ├── EditModal.tsx
│       └── PreviewModal.tsx
│
├── hooks/
│   ├── useAuth.ts
│   ├── useServices.ts
│   ├── useTokens.ts
│   ├── usePersonas.ts
│   ├── useIdentity.ts
│   ├── useKnowledgeBase.ts
│   ├── useWebSocket.ts
│   ├── useTheme.ts
│   ├── useForm.ts (wrapper)
│   └── useNotification.ts
│
├── stores/
│   ├── authStore.ts (Zustand)
│   ├── uiStore.ts (modals, notifications, theme)
│   ├── personaStore.ts
│   └── cacheStore.ts
│
├── api/
│   ├── client.ts (Axios/Fetch wrapper)
│   ├── auth.ts (login, logout, oauth)
│   ├── services.ts (connect, disconnect, status)
│   ├── tokens.ts (CRUD, revoke)
│   ├── personas.ts (CRUD)
│   ├── identity.ts (USER.md, SOUL.md)
│   ├── knowledge-base.ts (CRUD documents)
│   ├── settings.ts (profile, security, privacy)
│   └── websocket.ts (real-time updates)
│
├── types/
│   ├── auth.ts
│   ├── service.ts
│   ├── token.ts
│   ├── persona.ts
│   ├── identity.ts
│   ├── knowledge-base.ts
│   └── api.ts
│
├── utils/
│   ├── formatting.ts (date, token preview)
│   ├── validation.ts (email, password, etc.)
│   ├── storage.ts (localStorage helpers)
│   ├── security.ts (token masking, etc.)
│   └── constants.ts (colors, sizes, breakpoints)
│
├── styles/
│   ├── globals.css (Tailwind directives)
│   ├── variables.css (CSS custom properties)
│   └── animations.css (keyframes)
│
├── pages/
│   ├── LoginPage.tsx
│   ├── OnboardingPage.tsx
│   ├── DashboardPage.tsx
│   ├── NotFoundPage.tsx
│   └── ErrorPage.tsx
│
├── App.tsx
├── App.css
└── main.tsx
```

---

## 3. State Management Strategy

### Global State (Zustand)

#### Auth Store
```typescript
interface AuthStore {
  // State
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login(credentials): Promise<void>;
  loginWithOAuth(provider): Promise<void>;
  logout(): void;
  setUser(user): void;
  setError(error): void;
}
```

#### UI Store (Modals, Theme, Notifications)
```typescript
interface UIStore {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme(): void;
  setTheme(theme): void;
  
  // Modal state
  activeModal: string | null;
  modalData: Record<string, any>;
  openModal(name, data?): void;
  closeModal(): void;
  
  // Notifications
  notifications: Toast[];
  addNotification(toast): void;
  removeNotification(id): void;
  
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar(): void;
}
```

#### Persona Store
```typescript
interface PersonaStore {
  activePersona: Persona | null;
  personas: Persona[];
  
  switchPersona(id): void;
  addPersona(persona): void;
  updatePersona(id, data): void;
  deletePersona(id): void;
}
```

### Server State (React Query)

#### Queries
```typescript
// Services
useServicesQuery() // GET /api/services
useServiceQuery(id) // GET /api/services/{id}

// Tokens
useTokensQuery() // GET /api/tokens
useTokenQuery(id) // GET /api/tokens/{id}

// Personas
usePersonasQuery() // GET /api/personas
usePersonaQuery(id) // GET /api/personas/{id}

// Identity
useIdentityQuery() // GET /api/identity (USER.md + SOUL.md)

// Knowledge Base
useDocumentsQuery() // GET /api/knowledge-base
useDocumentQuery(id) // GET /api/knowledge-base/{id}
```

#### Mutations
```typescript
// Services
useConnectServiceMutation() // POST /api/services/{id}/connect
useDisconnectServiceMutation() // DELETE /api/services/{id}

// Tokens
useCreateTokenMutation() // POST /api/tokens
useRevokeTokenMutation() // DELETE /api/tokens/{id}
useUpdateTokenMutation() // PUT /api/tokens/{id}

// Personas
useCreatePersonaMutation() // POST /api/personas
useUpdatePersonaMutation() // PUT /api/personas/{id}
useDeletePersonaMutation() // DELETE /api/personas/{id}

// Identity
useUpdateIdentityMutation() // PUT /api/identity

// Knowledge Base
useUploadDocumentMutation() // POST /api/knowledge-base
useDeleteDocumentMutation() // DELETE /api/knowledge-base/{id}
```

### Local Component State (useState)

- Form inputs: Managed locally, only sync to server on submit
- UI temporary states: Modal open/close, expand/collapse
- Transient values: Search input, filter selections

---

## 4. API Integration Points

### Base Configuration
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Axios instance with auth interceptor
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
apiClient.interceptors.request.use((config) => {
  const token = authStore.sessionToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      authStore.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Error Handling

**Response Structure**:
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}
```

**Error Types**:
- 400 Bad Request: Validation errors, show field-level errors
- 401 Unauthorized: Session expired, redirect to login
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource not found, show 404 page
- 429 Too Many Requests: Rate limited, show retry after time
- 500 Server Error: Generic error modal, show error ID

**Error Display Strategy**:
1. Field-level validation errors (inline in form)
2. Top-of-page alerts for non-critical errors
3. Modal dialogs for critical errors (server down, etc.)
4. Toast notifications for success/confirmation

### Loading States

**Query Loading**:
- Show skeleton loader while fetching
- Disable interactive elements during mutation
- Show spinner in button for form submissions

**Skeleton Components**:
```typescript
<ServiceCardSkeleton /> // Gray bars matching card structure
<TokenCardSkeleton />
<PersonaCardSkeleton />
```

**Mutation States**:
```typescript
const { mutate, isLoading, error } = useCreateTokenMutation();

<Button disabled={isLoading}>
  {isLoading ? 'Creating...' : 'Create Token'}
</Button>
```

---

## 5. Real-Time Updates via WebSocket

### Connection Lifecycle

```typescript
// Hook: useWebSocket
const { connected, lastMessage } = useWebSocket();

useEffect(() => {
  if (!lastMessage) return;
  
  const event = JSON.parse(lastMessage.data);
  
  switch (event.type) {
    case 'service_connected':
      queryClient.invalidateQueries(['services']);
      addNotification({
        type: 'success',
        message: `${event.service} connected!`,
      });
      break;
      
    case 'token_revoked':
      queryClient.invalidateQueries(['tokens']);
      addNotification({
        type: 'warning',
        message: `Token revoked`,
      });
      break;
      
    case 'persona_created':
      queryClient.invalidateQueries(['personas']);
      break;
      
    case 'identity_updated':
      queryClient.invalidateQueries(['identity']);
      break;
  }
}, [lastMessage]);
```

### Event Types

| Event Type | Payload | Action |
|-----------|---------|--------|
| `service_connected` | `{ service: string, scopes: [] }` | Invalidate services query, show toast |
| `service_disconnected` | `{ service: string }` | Invalidate services query, show toast |
| `token_revoked` | `{ tokenId: string }` | Invalidate tokens query, show toast |
| `persona_created` | `{ persona: Persona }` | Invalidate personas query |
| `persona_updated` | `{ persona: Persona }` | Invalidate personas query |
| `persona_deleted` | `{ personaId: string }` | Invalidate personas query |
| `identity_updated` | `{ user: User, soul: Soul }` | Invalidate identity query |
| `kb_document_added` | `{ document: Document }` | Invalidate KB query, show toast |
| `kb_document_deleted` | `{ documentId: string }` | Invalidate KB query |

### Fallback: Polling Strategy

If WebSocket is unavailable:
```typescript
// useQuery with staleTime and refetchInterval
const { data, isLoading } = useQuery(
  ['services'],
  fetchServices,
  {
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  }
);
```

---

## 6. Form Handling with React Hook Form + Zod

### Example: Token Creation Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const tokenSchema = z.object({
  name: z.string().min(1, 'Token name required'),
  expiresIn: z.enum(['7d', '30d', '90d', 'never']),
  scopes: z.array(z.string()).min(1, 'Select at least one scope'),
});

type TokenFormData = z.infer<typeof tokenSchema>;

function TokenCreateForm() {
  const { register, handleSubmit, formState: { errors }, watch } = useForm<TokenFormData>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      expiresIn: '30d',
      scopes: [],
    },
  });
  
  const { mutate, isLoading } = useCreateTokenMutation();
  
  const onSubmit = async (data: TokenFormData) => {
    mutate(data, {
      onSuccess: (token) => {
        addNotification({
          type: 'success',
          message: 'Token created',
        });
        openModal('tokenPreview', { token });
        queryClient.invalidateQueries(['tokens']);
      },
      onError: (error) => {
        addNotification({
          type: 'error',
          message: error.message,
        });
      },
    });
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Token Name"
        {...register('name')}
        error={errors.name?.message}
      />
      
      <Select
        label="Expires In"
        {...register('expiresIn')}
        options={[
          { label: '7 days', value: '7d' },
          { label: '30 days', value: '30d' },
          { label: '90 days', value: '90d' },
          { label: 'Never', value: 'never' },
        ]}
      />
      
      <ScopeSelector
        {...register('scopes')}
        error={errors.scopes?.message}
      />
      
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Token'}
      </Button>
    </form>
  );
}
```

---

## 7. Authentication Flow

### Login Flow
```
1. User clicks "Login" or arrives at protected route
2. Redirect to /login page
3. User selects OAuth provider (Google, GitHub, Facebook)
4. Popup opens for OAuth consent
5. Redirect back to app with auth code
6. Exchange code for session token via backend
7. Store token in sessionStorage (not localStorage for security)
8. Redirect to onboarding or dashboard
9. Fetch user profile, personalize UI
```

### Session Management
- **Token Storage**: sessionStorage (cleared on tab close)
- **Token Refresh**: Use refresh token (stored in httpOnly cookie from backend)
- **Logout**: Clear sessionStorage, delete refresh token, redirect to /login

### Protected Routes
```typescript
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <Spinner />;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
}
```

---

## 8. Module Dependencies Map

```
UI Components
    ↓
  Hooks (useAuth, useServices, etc.)
    ↓
  Zustand Stores + React Query
    ↓
  API Client (Axios)
    ↓
  Backend API
```

---

## 9. Performance Optimization

### Code Splitting
```typescript
// pages loaded lazily via React.lazy
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Wrap in Suspense
<Suspense fallback={<Spinner />}>
  <Routes>
    <Route path="/dashboard" element={<DashboardPage />} />
  </Routes>
</Suspense>
```

### Query Deduplication
React Query automatically deduplicates identical queries made within the same millisecond.

### Memoization
```typescript
// Memoize expensive components
const ServiceCard = memo(({ service, onConnect, onDisconnect }) => {
  return (
    <Card>
      {/* ... */}
    </Card>
  );
});
```

### Image Optimization
- Use Next.js Image component or lazy loading for user avatars
- Optimize service logos (SVG or WebP)
- Use placeholders (blurhash or skeleton)

### Bundle Size
- Tree-shake unused code with `sideEffects: false` in package.json
- Monitor with `webpack-bundle-analyzer`
- Use dynamic imports for heavy libraries

---

## 10. Testing Strategy (Brief)

### Unit Tests (Vitest)
- API client functions
- Utility functions (formatting, validation)
- Store actions (Zustand)

### Component Tests (Vitest + React Testing Library)
- Common components (Button, Input, Card)
- Feature components (ServiceCard, TokenCard)
- Form components with validation

### Integration Tests
- Full tab flows (connect service, create token)
- Form submissions with API calls
- Navigation between tabs

### E2E Tests (Playwright or Cypress)
- Login flow
- OAuth callback
- First-time setup
- Create token → Revoke token
- Switch persona → Edit identity

---

## 11. Deployment Considerations

### Environment Variables
```
REACT_APP_API_URL=https://api.myapi.com
REACT_APP_OAUTH_CLIENT_ID=...
REACT_APP_OAUTH_REDIRECT_URI=https://app.myapi.com/auth/callback
REACT_APP_WS_URL=wss://api.myapi.com/ws
```

### Build Optimizations
- Minify CSS + JS (Vite does this)
- Source maps for production debugging
- Compress images

### Hosting
- CDN for static assets (Cloudflare, AWS CloudFront)
- Cache headers for long-term caching
- Service worker for offline capability

### Monitoring
- Sentry for error tracking
- LogRocket for session replay
- Datadog for performance monitoring

---

## 12. Accessibility Compliance (Automated)

### Testing Tools
- axe DevTools (browser extension)
- jest-axe (automated testing)
- WAVE Web Accessibility Evaluation Tool

### Checklist
- [ ] All images have alt text
- [ ] Form labels associated with inputs
- [ ] Focus indicators visible
- [ ] Color contrast >= 4.5:1
- [ ] Keyboard navigation works
- [ ] ARIA labels on icon buttons
- [ ] Error messages linked to fields
- [ ] No auto-playing animations

---

## End of UI_ARCHITECTURE.md
