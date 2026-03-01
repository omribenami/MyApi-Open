# MyApi Dashboard - Developer Quick Start Guide

## 🚀 5-Minute Onboarding

### What is MyApi Dashboard?
A unified dashboard where non-technical users can manage OAuth services, API tokens, AI personas, and personal knowledge bases.

### Key Stats
- **6 Main Tabs**: Services, Tokens, Personas, Identity, Knowledge Base, Settings
- **~35 Components**: Reusable UI component library
- **4-Month Timeline**: Weeks 1-16 with clear phases
- **100% Accessible**: WCAG 2.1 AA compliant
- **Mobile-Responsive**: 3-breakpoint design (mobile, tablet, desktop)

### Tech Stack (Recommended)
```
React 18+              // UI framework
Tailwind CSS           // Styling
React Router v6        // Navigation
Zustand               // State management
React Query           // Server state
React Hook Form       // Forms
Zod                   // Validation
Radix UI              // Accessible components
Socket.io             // Real-time updates
Vite                  // Build tool
TypeScript            // Type safety
```

---

## 📚 Documentation Quick Links

| Need | Document | Section |
|------|----------|---------|
| Overview | README_DESIGN.md | Top |
| Colors & Typography | DESIGN.md | Sections 2.1-2.2 |
| Component Specs | COMPONENTS.md | All sections |
| Architecture | UI_ARCHITECTURE.md | Sections 1-5 |
| Wireframes | USER_FLOWS.md | All sections |
| Timeline | IMPLEMENTATION_ROADMAP.md | Phase breakdown |
| Decisions | DESIGN_SUMMARY.md | All sections |

---

## 🎨 Design System Quick Reference

### Colors (Use in Tailwind)
```
Primary:     text-blue-500,   bg-blue-500,   border-blue-500
Success:     text-green-500,  bg-green-500,  border-green-500
Warning:     text-amber-500,  bg-amber-500,  border-amber-500
Error:       text-red-500,    bg-red-500,    border-red-500
Info:        text-indigo-500, bg-indigo-500, border-indigo-500
```

### Spacing (8px grid)
```
2px   → 0.5 × (1/4 grid)
4px   → 1 × (1/2 grid)
8px   → 2 × (1 grid) ← BASE
16px  → 4 × (2 grid)
24px  → 6 × (3 grid)
32px  → 8 × (4 grid)
48px  → 12 × (6 grid)
```

Use: `p-2, p-4, p-8, p-16, gap-4, mb-8`, etc.

### Typography
```
H1: 32px bold      → text-4xl font-bold
H2: 28px bold      → text-3xl font-bold
H3: 24px bold      → text-2xl font-bold
H4: 20px bold      → text-xl font-bold
Body: 16px normal  → text-base
Small: 14px normal → text-sm
Tiny: 12px normal  → text-xs
```

### Border Radius
```
4px   → rounded-sm
8px   → rounded-md
12px  → rounded-lg
Full  → rounded-full
```

### Shadows
```
sm → shadow-sm
md → shadow-md
lg → shadow-lg
```

---

## 🔧 Setup Checklist

### Project Initialization
```bash
# Create Vite project
npm create vite@latest myapi-dashboard -- --template react-ts

# Install dependencies
cd myapi-dashboard
npm install
npm install -D tailwindcss postcss autoprefixer typescript

# Install main packages
npm install react-router-dom zustand @tanstack/react-query axios socket.io-client zod react-hook-form @hookform/resolvers @radix-ui/react-dialog @radix-ui/react-popover

# Dev dependencies
npm install -D @storybook/react @testing-library/react vitest
```

### Configure Tailwind
```bash
npx tailwindcss init -p
```

### Create Project Structure
```
src/
├── components/
│   ├── common/          ← Base components
│   ├── layout/          ← Header, Sidebar, Layout
│   ├── tabs/            ← Tab-specific components
│   ├── services/        ← Services tab
│   ├── tokens/          ← Tokens tab
│   ├── personas/        ← Personas tab
│   ├── identity/        ← Identity tab
│   ├── knowledge-base/  ← KB tab
│   ├── settings/        ← Settings tab
│   └── modals/          ← Modal components
├── hooks/               ← Custom React hooks
├── stores/              ← Zustand stores
├── api/                 ← API client & endpoints
├── types/               ← TypeScript interfaces
├── utils/               ← Helper functions
├── styles/              ← Global CSS
├── pages/               ← Page components
└── main.tsx
```

### Create First Component
```typescript
// src/components/common/Button.tsx
import React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button = React.memo(({
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  children,
  onClick,
  ...props
}: ButtonProps) => {
  const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50',
    danger: 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
});

Button.displayName = 'Button';
```

---

## 🏗️ Architecture Essentials

### State Management Pattern
```typescript
// Zustand store (src/stores/authStore.ts)
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}));
```

### API Integration Pattern
```typescript
// src/api/services.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sessionToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function fetchServices() {
  const response = await apiClient.get('/services');
  return response.data;
}
```

### Custom Hook Pattern
```typescript
// src/hooks/useServices.ts
import { useQuery } from '@tanstack/react-query';
import { fetchServices } from '../api/services';

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Form Handling Pattern
```typescript
// Using React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input {...register('password')} type="password" />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## 🎯 First Week Goals

### Day 1-2: Setup & Base Components
- [ ] Project initialized with all dependencies
- [ ] Project structure created
- [ ] Tailwind CSS configured
- [ ] Build Button component
- [ ] Build Input component
- [ ] Build Card component
- [ ] Storybook running

### Day 3-4: More Base Components & Auth
- [ ] Build Modal component
- [ ] Build Badge component
- [ ] Build Avatar component
- [ ] Set up Zustand auth store
- [ ] Create API client
- [ ] Implement login page

### Day 5: Navigation & Layout
- [ ] Build Header component
- [ ] Build Sidebar component
- [ ] Implement React Router
- [ ] Create main dashboard layout
- [ ] Implement responsive sidebar (drawer on mobile)
- [ ] Test responsive layout at 3 breakpoints

### End of Week
- [ ] 10+ base components built
- [ ] Users can log in
- [ ] Dashboard layout responsive
- [ ] Storybook documented
- [ ] Ready to start Phase 3 (Services)

---

## 📱 Responsive Design Quick Guide

### Mobile (< 640px)
```
Sidebar:      Hidden, accessible via hamburger menu drawer
Grid:         1 column
Touch targets: 44x44px minimum
Buttons:      Full width
Forms:        Single column, large inputs
```

### Tablet (640px - 1024px)
```
Sidebar:      Collapsible, defaults to closed
Grid:         2 columns
Touch targets: 40x40px minimum
Layout:       Spacious with good gutters
```

### Desktop (> 1024px)
```
Sidebar:      Fixed, 256px wide
Grid:         3 columns
Touch targets: 40x40px minimum
Layout:       Full featured, hover states
```

### Responsive Class Examples
```jsx
// 3 columns on desktop, 2 on tablet, 1 on mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* cards */}
</div>

// Sidebar drawer on mobile, fixed on desktop
<aside className="hidden lg:fixed lg:w-64 lg:inset-y-0">
  {/* sidebar */}
</aside>
<div className="lg:hidden">
  {/* mobile drawer */}
</div>
```

---

## 🎨 Dark Mode Implementation

### Tailwind Configuration
```javascript
// tailwind.config.js
export default {
  darkMode: 'class',
  theme: {
    extend: {},
  },
}
```

### Using Dark Mode Classes
```jsx
<div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
  Content adapts to light and dark modes
</div>
```

### Toggle Theme Hook
```typescript
import { useEffect, useState } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);
  
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(prev => !prev);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };
  
  return { isDark, toggleTheme };
}
```

---

## ♿ Accessibility Checklist (Per Component)

### Before Committing Any Component
- [ ] Uses semantic HTML (button, input, form, nav, etc.)
- [ ] Icon buttons have aria-label
- [ ] Form labels associated with inputs (for/id)
- [ ] Focus indicator visible (ring-2 ring-blue-500)
- [ ] Color contrast >= 4.5:1 for text
- [ ] Disabled state clear and not just grayed out
- [ ] Keyboard navigation works (Tab, Enter, Esc, Arrows)
- [ ] No auto-playing animations
- [ ] Error messages linked to fields (aria-describedby)

### Testing
```bash
# Install accessibility testing
npm install -D jest-axe @testing-library/jest-dom

# Test component
import { axe } from 'jest-axe';
import { render } from '@testing-library/react';

test('Button has no accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 🧪 Testing Quick Guide

### Component Test Template
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
  
  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Run Tests
```bash
npm run test          # Watch mode
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report
```

---

## 🚀 Common Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview production build locally

# Storybook
npm run storybook        # Start Storybook (http://localhost:6006)
npm run build-storybook  # Build Storybook

# Testing
npm run test             # Run tests in watch mode
npm run test:ui          # Run tests with UI
npm run test:coverage    # Generate coverage report

# Linting
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run type-check       # Check TypeScript types

# Build & Deploy
npm run build            # Build for production
npm run preview          # Preview production build
```

---

## 📋 Code Review Checklist

Before submitting PR:

### Code Quality
- [ ] TypeScript strict mode, no `any` types
- [ ] No console.log/debugger in production code
- [ ] No hardcoded values (use constants)
- [ ] Proper error handling
- [ ] Comments for complex logic

### Accessibility
- [ ] Component tested with axe DevTools
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA labels where needed
- [ ] Color contrast >= 4.5:1

### Testing
- [ ] Unit tests written (80%+ coverage)
- [ ] Edge cases tested
- [ ] Loading/error states tested
- [ ] Mobile responsive tested

### Performance
- [ ] No unnecessary re-renders (useMemo, useCallback)
- [ ] Images optimized
- [ ] No blocking operations in render
- [ ] API calls are efficient

### Documentation
- [ ] Storybook story created
- [ ] Props documented
- [ ] Usage examples provided
- [ ] Complex logic commented

---

## 🐛 Debugging Tips

### React DevTools
```
Install React DevTools browser extension
View component tree, props, state
Highlight component when hovering
```

### Zustand DevTools
```
npm install zustand/middleware
Use devtools middleware to track state changes
```

### Network Debugging
```
Open DevTools → Network tab
Check API calls, response times
Check request/response payloads
Verify authorization headers
```

### Lighthouse
```
DevTools → Lighthouse tab
Run performance audit
Check accessibility violations
Get optimization suggestions
```

### Dark Mode Debugging
```javascript
// In browser console
document.documentElement.classList.add('dark')      // Enable dark mode
document.documentElement.classList.remove('dark')   // Disable dark mode
```

---

## 📞 Getting Help

### If unsure about...
- **Design/Styling** → Check DESIGN.md (Section 2-3)
- **Component Implementation** → Check COMPONENTS.md
- **Architecture Decision** → Check UI_ARCHITECTURE.md
- **User Flow** → Check USER_FLOWS.md
- **Timeline/Phases** → Check IMPLEMENTATION_ROADMAP.md
- **General Question** → Check DESIGN_SUMMARY.md

### Common Issues

**Q: How do I use the color palette in Tailwind?**
A: Use standard Tailwind colors. Colors are already configured to match our palette.

**Q: Should I create a new component or use existing?**
A: Check COMPONENTS.md. If similar component exists, extend it. Only create new if truly unique.

**Q: What's the pattern for error handling?**
A: See UI_ARCHITECTURE.md Section 5 for 4-tier error handling strategy.

**Q: How do I handle responsive images?**
A: Use Tailwind responsive classes. Or use `<picture>` tag for WebP with fallback.

**Q: Can I use a different UI library?**
A: Use Radix UI or Headless UI. Stay consistent with accessibility approach.

---

## ✅ Before You Start Coding

1. **Read** DESIGN_SUMMARY.md (15 mins)
2. **Skim** DESIGN.md sections relevant to your work
3. **Check** COMPONENTS.md for your specific component
4. **Review** USER_FLOWS.md to understand user interactions
5. **Ask Questions** if anything is unclear
6. **Set up Development Environment** (see Setup Checklist)
7. **Start Building** following implementation phases

---

## 🎯 Success = Following the Spec

The design document exists for a reason. Follow it closely:
- ✅ Use exact colors from color palette
- ✅ Use exact spacing values (8px grid)
- ✅ Implement all component variants
- ✅ Build accessibility into every component
- ✅ Follow responsive breakpoints
- ✅ Test on mobile, tablet, desktop

Deviations are OK if:
- Design review approved
- Better UX discovered during development
- Technical constraints require different approach

**When in doubt, ask. When blocked, check the docs. When stuck, reach out.**

---

## 🚀 Let's Build Something Great!

**You've got this.** The documentation is comprehensive, the design is complete, and the timeline is realistic.

Follow the phases, build components to spec, test thoroughly, and we'll have an amazing dashboard.

**Questions?** Check the docs. **Stuck?** Ask for help. **Ready?** Let's go! 🎉

---

## End of DEVELOPER_QUICK_START.md
