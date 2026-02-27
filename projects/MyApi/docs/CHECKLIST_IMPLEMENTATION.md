# MyApi Dashboard - Implementation Checklist

**Project**: MyApi Dashboard UI/UX Overhaul
**Timeline**: 16 weeks (4 months)
**Version**: 1.0.0 MVP
**Start Date**: [TO BE FILLED]
**Target Launch**: 16 weeks from start

---

## Phase 1: Foundation & Setup (Weeks 1-2)

### Week 1: Project Infrastructure

#### Project Setup
- [ ] Create new Vite + React + TypeScript project
- [ ] Install all dependencies (see DEVELOPER_QUICK_START.md)
- [ ] Configure ESLint + Prettier
- [ ] Set up Git workflow and branch strategy
- [ ] Create GitHub Actions for CI/CD
- [ ] Initialize project documentation

#### Design Tokens Implementation
- [ ] Create `src/styles/variables.css` with CSS custom properties
- [ ] Create `src/utils/constants.ts` with color palette
- [ ] Create `src/utils/constants.ts` with spacing values
- [ ] Create `src/utils/constants.ts` with typography
- [ ] Create `src/utils/constants.ts` with breakpoints
- [ ] Tailwind CSS configured with design system
- [ ] Dark mode setup (class-based switching)

#### Utility Functions
- [ ] Create `utils/formatting.ts`:
  - [ ] Token preview formatter (show first 10 chars)
  - [ ] Date formatter (relative and absolute)
  - [ ] File size formatter
- [ ] Create `utils/validation.ts`:
  - [ ] Email validator
  - [ ] Password strength checker
  - [ ] Token naming validator
- [ ] Create `utils/storage.ts`:
  - [ ] localStorage helpers
  - [ ] sessionStorage helpers
- [ ] Create `utils/security.ts`:
  - [ ] Token masking function
  - [ ] Safe logging utilities

### Week 1: Base Component Library (10 components)

- [ ] **Button Component**
  - [ ] Variants: primary, secondary, tertiary, danger
  - [ ] Sizes: sm, md, lg
  - [ ] States: default, hover, active, disabled, loading
  - [ ] Props: variant, size, disabled, isLoading, onClick
  - [ ] Accessibility: aria-label, focus visible, keyboard support

- [ ] **Input Component**
  - [ ] Types: text, email, password, number, url
  - [ ] Props: label, placeholder, helperText, error, disabled, required
  - [ ] States: default, focus, error, disabled
  - [ ] Icons: leftIcon, rightIcon
  - [ ] Accessibility: label association, error linking, focus

- [ ] **Select / Dropdown Component**
  - [ ] Basic select functionality
  - [ ] Props: label, value, options, onChange, disabled, error
  - [ ] Multiple selection (optional for phase 1)
  - [ ] Keyboard navigation (↑/↓, Enter, Esc)
  - [ ] Accessibility: aria-expanded, aria-controls

- [ ] **Card Component**
  - [ ] Variants: default, elevated, outlined
  - [ ] Slots: header, body, footer
  - [ ] Props: variant, hover, padding, clickable
  - [ ] Responsive: Works on mobile, tablet, desktop

- [ ] **Modal / Dialog Component**
  - [ ] Show/hide functionality
  - [ ] Props: isOpen, onClose, title, children
  - [ ] Focus trap (keep focus inside modal)
  - [ ] Close on Esc key
  - [ ] Accessibility: role="dialog", aria-labelledby

- [ ] **Badge Component**
  - [ ] Variants: default, success, warning, error, info
  - [ ] Sizes: sm, md
  - [ ] Props: variant, onRemove (optional)
  - [ ] Icon support

- [ ] **Avatar Component**
  - [ ] Image mode (src + alt)
  - [ ] Initials mode (text + bg color)
  - [ ] Sizes: xs, sm, md, lg, xl
  - [ ] Status indicator (online, offline, idle)

- [ ] **Alert Component**
  - [ ] Variants: success, error, warning, info
  - [ ] Props: variant, title, message, closable, onClose
  - [ ] Icon display
  - [ ] Accessibility: role="alert"

- [ ] **Toast / Notification Component**
  - [ ] Variants: success, error, warning, info
  - [ ] Auto-dismiss capability
  - [ ] Action button support
  - [ ] Position: bottom-right corner
  - [ ] Stack multiple toasts

- [ ] **Spinner / Loading Component**
  - [ ] Animated spinner
  - [ ] Text content support
  - [ ] Size variants

- [ ] **Skeleton Loader Component**
  - [ ] Variants: text, circle, rect
  - [ ] Pulsing animation
  - [ ] Custom dimensions

### Week 2: Layout Components & Storybook

#### Layout Components
- [ ] **Icon Component / Icon System**
  - [ ] Import Heroicons (or similar)
  - [ ] Create Icon wrapper component
  - [ ] Size variants
  - [ ] Color support

- [ ] **Header Component**
  - [ ] Logo/app name
  - [ ] Theme toggle
  - [ ] Notification bell (placeholder)
  - [ ] Profile menu
  - [ ] Responsive (hide/show elements)
  - [ ] Fixed position at top

- [ ] **Sidebar Component**
  - [ ] Navigation items
  - [ ] Active state indicator
  - [ ] Fixed width on desktop (256px)
  - [ ] Responsive (hidden on mobile, drawer option)
  - [ ] Smooth expand/collapse

- [ ] **Layout Wrapper Component**
  - [ ] Combines Header + Sidebar + Main content
  - [ ] Responsive layout
  - [ ] Dark mode support

#### Storybook & Documentation
- [ ] Storybook setup and running
- [ ] Create stories for all 11 components
- [ ] Document variants and props
- [ ] Add accessibility notes
- [ ] Add usage examples
- [ ] Deploy Storybook to static host

---

## Phase 2: Authentication & Core Navigation (Weeks 3-4)

### Week 3: Authentication System

#### API & State Setup
- [ ] Create API client (`src/api/client.ts`)
  - [ ] Axios instance with base URL
  - [ ] Auth interceptor (add Bearer token)
  - [ ] Error interceptor (handle 401, etc.)
  - [ ] Base response type

- [ ] Create Zustand auth store (`src/stores/authStore.ts`)
  - [ ] State: user, sessionToken, isAuthenticated, isLoading
  - [ ] Actions: login, loginWithOAuth, logout, setUser, setError
  - [ ] Persist token to sessionStorage

- [ ] Create API functions (`src/api/auth.ts`)
  - [ ] loginWithOAuth(provider)
  - [ ] exchangeAuthCode(code)
  - [ ] logout()
  - [ ] refreshToken()

#### Authentication UI
- [ ] Design and build Login page
  - [ ] Logo/branding
  - [ ] OAuth buttons (Google, GitHub, Facebook)
  - [ ] Social login icons
  - [ ] Loading states
  - [ ] Error display
  - [ ] Responsive design

- [ ] Implement OAuth redirect handler
  - [ ] Capture auth code from URL
  - [ ] Exchange code for token
  - [ ] Store token securely (sessionStorage)
  - [ ] Redirect to onboarding or dashboard

- [ ] Create protected route wrapper
  - [ ] Check authentication state
  - [ ] Redirect to login if not authenticated
  - [ ] Show loading while checking

#### Error Handling
- [ ] Toast notification system
  - [ ] useNotification hook
  - [ ] Add/remove notifications
  - [ ] Auto-dismiss timers
  - [ ] Persistent vs. dismissible

- [ ] Error display component
  - [ ] Top-of-page alerts
  - [ ] Field-level error messages
  - [ ] Modal for critical errors

### Week 3: Tab Navigation & Routing

- [ ] React Router setup
  - [ ] Route structure planning
  - [ ] Dynamic route configuration
  - [ ] Nested routes for tabs

- [ ] Tab navigation component
  - [ ] 6 tabs: Services, Tokens, Personas, Identity, KB, Settings
  - [ ] URL-based tab state (/dashboard/services, etc.)
  - [ ] Active tab highlighting
  - [ ] Keyboard navigation

- [ ] Breadcrumb component (optional for phase 2)
  - [ ] Display current location
  - [ ] Clickable breadcrumbs
  - [ ] Mobile-friendly display

### Week 4: Navigation & Layout

#### Dashboard Layout Implementation
- [ ] Main dashboard page
  - [ ] Combines Header + Sidebar + Tab navigation + Main content
  - [ ] Responsive layout (mobile drawer, desktop fixed)
  - [ ] Theme toggle in header (light/dark)

- [ ] Responsive Sidebar
  - [ ] Desktop: Fixed 256px sidebar
  - [ ] Tablet: Collapsible sidebar (toggle button)
  - [ ] Mobile: Hidden, accessible via hamburger menu drawer
  - [ ] Smooth transitions
  - [ ] Navigation items with icons

- [ ] Mobile Navigation Drawer
  - [ ] Hamburger menu button
  - [ ] Slide-in drawer from left
  - [ ] Overlay/scrim on main content
  - [ ] Close on nav item click or scrim click
  - [ ] Smooth animation

#### Theme Toggle
- [ ] Dark mode detection (prefers-color-scheme)
- [ ] Manual toggle button in header
- [ ] Persist preference to localStorage + user profile
- [ ] Apply dark: prefix classes from Tailwind
- [ ] Smooth color transition (no flash)

#### Keyboard Shortcuts System
- [ ] `?` → Show keyboard shortcuts modal
- [ ] `Cmd+K` or `Ctrl+K` → Open command palette (future feature)
- [ ] `Esc` → Close modals/dropdowns
- [ ] Tab → Navigate to next element
- [ ] Shift+Tab → Navigate to previous element

### Week 4: First-Time Onboarding

- [ ] Onboarding flow
  - [ ] Step 1: Profile setup (USER.md basic fields)
  - [ ] Step 2: Persona setup (SOUL.md basic fields)
  - [ ] Success screen with tips

- [ ] Profile setup form
  - [ ] Fields: name, email, location, timezone
  - [ ] Validation and error display
  - [ ] Form submission

- [ ] Persona setup form
  - [ ] Fields: name, emoji, vibe, core principles
  - [ ] SOUL.md upload/paste option
  - [ ] Form submission

- [ ] Success screen
  - [ ] Celebrate setup completion
  - [ ] Explain next steps
  - [ ] "Go to Dashboard" button

#### Testing Phase 2
- [ ] Users can log in via OAuth
- [ ] Protected routes work
- [ ] Users redirected to onboarding
- [ ] Sidebar responsive on all devices
- [ ] Tab navigation works
- [ ] Dark mode toggle works
- [ ] Layout responsive at 3 breakpoints

---

## Phase 3: Services / Connectors Tab (Weeks 5-6)

### Week 5: Services Components

#### Components to Build
- [ ] **ServiceCard Component**
  - [ ] Props: service (id, name, icon, description, isConnected, etc.)
  - [ ] Display: icon, name, status badge, last synced, scopes
  - [ ] Actions: connect button, revoke button
  - [ ] Hover effect: elevated shadow
  - [ ] Responsive: 3 cols desktop, 2 cols tablet, 1 col mobile

- [ ] **ServiceStatusBadge Component**
  - [ ] Status: connected (green), disconnected (gray), pending (amber)
  - [ ] Last synced timestamp
  - [ ] Icon + text display

- [ ] **ServicesList Component**
  - [ ] Grid/list of ServiceCards
  - [ ] Filter by connection status
  - [ ] Responsive grid layout
  - [ ] Empty state when no services

- [ ] **OAuthFlowModal Component**
  - [ ] Display service details
  - [ ] Show requested scopes
  - [ ] Authorize button (opens OAuth flow)
  - [ ] Cancel button
  - [ ] Loading state during authorization

#### API Integration
- [ ] Create `src/api/services.ts`
  - [ ] fetchServices() → GET /api/services
  - [ ] getService(id) → GET /api/services/{id}
  - [ ] connectService(id) → POST /api/services/{id}/connect (OAuth)
  - [ ] disconnectService(id) → DELETE /api/services/{id}

- [ ] Create custom hooks
  - [ ] useServicesQuery() → React Query hook
  - [ ] useServiceQuery(id) → React Query hook
  - [ ] useConnectServiceMutation() → React Query mutation
  - [ ] useDisconnectServiceMutation() → React Query mutation

- [ ] WebSocket / Real-time updates
  - [ ] Listen for 'service_connected' event
  - [ ] Listen for 'service_disconnected' event
  - [ ] Invalidate queries on update
  - [ ] Show toast notification

### Week 5-6: Services Features

- [ ] Services Tab page
  - [ ] Display all available services (Google, GitHub, Slack, Discord, WhatsApp, etc.)
  - [ ] Fetch and display service list
  - [ ] Show connection status for each
  - [ ] Responsive grid layout

- [ ] Connect Service Flow
  - [ ] Click connect button → Open OAuthFlowModal
  - [ ] User authorizes → Redirect to OAuth provider
  - [ ] Redirect back with auth code
  - [ ] Exchange code for token
  - [ ] Update UI (status badge, revoke button, etc.)
  - [ ] Show success toast: "GitHub connected!"

- [ ] Disconnect Service Flow
  - [ ] Click revoke button → Confirmation modal
  - [ ] User confirms → Send DELETE request
  - [ ] Update UI (back to disconnected state)
  - [ ] Show success toast: "GitHub disconnected"

- [ ] Loading States
  - [ ] Show skeleton loaders while fetching services
  - [ ] Show spinner while connecting service
  - [ ] Disable connect button while in progress

- [ ] Error Handling
  - [ ] OAuth timeout error
  - [ ] Network error
  - [ ] Server error
  - [ ] Show user-friendly error message + retry option

- [ ] Empty State
  - [ ] When no services connected: Show helpful message
  - [ ] Call-to-action: "Connect your first service"

#### Testing Phase 3
- [ ] Services list displays correctly
- [ ] Can connect to service via OAuth
- [ ] Real-time update after connection
- [ ] Can disconnect/revoke service
- [ ] Error states handled gracefully
- [ ] Responsive layout on all devices
- [ ] Accessibility: keyboard navigation, screen reader

---

## Phase 4: Tokens Vault Tab (Weeks 7-8) → **MVP CHECKPOINT**

### Week 7: Token Components

#### Components to Build
- [ ] **TokenCard Component**
  - [ ] Display: name, preview (first 10 chars), creation date, expiration date
  - [ ] Scopes: badge list
  - [ ] Usage: last accessed, request count
  - [ ] Actions: copy, edit, duplicate, revoke
  - [ ] Hover effects

- [ ] **TokenCardMaster Component**
  - [ ] Special styling for master token
  - [ ] Display: masked token (••••••••••••••••)
  - [ ] Actions: reveal button, copy button, revoke button
  - [ ] Warning: "This is your master token"

- [ ] **TokenList Component**
  - [ ] Display list of token cards
  - [ ] Master token at top
  - [ ] Guest tokens below
  - [ ] Search/filter functionality
  - [ ] Sort by date, name, usage
  - [ ] Responsive layout

- [ ] **TokenCreateForm Component**
  - [ ] Step 1: Basic info (name, expiration, description)
  - [ ] Step 2: Scopes (multi-select checkboxes)
  - [ ] Step 3: Review & create
  - [ ] Form validation
  - [ ] Submit button

- [ ] **ScopeSelector Component**
  - [ ] Grouped checkboxes (by category)
  - [ ] Each scope with description
  - [ ] Select all / Clear all per category
  - [ ] Search to filter scopes
  - [ ] Required validation (at least 1 scope)

- [ ] **TokenRevealButton Component**
  - [ ] Shows masked token by default
  - [ ] Click to reveal for 30 seconds
  - [ ] Auto-hide after timeout
  - [ ] Warning: "Copy this token now"

- [ ] **TokenCopyButton Component**
  - [ ] Copy token to clipboard
  - [ ] Show "Copied!" toast
  - [ ] Only enabled after reveal (for master token)

#### API Integration
- [ ] Create `src/api/tokens.ts`
  - [ ] fetchTokens() → GET /api/tokens
  - [ ] getToken(id) → GET /api/tokens/{id}
  - [ ] createToken(data) → POST /api/tokens
  - [ ] revokeToken(id) → DELETE /api/tokens/{id}
  - [ ] updateToken(id, data) → PUT /api/tokens/{id}
  - [ ] duplicateToken(id) → POST /api/tokens/{id}/duplicate

- [ ] Create custom hooks
  - [ ] useTokensQuery()
  - [ ] useTokenQuery(id)
  - [ ] useCreateTokenMutation()
  - [ ] useRevokeTokenMutation()
  - [ ] useUpdateTokenMutation()

### Week 8: Tokens Features

- [ ] Tokens Tab page
  - [ ] Display master token
  - [ ] Display list of guest tokens
  - [ ] "Create New Token" button

- [ ] Master Token Display
  - [ ] Show masked token (••••••••••••••)
  - [ ] Creation date, never expires
  - [ ] Request count for this month
  - [ ] [Reveal] button → Show full token
  - [ ] [Copy] button → Copy to clipboard
  - [ ] [Revoke] button → Revoke token

- [ ] Token Creation Flow
  - [ ] Click "Create New Token" → Open modal
  - [ ] Step 1: Enter token name, select expiration
  - [ ] Step 2: Select scopes (required)
  - [ ] Step 3: Review and create
  - [ ] Success: Show token in modal
  - [ ] Warning: "This is the last time you'll see this"
  - [ ] Buttons: [Copy] [Download] [Done]

- [ ] Guest Token Display
  - [ ] Each token card shows:
    - [ ] Name
    - [ ] Preview (first 10 chars)
    - [ ] Creation date
    - [ ] Expiration date
    - [ ] Scopes (badge list)
    - [ ] Last accessed time
    - [ ] Request count
  - [ ] Actions: [Copy] [Edit] [Duplicate] [Revoke]

- [ ] Revoke Token Flow
  - [ ] Click [Revoke] → Confirmation modal
  - [ ] Show token name and warning
  - [ ] User confirms → Send DELETE request
  - [ ] Remove from list
  - [ ] Show success toast

- [ ] Edit Token Scopes
  - [ ] Click [Edit] → Modal with scope selector
  - [ ] Update scopes
  - [ ] Save changes
  - [ ] Update UI

- [ ] Duplicate Token
  - [ ] Click [Duplicate] → Create new token with same scopes
  - [ ] Auto-copy to clipboard
  - [ ] Show success toast

- [ ] Search & Filter
  - [ ] Filter tokens by name
  - [ ] Sort by date, name, last used
  - [ ] Real-time filtering

#### Testing Phase 4
- [ ] Master token displays masked
- [ ] Reveal button shows full token
- [ ] Copy button works (toast shows)
- [ ] Can create new guest token
- [ ] Token creation form validates
- [ ] Scopes selector works
- [ ] Token list displays correctly
- [ ] Can revoke tokens
- [ ] Can edit token scopes
- [ ] Can duplicate tokens
- [ ] Search/filter works
- [ ] Real-time updates
- [ ] Error handling
- [ ] Responsive on all devices

**✅ MVP CHECKPOINT**: Services + Tokens fully functional = Core dashboard working

---

## Phase 5: Personas Tab (Weeks 9-10)

### Week 9: Persona Components

- [ ] **PersonaCard Component**
  - [ ] Display: emoji, name, vibe, traits (preview)
  - [ ] Status: active indicator
  - [ ] Actions: preview, edit, set active, delete, duplicate
  - [ ] Responsive

- [ ] **PersonaList Component**
  - [ ] Grid of PersonaCards
  - [ ] Active persona highlighted
  - [ ] Responsive grid layout

- [ ] **PersonaCreateForm Component**
  - [ ] Fields: name, emoji, vibe, principles, boundaries
  - [ ] SOUL.md upload/paste option
  - [ ] Form validation
  - [ ] Preview of assembled context

- [ ] **PersonaPreviewModal Component**
  - [ ] Display: emoji, name, vibe, status
  - [ ] Show: principles, boundaries, voice protocol
  - [ ] Actions: [Close] [Edit SOUL]

- [ ] **PersonaSwitch Component**
  - [ ] Dropdown in header
  - [ ] List of personas
  - [ ] Current persona highlighted
  - [ ] Click to switch

#### API Integration
- [ ] Create `src/api/personas.ts`
  - [ ] fetchPersonas() → GET /api/personas
  - [ ] getPersona(id) → GET /api/personas/{id}
  - [ ] createPersona(data) → POST /api/personas
  - [ ] updatePersona(id, data) → PUT /api/personas/{id}
  - [ ] deletePersona(id) → DELETE /api/personas/{id}
  - [ ] setActivePersona(id) → PUT /api/personas/{id}/activate

- [ ] Create Zustand persona store
  - [ ] State: activePersona, personas list
  - [ ] Actions: switchPersona, addPersona, updatePersona, deletePersona

- [ ] Create custom hooks
  - [ ] usePersonasQuery()
  - [ ] usePersonaQuery(id)
  - [ ] useCreatePersonaMutation()
  - [ ] useUpdatePersonaMutation()
  - [ ] useDeletePersonaMutation()

### Week 9-10: Personas Features

- [ ] Personas Tab page
  - [ ] Display current active persona
  - [ ] List of all personas
  - [ ] "Create New Persona" button

- [ ] Persona Creation Flow
  - [ ] Click "Create Persona" → Open modal
  - [ ] Form fields: name, emoji, vibe, principles, boundaries
  - [ ] SOUL.md upload or paste YAML
  - [ ] Validation
  - [ ] Submit → Create persona
  - [ ] Success toast

- [ ] Persona List Display
  - [ ] Grid of persona cards (2-3 per row responsive)
  - [ ] Each shows: emoji, name, vibe, active status
  - [ ] Traits preview
  - [ ] Actions: preview, set active, edit, duplicate, delete

- [ ] Switch Persona
  - [ ] Click persona or use dropdown → Switch active
  - [ ] Update Zustand store
  - [ ] Update header display
  - [ ] Show success toast

- [ ] Persona Preview Modal
  - [ ] Display persona details
  - [ ] Show all fields (emoji, name, vibe, principles, boundaries)
  - [ ] Read-only preview
  - [ ] [Close] [Edit SOUL] buttons

- [ ] Edit Persona
  - [ ] Click [Edit] → Open form modal with current data
  - [ ] Edit fields
  - [ ] Save changes
  - [ ] Update list

- [ ] Delete Persona
  - [ ] Click [Delete] → Confirmation modal
  - [ ] Show persona name
  - [ ] User confirms → Delete
  - [ ] Remove from list
  - [ ] Show success toast

#### Testing Phase 5
- [ ] Can create new persona
- [ ] Can switch active persona
- [ ] Can edit persona
- [ ] Can delete persona
- [ ] Can preview persona
- [ ] Persona list displays
- [ ] SOUL.md parsing works
- [ ] Responsive layout
- [ ] Accessibility

---

## Phase 6: Identity Tab (Weeks 11-12)

### Week 11: Identity Components

- [ ] **IdentitySplitView Component**
  - [ ] Desktop: Side-by-side (USER.md | SOUL.md)
  - [ ] Mobile: Tabs (User Profile | AI Persona)
  - [ ] Responsive layout

- [ ] **UserProfileEditor Component**
  - [ ] Form for USER.md fields
  - [ ] Sections: Basic info, Professional, Personal, Contact preferences
  - [ ] Form validation
  - [ ] Save button
  - [ ] Draft auto-save to localStorage

- [ ] **MarkdownEditor Component**
  - [ ] Code editor with syntax highlighting
  - [ ] Live preview (split view or tabs)
  - [ ] Toolbar: Bold, Italic, Heading, Code, List buttons
  - [ ] Line numbers
  - [ ] Character count
  - [ ] Undo/Redo support
  - [ ] Keyboard shortcuts (Ctrl+B for bold, etc.)

- [ ] **SoulEditor Component**
  - [ ] Uses MarkdownEditor
  - [ ] SOUL.md format
  - [ ] Auto-save to localStorage

- [ ] **ContextPreview Component**
  - [ ] Display assembled context (USER.md + SOUL.md combined)
  - [ ] Read-only view
  - [ ] Syntax highlighting
  - [ ] Copy full context button

#### API Integration
- [ ] Create `src/api/identity.ts`
  - [ ] fetchIdentity() → GET /api/identity (returns USER.md + SOUL.md)
  - [ ] updateIdentity(data) → PUT /api/identity

- [ ] Create custom hooks
  - [ ] useIdentityQuery()
  - [ ] useUpdateIdentityMutation()

### Week 12: Identity Features

- [ ] Identity Tab page
  - [ ] Split view layout (desktop) or tabs (mobile)
  - [ ] Left: USER.md editor
  - [ ] Right: SOUL.md editor
  - [ ] Context preview

- [ ] User Profile Editor
  - [ ] Basic Information:
    - [ ] Name (required)
    - [ ] Email (required)
    - [ ] Location
    - [ ] Timezone
    - [ ] Website
  - [ ] Professional Information:
    - [ ] Role
    - [ ] Company
    - [ ] Education
    - [ ] Years of experience
  - [ ] Personal Information:
    - [ ] Languages
    - [ ] Interests
    - [ ] Bio
  - [ ] Contact Preferences:
    - [ ] Email notifications toggle
    - [ ] SMS notifications toggle
    - [ ] Marketing emails toggle

- [ ] AI Persona Editor
  - [ ] Core Identity section:
    - [ ] Name
    - [ ] Emoji
    - [ ] Vibe
  - [ ] Fundamental Principles (bullet points)
  - [ ] Boundaries (what you won't do)
  - [ ] Voice Protocol (tone, style, etc.)
  - [ ] Rich markdown editor
  - [ ] Live preview

- [ ] Auto-Save Feature
  - [ ] Save draft to localStorage
  - [ ] Detect unsaved changes
  - [ ] Warning if leaving with unsaved changes
  - [ ] Manual save to backend

- [ ] Context Preview
  - [ ] Show combined USER.md + SOUL.md
  - [ ] Explain how they're combined
  - [ ] Copy assembled context
  - [ ] Use in API calls

#### Testing Phase 6
- [ ] Can edit user profile
- [ ] Can edit persona (SOUL.md)
- [ ] Form validation works
- [ ] Auto-save to localStorage
- [ ] Save to backend
- [ ] Markdown editor works
- [ ] Preview renders correctly
- [ ] Context assembly correct
- [ ] Responsive layout
- [ ] Accessibility

---

## Phase 7: Knowledge Base Tab (Weeks 13-14)

### Week 13: Knowledge Base Components

- [ ] **KBViewer Component**
  - [ ] Display MEMORY.md content
  - [ ] Syntax highlighting for code
  - [ ] Markdown rendering
  - [ ] Responsive layout

- [ ] **KBEditor Component**
  - [ ] MarkdownEditor (like Soul editor)
  - [ ] Edit document
  - [ ] Save changes

- [ ] **DocumentList Component**
  - [ ] List of documents
  - [ ] Metadata: name, size, date created
  - [ ] Search/filter
  - [ ] Sort options
  - [ ] Actions: view, edit, delete

- [ ] **DocumentUpload Component**
  - [ ] Drag & drop zone
  - [ ] File input
  - [ ] Progress bar
  - [ ] File validation
  - [ ] Error display

- [ ] **KBSearch Component**
  - [ ] Search documents by name/content
  - [ ] Real-time filtering
  - [ ] Highlight matches

- [ ] **KBStatistics Component**
  - [ ] Document count
  - [ ] Total size
  - [ ] Last updated

#### API Integration
- [ ] Create `src/api/knowledge-base.ts`
  - [ ] fetchDocuments() → GET /api/knowledge-base
  - [ ] getDocument(id) → GET /api/knowledge-base/{id}
  - [ ] uploadDocument(file, metadata) → POST /api/knowledge-base
  - [ ] updateDocument(id, data) → PUT /api/knowledge-base/{id}
  - [ ] deleteDocument(id) → DELETE /api/knowledge-base/{id}

- [ ] Create custom hooks
  - [ ] useDocumentsQuery()
  - [ ] useDocumentQuery(id)
  - [ ] useUploadDocumentMutation()
  - [ ] useUpdateDocumentMutation()
  - [ ] useDeleteDocumentMutation()

### Week 13-14: Knowledge Base Features

- [ ] Knowledge Base Tab page
  - [ ] Display statistics
  - [ ] List of documents
  - [ ] "Upload Document" button
  - [ ] "New Document" button

- [ ] View Documents
  - [ ] Display document list
  - [ ] Show: name, size, date created
  - [ ] Click to view full content
  - [ ] Syntax highlighting for code blocks

- [ ] Upload Documents
  - [ ] Drag & drop markdown files
  - [ ] File input browse
  - [ ] Progress indicator
  - [ ] File size validation (max 5MB)
  - [ ] File type validation (.md, .txt)
  - [ ] Success toast

- [ ] Edit Documents
  - [ ] Click [Edit] → Open editor
  - [ ] MarkdownEditor with preview
  - [ ] Save button
  - [ ] Cancel button
  - [ ] Auto-save draft

- [ ] Delete Documents
  - [ ] Click [Delete] → Confirmation
  - [ ] User confirms → Delete
  - [ ] Remove from list
  - [ ] Success toast

- [ ] Search & Filter
  - [ ] Search by document name
  - [ ] Filter by tags (future)
  - [ ] Sort by date, name, size
  - [ ] Real-time filtering

- [ ] Statistics
  - [ ] Total document count
  - [ ] Total size
  - [ ] Last updated date
  - [ ] Storage usage

#### Testing Phase 7
- [ ] Can view documents
- [ ] Can upload documents
- [ ] Can edit documents
- [ ] Can delete documents
- [ ] Can search documents
- [ ] Markdown rendering correct
- [ ] File validation works
- [ ] Statistics display correctly
- [ ] Responsive layout
- [ ] Accessibility

---

## Phase 8: Settings Tab & Polish (Weeks 15-16)

### Week 15: Settings Components & Features

- [ ] **ProfileSettings Component**
  - [ ] Edit name, email, preferences
  - [ ] Form validation
  - [ ] Save button

- [ ] **SecuritySettings Component**
  - [ ] Change password form
  - [ ] 2FA setup (optional for MVP)
  - [ ] Active sessions list
  - [ ] Logout all sessions

- [ ] **PrivacySettings Component**
  - [ ] Data retention policy
  - [ ] Export data button
  - [ ] Privacy notice

- [ ] **DeleteAccountModal Component**
  - [ ] Warning message
  - [ ] Type "DELETE" to confirm
  - [ ] Confirmation checkbox
  - [ ] Danger button

#### Settings Features
- [ ] Settings Tab page
  - [ ] Organize into sections
  - [ ] Account, Security, Privacy, Webhooks, Danger Zone

- [ ] Profile Settings
  - [ ] Edit user information
  - [ ] Save changes
  - [ ] Validation

- [ ] Security Settings
  - [ ] Change password
  - [ ] Validate password strength
  - [ ] Active sessions display
  - [ ] Logout from other sessions

- [ ] Privacy & Data
  - [ ] Data retention options (30d, 90d, 1y, never)
  - [ ] Export data button (JSON format)
  - [ ] Download link with expiration
  - [ ] Privacy policy link

- [ ] Danger Zone
  - [ ] Delete account button
  - [ ] Confirmation modal
  - [ ] Type "DELETE" confirmation
  - [ ] Irreversible warning

### Week 15: Error Handling & Optimization

#### Error Handling
- [ ] **Error Boundary Component**
  - [ ] Catch React errors
  - [ ] Display fallback UI
  - [ ] Log error to Sentry
  - [ ] Retry button

- [ ] Error Pages
  - [ ] 404 Not Found page
  - [ ] 500 Server Error page
  - [ ] Generic error page

- [ ] API Error Handling
  - [ ] 400 Bad Request (validation errors)
  - [ ] 401 Unauthorized (redirect to login)
  - [ ] 403 Forbidden
  - [ ] 404 Not Found
  - [ ] 429 Too Many Requests (rate limit)
  - [ ] 500 Server Error
  - [ ] Network errors

#### Performance Optimization
- [ ] Code Splitting
  - [ ] Lazy load tab routes
  - [ ] Lazy load modals
  - [ ] Lazy load heavy libraries

- [ ] Component Memoization
  - [ ] Wrap expensive components with React.memo
  - [ ] Use useMemo for computations
  - [ ] Use useCallback for event handlers

- [ ] Image Optimization
  - [ ] Serve WebP with fallback
  - [ ] Lazy load user avatars
  - [ ] Optimize SVG icons
  - [ ] Use srcset for responsive images

- [ ] Bundle Analysis
  - [ ] Run webpack-bundle-analyzer
  - [ ] Identify large dependencies
  - [ ] Remove unused code
  - [ ] Tree-shake unused exports

### Week 16: Testing, Accessibility, Polish

#### Comprehensive Testing

**Unit Tests**
- [ ] All utility functions
- [ ] All Zustand store actions
- [ ] All form validations
- [ ] 80%+ coverage achieved

**Component Tests**
- [ ] All base components
- [ ] All feature components
- [ ] Props variations
- [ ] User interactions
- [ ] Error states
- [ ] Loading states

**Integration Tests**
- [ ] Full feature flows
  - [ ] Login → Onboarding → Dashboard
  - [ ] Connect service
  - [ ] Create token → Revoke token
  - [ ] Create persona → Switch persona
  - [ ] Edit identity
  - [ ] Upload document
- [ ] Form submissions with validation
- [ ] API error handling
- [ ] WebSocket updates

**E2E Tests (Playwright/Cypress)**
- [ ] Login flow (OAuth)
- [ ] Service connection flow
- [ ] Token creation flow
- [ ] Persona management
- [ ] Identity editing
- [ ] Knowledge base operations
- [ ] Settings updates
- [ ] Account deletion

**Mobile Testing**
- [ ] All layouts at 375px, 768px, 1024px+
- [ ] Touch interactions
- [ ] Drawer sidebar
- [ ] Form inputs
- [ ] Modals full-screen
- [ ] Responsive images

**Accessibility Audit**
- [ ] Run axe DevTools
- [ ] Run WAVE
- [ ] Run Lighthouse accessibility audit
- [ ] Fix any violations
- [ ] Test keyboard navigation
- [ ] Test screen reader
- [ ] Verify color contrast

#### Polish & Refinement
- [ ] Review all animations
- [ ] Verify smooth transitions
- [ ] Check loading states
- [ ] Verify empty states
- [ ] Check error messages
- [ ] Test dark mode thoroughly
- [ ] Verify responsive layouts
- [ ] Ensure consistent spacing
- [ ] Verify typography rendering
- [ ] Check button states
- [ ] Verify form validation messages

#### Documentation & Deployment
- [ ] Finalize Storybook
- [ ] Create component usage guide
- [ ] Create API integration guide
- [ ] Create user guide
- [ ] Build for production
- [ ] Test production build
- [ ] Set up monitoring (Sentry)
- [ ] Configure analytics
- [ ] Prepare deployment checklist
- [ ] Create release notes

#### Final QA Checklist
- [ ] All features working as designed
- [ ] No broken links
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No accessibility violations
- [ ] Mobile responsive
- [ ] Dark mode working
- [ ] Forms validating
- [ ] Error handling working
- [ ] Loading states showing
- [ ] Empty states showing
- [ ] Animations smooth
- [ ] Performance good (Lighthouse > 90)
- [ ] Bundle size acceptable
- [ ] Security best practices followed

---

## Post-Launch (Future Phases)

### Q3 2026
- [ ] Webhook support
- [ ] Multi-user team support
- [ ] API rate limiting dashboard
- [ ] Audit logs
- [ ] Scheduled actions

### Q4 2026
- [ ] Mobile app (React Native)
- [ ] AI assistant for profile generation
- [ ] Advanced analytics
- [ ] Custom domains
- [ ] API versioning support

### Q1 2027
- [ ] CLI tool
- [ ] Slack bot integration
- [ ] Workflow automation
- [ ] Hardware security key support
- [ ] SSO support

---

## Tracking & Progress

### Weekly Checkin Template
```
Week #: [1-16]
Completed: ✅ [list completed items]
In Progress: 🔄 [list in-progress items]
Blocked: ❌ [list blockers with notes]
Next Week: 📋 [planned work]
Notes: [any relevant notes]
```

### Metrics to Track
- [ ] **Code Quality**
  - [ ] Test coverage %
  - [ ] ESLint errors
  - [ ] TypeScript errors
  - [ ] Code review comments

- [ ] **Performance**
  - [ ] Bundle size (KB gzipped)
  - [ ] Lighthouse score
  - [ ] Page load time (ms)
  - [ ] Component render time (ms)

- [ ] **Accessibility**
  - [ ] axe violations
  - [ ] Color contrast issues
  - [ ] ARIA violations
  - [ ] Keyboard navigation issues

- [ ] **User Experience**
  - [ ] Feature completeness %
  - [ ] Mobile responsive %
  - [ ] Dark mode coverage %
  - [ ] Error handling coverage %

---

## Dependencies & Risks

### Critical Path
1. **OAuth Authentication** (blocks everything)
2. **Dashboard Layout** (blocks tabs)
3. **Services Tab** (first feature)
4. **Tokens Tab** (MVP feature)

### Risk Mitigation
- [ ] Start OAuth early (Week 2-3)
- [ ] Use OAuth libraries (reduce custom code)
- [ ] Mock API early (don't wait for backend)
- [ ] Test mobile early (don't leave for end)
- [ ] Implement accessibility upfront (hard to retrofit)

### Definition of Done (Per Week)
- [ ] Planned features completed
- [ ] Unit tests written (80%+ coverage)
- [ ] Component tests passing
- [ ] Manual testing done
- [ ] Code review approved
- [ ] Accessibility audit passed
- [ ] Mobile responsive verified
- [ ] Documentation updated
- [ ] No console errors/warnings

---

## Success Criteria

### Code Quality
- ✅ 80%+ test coverage
- ✅ TypeScript strict mode
- ✅ Zero ESLint errors
- ✅ WCAG 2.1 AA compliant

### Performance
- ✅ Lighthouse > 90
- ✅ Bundle < 300KB (gzip)
- ✅ FCP < 2s
- ✅ TTI < 3s

### Features
- ✅ All 6 tabs fully functional
- ✅ Login/logout working
- ✅ Real-time updates (or polling)
- ✅ OAuth flows working

### User Experience
- ✅ All interactions per spec
- ✅ Smooth animations
- ✅ Clear error messages
- ✅ Accessible to all users

---

**Print this checklist and track progress daily. Update as you complete items. Check off completed features to see progress!**

---

## End of CHECKLIST_IMPLEMENTATION.md
