# MyApi Dashboard - Design & Architecture Summary

## Quick Reference Guide

### 📋 Document Overview

| Document | Purpose | Audience |
|----------|---------|----------|
| **DESIGN.md** | Visual design system, colors, typography, components | Designers, Frontend devs |
| **UI_ARCHITECTURE.md** | Technical architecture, state management, API integration | Backend devs, Full-stack |
| **COMPONENTS.md** | Component specifications, props, variants, usage | Frontend devs |
| **USER_FLOWS.md** | Wireframes, user journeys, interaction flows | Designers, Product, UX |
| **IMPLEMENTATION_ROADMAP.md** | Timeline, phases, build order, checklist | Project managers, Leads |
| **DESIGN_SUMMARY.md** (this file) | Quick reference, key decisions, decision matrix | Everyone |

---

## Key Design Decisions

### 1. Color Palette: Blue-Centric Design
**Decision**: Use blue (`#3B82F6`) as primary color
**Why**:
- Professional, trustworthy appearance
- Accessible contrast ratios (4.5:1+ on white)
- Works well in both light and dark modes
- Industry standard for SaaS dashboards

**Semantic Colors**:
- Green (`#10B981`): Success, connected
- Amber (`#F59E0B`): Warning, pending
- Red (`#EF4444`): Error, destructive
- Indigo (`#6366F1`): Info

---

### 2. Desktop-First, Mobile-Optimized Layout
**Decision**: Design for desktop primarily, optimize for mobile
**Why**:
- Target users are likely on desktop (API management)
- More complex interface needs larger screens
- Mobile-first would oversimplify features

**Breakpoints**:
- Desktop: 1024px+ (3-column grid, fixed sidebar)
- Tablet: 640-1024px (2-column grid, collapsible sidebar)
- Mobile: <640px (1-column, drawer sidebar)

---

### 3. Single-User with Multi-Persona Support
**Decision**: Not multi-user initially, but multiple AI personas per user
**Why**:
- Simplifies authentication and permissions
- Focus on personal API/AI management
- Personas serve as "persona switching" use case
- Future-proof for team features if needed

---

### 4. Real-Time Updates with Polling Fallback
**Decision**: Use WebSocket for real-time, fallback to polling
**Why**:
- Best UX (instant updates when services connect)
- Gracefully degrades if WebSocket unavailable
- No complexity for MVP
- Polling fallback uses standard staleTime/refetchInterval

**Update Events**:
```typescript
'service_connected' | 'service_disconnected' |
'token_revoked' | 'persona_created' | 'persona_updated' |
'identity_updated' | 'kb_document_added'
```

---

### 5. Dark Mode: System Preference + Manual Toggle
**Decision**: Support dark mode, detect system preference, allow manual toggle
**Why**:
- Modern UX expectation
- Reduces eye strain for night users
- Easy to implement with Tailwind CSS
- Store preference in localStorage + user profile

---

### 6. Token Security: Masked with Reveal Option
**Decision**: Show masked tokens by default, reveal with explicit action
**Why**:
- Prevents accidental exposure
- Follows OAuth token best practices
- "Reveal" button creates intentional exposure
- Auto-hide after 30 seconds

**Implementation**:
- Master token: Show last 4 chars only, [Reveal] button
- Guest tokens: Show first 10 chars only
- Copy button: Copy full token, show "Copied!" toast

---

### 7. Form Validation: Client + Server
**Decision**: Zod for client-side, server validates again
**Why**:
- Instant feedback to users
- Type safety with TypeScript
- Server acts as security boundary
- Better UX than server-only validation

**Libraries**:
- React Hook Form (form state)
- Zod (validation schema)
- Inline error display
- Form-level error alerts

---

### 8. State Management: Zustand (Global) + React Query (Server)
**Decision**: Use Zustand for auth/UI state, React Query for server state
**Why**:
- Zustand: Lightweight, TypeScript-friendly, minimal boilerplate
- React Query: Industry standard for server state, automatic caching
- Clear separation of concerns
- Easier to test and debug

**Zustand Stores**:
- `authStore`: User, session token, auth state
- `uiStore`: Theme, modals, notifications, sidebar
- `personaStore`: Active persona, personas list

**React Query Hooks**:
- Services, tokens, personas, identity, knowledge base
- Automatic caching, deduplication, background sync

---

### 9. Component Architecture: Headless UI + Tailwind
**Decision**: Use Radix UI / Headless UI for components + Tailwind for styling
**Why**:
- Built-in accessibility
- Unstyled, fully customizable
- Smaller bundle than Material-UI or Chakra
- Tailwind utility classes provide consistency

---

### 10. Routing: React Router v6 URL-Based Tab State
**Decision**: Use URL to track active tab, not just component state
**Why**:
- Bookmarkable tab states
- Back button works correctly
- Shareable links
- Better for analytics

**Structure**:
```
/dashboard/services
/dashboard/tokens
/dashboard/personas
/dashboard/identity
/dashboard/knowledge-base
/dashboard/settings
```

---

## Authentication Flow Decision

**OAuth First** (Google, GitHub, Facebook)
- Modern UX, users trust OAuth
- Reduces friction (no password to remember)
- Secure by design

**Session Management**:
- Session token: `sessionStorage` (cleared on tab close)
- Refresh token: HTTP-only cookie (set by backend)
- Auto-logout on 401 response

---

## Error Handling Strategy

### 4-Tier Approach
1. **Field-Level**: Show inline errors below input
2. **Form-Level**: Show validation summary at top
3. **Toast Notifications**: Quick success/error messages
4. **Modal Dialogs**: Critical errors, server down, etc.

### Error Display Principles
- Color + icon + text (never just color)
- Include actionable message
- Provide retry or help link
- Log to Sentry for monitoring

---

## Responsive Design Strategy

### Mobile-First Components
- Touch targets: 44x44px minimum
- Full-width buttons on mobile
- Stacked layouts
- Drawer for sidebar (not collapse)

### Tablet Optimizations
- 2-column layouts
- Smaller touch targets (40x40px)
- Collapsible sidebar
- Readable line length

### Desktop Enhancements
- 3-column grids
- Fixed sidebar
- Hover states
- Keyboard shortcuts

---

## Accessibility Compliance: WCAG 2.1 AA

### Required for All Components
- [ ] Semantic HTML (button, input, form, nav, etc.)
- [ ] ARIA labels on icons: `aria-label="Toggle theme"`
- [ ] Form labels associated: `<label htmlFor="email">`
- [ ] Color contrast: 4.5:1 for normal text, 3:1 for large
- [ ] Focus indicators: Always visible, 3px blue ring
- [ ] Keyboard navigation: Tab, Enter, Esc, arrows

### Live Regions
- Alerts: `role="alert"` + `aria-live="assertive"`
- Status updates: `role="status"` + `aria-live="polite"`
- Toasts: `role="status"` + `aria-live="polite"`

### Testing Tools
- axe DevTools (browser extension)
- jest-axe (automated)
- WAVE (web accessibility checker)
- Keyboard-only navigation test

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                        User Actions                       │
│           (Click button, type in form, etc.)             │
└────────────────────────┬─────────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │ Components│
                    └────┬──────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼──────┐  ┌────▼──────┐  ┌────▼──────┐
    │ Zustand   │  │ React     │  │ Event     │
    │ Store     │  │ Query     │  │ Handler   │
    │(UI, Auth) │  │(Server)   │  │(Form)     │
    └────┬──────┘  └────┬──────┘  └────┬──────┘
         │              │              │
         │         ┌────▼──────────┐   │
         └────────▶│ API Client    │◀──┘
                   │ (Axios)       │
                   └────┬──────────┘
                        │
                   ┌────▼──────────┐
                   │ Backend API   │
                   │ (Node.js)     │
                   └───────────────┘
                        │
                   ┌────▼──────────┐
                   │ Database      │
                   │ (PostgreSQL)  │
                   └───────────────┘
```

---

## File Structure Best Practices

```
✅ DO:
- Keep components small and focused
- One component per file (or tightly coupled pair)
- Use index.ts for directory exports
- Group related utils in subdirectories
- Use .tsx for components, .ts for utilities

❌ DON'T:
- Have multiple unrelated components in one file
- Export everything from index.ts (explicit is better)
- Mix business logic with component logic
- Name files with uppercase if they're not components
```

---

## Naming Conventions

### Components
```typescript
// File: src/components/common/Button.tsx
export interface ButtonProps { ... }
export const Button = React.memo(({ ... }) => { ... });
```

### Hooks
```typescript
// File: src/hooks/useAuth.ts
export function useAuth() { ... }
export function useTokens() { ... }
```

### Stores (Zustand)
```typescript
// File: src/stores/authStore.ts
export const useAuthStore = create<AuthStore>((set) => ({ ... }));
```

### API Functions
```typescript
// File: src/api/services.ts
export async function fetchServices() { ... }
export async function connectService(serviceId) { ... }
```

### Types
```typescript
// File: src/types/service.ts
export interface Service { ... }
export type ServiceStatus = 'connected' | 'disconnected';
```

---

## CSS/Styling Guidelines

### Tailwind Utility First
```jsx
// ✅ DO: Use Tailwind utilities
<div className="bg-blue-500 text-white px-4 py-2 rounded-lg">
  Button
</div>

// ❌ DON'T: Use inline styles
<div style={{ backgroundColor: 'blue', color: 'white' }}>
  Button
</div>

// ❌ DON'T: Custom CSS when Tailwind exists
<style>
  .button { background-color: blue; }
</style>
<button className="button">Button</button>
```

### CSS Modules for Scoped Styles
```typescript
// Button.module.css
.buttonWrapper {
  display: flex;
  gap: 0.5rem;
}

// Button.tsx
import styles from './Button.module.css';
<div className={styles.buttonWrapper}>...</div>
```

### Dark Mode with Tailwind
```jsx
// ✅ Tailwind dark: prefix
<div className="bg-white dark:bg-slate-900 text-black dark:text-white">
  Content
</div>

// Dark mode enabled in tailwind.config.js
// Set via class on document root: document.documentElement.classList.add('dark')
```

---

## Type Safety Best Practices

```typescript
// ✅ DO: Strict prop interfaces
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

// ✅ DO: Use discriminated unions for complex props
type ModalProps = 
  | { type: 'confirm'; onConfirm: () => void }
  | { type: 'alert'; onClose: () => void };

// ❌ DON'T: Use 'any' type
const Component: React.FC<any> = (props) => { ... };

// ❌ DON'T: Use overly permissive prop types
interface Props {
  config?: Record<string, any>;
}
```

---

## Performance Optimization Checklist

### Rendering
- [ ] Use React.memo() for expensive components
- [ ] Use useMemo() for expensive calculations
- [ ] Use useCallback() for event handlers passed to children
- [ ] Avoid creating objects/arrays in render

### Bundling
- [ ] Code split routes with React.lazy()
- [ ] Lazy load heavy libraries (editors, charts)
- [ ] Tree-shake unused code (`sideEffects: false`)
- [ ] Monitor bundle size with webpack-bundle-analyzer

### Network
- [ ] Gzip response compression
- [ ] HTTP/2 Server Push for critical assets
- [ ] Cache-Control headers for static assets
- [ ] GraphQL instead of REST (future optimization)

### Images
- [ ] Serve WebP format (with JPEG fallback)
- [ ] Lazy load off-screen images
- [ ] Optimize SVGs (remove unnecessary attributes)
- [ ] Use srcset for responsive images

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run full test suite
- [ ] Run accessibility audit
- [ ] Run Lighthouse
- [ ] Build for production
- [ ] Test production build locally
- [ ] Verify environment variables
- [ ] Run security scan (npm audit)

### Deployment
- [ ] Deploy to staging environment first
- [ ] Run smoke tests on staging
- [ ] Get approval from product
- [ ] Deploy to production
- [ ] Verify all features working
- [ ] Monitor error logs (Sentry)
- [ ] Monitor analytics

### Post-Deployment
- [ ] Share release notes
- [ ] Update documentation
- [ ] Monitor performance metrics
- [ ] Be ready for rollback if needed

---

## Security Considerations

### Token Handling
- Never log tokens
- Never include in URLs
- Store in sessionStorage only (not localStorage)
- Use HTTP-only cookies for refresh tokens
- Refresh tokens automatically before expiry

### Form Submission
- Validate on client (UX) AND server (security)
- Use HTTPS only
- CSRF token for state-changing requests
- Rate limit login attempts

### API Communication
- Use Authorization header: `Bearer {token}`
- Never send sensitive data in query params
- Use HTTPS everywhere
- Implement CORS properly
- Validate all server responses

### User Data
- No console.log() of sensitive data in production
- Encrypt sensitive fields at rest
- Implement audit logging
- Export data securely (encrypted downloads)
- Honor privacy preferences

---

## Monitoring & Analytics

### Error Tracking (Sentry)
```typescript
import * as Sentry from '@sentry/react';

// Capture exceptions
try {
  await connectService(serviceId);
} catch (error) {
  Sentry.captureException(error);
}

// Set user context
Sentry.setUser({ id: userId, email: userEmail });
```

### Performance Monitoring
```typescript
// Measure custom metrics
const start = performance.now();
await fetchData();
const duration = performance.now() - start;
analytics.trackTiming('fetch_data', duration);
```

### User Analytics
```typescript
// Track user actions
analytics.track('service_connected', {
  serviceId: 'github',
  duration: timeToConnect,
});
```

---

## Browser Compatibility

**Minimum Supported Versions**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Features to Polyfill**:
- Promise (if supporting older browsers)
- Fetch API
- ResizeObserver
- IntersectionObserver

---

## Development Tips

### Hot Reload
Use Vite for instant HMR:
```bash
npm run dev
```

### Storybook Development
```bash
npm run storybook
# View components in isolation
# Test component variants
# Build component documentation
```

### Debugging
```typescript
// React DevTools extension
// Vue DevTools for Zustand (Redux DevTools)
// Network tab for API calls
// Console for errors
// React Profiler for performance
```

### Git Workflow
```bash
# Feature branch
git checkout -b feature/services-tab

# Commit with atomic, descriptive messages
git commit -m "feat: implement service connect flow"

# Push and create PR
git push origin feature/services-tab

# After review, merge to main
git merge --squash feature/services-tab
```

---

## Handoff to Development

### Before Starting
1. Read this document
2. Read DESIGN.md (understand design system)
3. Read UI_ARCHITECTURE.md (understand tech stack)
4. Read COMPONENTS.md (understand component specs)
5. Read IMPLEMENTATION_ROADMAP.md (understand timeline)

### While Building
1. Follow component specifications exactly
2. Use provided color palette
3. Implement accessibility features upfront (not as afterthought)
4. Write tests as you build
5. Document complex logic with comments

### Questions?
- Unclear component spec? → Check COMPONENTS.md + USER_FLOWS.md
- Unclear architecture? → Check UI_ARCHITECTURE.md
- Unclear timeline? → Check IMPLEMENTATION_ROADMAP.md
- Color/spacing unclear? → Check DESIGN.md

---

## Final Checklist Before Launch

### Features
- [ ] All 6 tabs fully functional
- [ ] Login/logout working
- [ ] Create token flow working
- [ ] Connect service flow working
- [ ] Create persona working
- [ ] Edit identity working
- [ ] Knowledge base CRUD working
- [ ] Settings functional

### Quality
- [ ] 80%+ test coverage
- [ ] No console errors/warnings
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] All components have Storybook stories

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus indicators visible
- [ ] Color contrast > 4.5:1

### Performance
- [ ] Lighthouse score > 90
- [ ] Bundle size < 300KB gzipped
- [ ] First contentful paint < 2s
- [ ] Time to interactive < 3s

### Security
- [ ] Tokens masked by default
- [ ] Sensitive forms use HTTPS
- [ ] No API keys in code
- [ ] Environment variables configured
- [ ] CSRF protection enabled

### Mobile
- [ ] Responsive at 375px, 768px, 1024px+
- [ ] Touch targets 44px+ on mobile
- [ ] Drawer sidebar works
- [ ] All modals full-screen on mobile
- [ ] Forms single-column on mobile

---

## Version Control

**Current Version**: 1.0.0 (MVP)
**Last Updated**: Feb 27, 2026
**Design System Status**: Final
**Architecture Status**: Final
**Implementation Status**: Roadmap defined

---

## End of DESIGN_SUMMARY.md
