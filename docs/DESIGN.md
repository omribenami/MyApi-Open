# MyApi Dashboard - UI/UX Design Document

## 1. Overview & Vision

**Product Goal**: Create a unified, intuitive dashboard that empowers non-technical users to manage authentication, external services, API tokens, AI personas, and personal knowledge bases without requiring backend access.

**Design Philosophy**:
- **Clarity First**: Clear visual hierarchy and progressive disclosure
- **Security by Default**: Sensitive data is protected but accessible when needed
- **Minimalist Elegance**: Reduce cognitive load while maintaining power-user capabilities
- **Inclusive Design**: WCAG 2.1 AA compliant, keyboard-navigable, screen reader friendly

**Target Users**:
- Non-technical users managing personal APIs and AI personas
- Power users creating multiple personas and managing guest tokens
- Developers integrating external services

---

## 2. Design System Specification

### 2.1 Color Palette

#### Primary Colors
- **Primary Blue**: `#3B82F6` (rgb: 59, 130, 246)
  - Used for: Primary actions, links, active states
  - Accessibility: WCAG AA compliant on white
  
- **Primary Dark**: `#1E40AF` (rgb: 30, 64, 175)
  - Used for: Hover states, emphasis, dark mode accents

#### Semantic Colors
- **Success Green**: `#10B981` (rgb: 16, 185, 129)
  - Connected services, successful operations
  
- **Warning Amber**: `#F59E0B` (rgb: 245, 158, 11)
  - Pending actions, cautions
  
- **Error Red**: `#EF4444` (rgb: 239, 68, 68)
  - Destructive actions, errors, security warnings
  
- **Info Indigo**: `#6366F1` (rgb: 99, 102, 241)
  - Informational messages, hints

#### Neutral Colors (Light Mode)
- **White**: `#FFFFFF`
- **Gray-50**: `#F9FAFB`
- **Gray-100**: `#F3F4F6`
- **Gray-200**: `#E5E7EB`
- **Gray-300**: `#D1D5DB`
- **Gray-400**: `#9CA3AF`
- **Gray-500**: `#6B7280`
- **Gray-600**: `#4B5563`
- **Gray-700**: `#374151`
- **Gray-800**: `#1F2937`
- **Gray-900**: `#111827`

#### Neutral Colors (Dark Mode)
- **Dark-50**: `#F9FAFB` (same as light)
- **Dark-100**: `#1F2937` (inverted gray-800)
- **Dark-200**: `#374151` (inverted gray-700)
- **Dark-300**: `#4B5563` (inverted gray-600)
- **Dark-400**: `#6B7280` (inverted gray-500)
- **Dark-500**: `#9CA3AF` (inverted gray-400)
- **Dark-600**: `#D1D5DB` (inverted gray-300)
- **Dark-700**: `#E5E7EB` (inverted gray-200)
- **Dark-800**: `#F3F4F6` (inverted gray-100)
- **Dark-900**: `#FFFFFF` (same as light)

#### Background Colors
- **Light Mode**: 
  - Page Background: `#F9FAFB` (gray-50)
  - Surface Background: `#FFFFFF`
  - Card Background: `#FFFFFF`
  - Elevated Background: `#F3F4F6` (gray-100)

- **Dark Mode**:
  - Page Background: `#0F172A` (slate-950)
  - Surface Background: `#1E293B` (slate-900)
  - Card Background: `#334155` (slate-700)
  - Elevated Background: `#475569` (slate-600)

#### Text Colors
- **Light Mode Primary**: `#111827` (gray-900)
- **Light Mode Secondary**: `#6B7280` (gray-500)
- **Light Mode Tertiary**: `#9CA3AF` (gray-400)

- **Dark Mode Primary**: `#FFFFFF`
- **Dark Mode Secondary**: `#CBD5E1` (slate-300)
- **Dark Mode Tertiary**: `#94A3B8` (slate-400)

### 2.2 Typography

**Font Stack**:
```
'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif
```

**Font Specifications**:

| Scale | Size | Weight | Line Height | Letter Spacing | Use Case |
|-------|------|--------|-------------|----------------|----------|
| **H1** | 32px | 600 | 1.5 | -0.02em | Page titles, major headings |
| **H2** | 28px | 600 | 1.4 | -0.01em | Section headings |
| **H3** | 24px | 600 | 1.4 | 0em | Sub-section headings |
| **H4** | 20px | 600 | 1.3 | 0em | Card titles, form labels |
| **Body-L** | 16px | 400 | 1.6 | 0em | Main content, descriptions |
| **Body-M** | 14px | 400 | 1.5 | 0em | Secondary content |
| **Body-S** | 12px | 400 | 1.4 | 0em | Helper text, captions |
| **Label** | 12px | 500 | 1.4 | 0.02em | Form labels, badges |
| **Button** | 14px | 500 | 1.5 | 0em | Button text |
| **Code** | 13px | 400 | 1.5 | 0em | Code blocks, tokens |

**Font Weights**:
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

### 2.3 Spacing System (8px Grid)

```
0px    = 0
2px    = 0.25x (1/4 unit)
4px    = 0.5x  (1/2 unit)
8px    = 1x    (base unit)
12px   = 1.5x
16px   = 2x
24px   = 3x
32px   = 4x
40px   = 5x
48px   = 6x
56px   = 7x
64px   = 8x
80px   = 10x
96px   = 12x
```

**Common Spacing Rules**:
- **Padding**: Components use 16px (2x) for comfortable spacing
- **Margins**: Section gaps use 24-32px (3-4x)
- **Gutter**: Column gaps use 24px (3x)
- **Gap between items**: 12-16px (1.5-2x)

### 2.4 Border & Shadows

**Border Radius**:
- **None**: 0px
- **Small**: 4px (inputs, small components)
- **Medium**: 8px (cards, modals)
- **Large**: 12px (large surfaces)
- **Full**: 9999px (avatars, badges)

**Border Width**:
- **Thin**: 1px (standard)
- **Medium**: 2px (focus states, emphasis)
- **Thick**: 4px (error states, strong emphasis)

**Shadow Elevations**:
- **None**: No shadow (default, flat)
- **Sm**: `0 1px 2px 0 rgba(0,0,0,0.05)`
- **Md**: `0 4px 6px -1px rgba(0,0,0,0.1)`
- **Lg**: `0 10px 15px -3px rgba(0,0,0,0.1)`
- **Xl**: `0 20px 25px -5px rgba(0,0,0,0.1)`
- **2Xl**: `0 25px 50px -12px rgba(0,0,0,0.25)`
- **Focus**: `0 0 0 3px rgba(59,130,246,0.3)` (blue-500 at 30%)

### 2.5 Component Library

#### Buttons

**Primary Button**
- Background: `#3B82F6` (Primary Blue)
- Text: White
- Height: 40px
- Padding: 8px 16px
- Border Radius: 8px
- Font: Body-M, Weight 500
- States:
  - Default: Base colors
  - Hover: Background `#2563EB` (darker blue)
  - Active: Background `#1E40AF`
  - Disabled: Opacity 50%, cursor not-allowed
  - Focus: Border 2px + focus shadow

**Secondary Button**
- Background: `#E5E7EB` (Gray-200)
- Text: `#111827` (Gray-900)
- Border: 1px `#D1D5DB`
- Height: 40px
- Padding: 8px 16px
- Hover: Background `#D1D5DB`
- Dark Mode: Background `#374151`, Text white

**Tertiary Button**
- Background: Transparent
- Text: `#3B82F6`
- Border: 1px `#3B82F6`
- Hover: Background `#EBF2FF` (light blue)
- Dark Mode: Hover background `#1E293B`

**Danger Button**
- Background: `#EF4444` (Error Red)
- Text: White
- Hover: Background `#DC2626`
- Used for destructive actions with confirmation

**Icon Button**
- 40x40px (or 32x32px compact)
- Transparent background, icon color `#3B82F6`
- Hover: Background `#EBF2FF`
- No visible border unless in groups

#### Input Fields

**Text Input**
- Height: 40px
- Border: 1px `#D1D5DB`
- Border Radius: 8px
- Padding: 10px 12px
- Font: Body-M
- Placeholder: `#9CA3AF`
- States:
  - Default: Gray border
  - Hover: Border `#9CA3AF`
  - Focus: Border `#3B82F6` 2px + shadow
  - Error: Border `#EF4444`
  - Disabled: Background `#F3F4F6`, opacity 50%
- Dark Mode: Background `#1E293B`, border `#475569`, text white

**Select/Dropdown**
- Same as text input
- Icon: Chevron down, right-aligned
- Open state: Border blue, background dropdown visible
- Option highlight: Background `#EBF2FF` with text `#3B82F6`

**Checkbox & Radio**
- Size: 16x16px
- Border: 2px `#D1D5DB`
- Checked: Background `#3B82F6`, checkmark white
- Focus: Box shadow blue
- Label: Body-M, 12px gap to left

**Toggle Switch**
- Size: 20x40px (height x width)
- Background: `#D1D5DB` (off) or `#10B981` (on)
- Circle: 16x16px white, transition 200ms
- Focus: Shadow blue

#### Cards

**Standard Card**
- Background: White (light), `#1E293B` (dark)
- Border: 1px `#E5E7EB`
- Border Radius: 8px
- Padding: 20px
- Shadow: Sm
- Header: H4 or H3, 12px bottom margin
- Footer: 12px top margin, subtle background

**Elevated Card**
- Same as Standard but Shadow: Md
- Used for interactive/hover states

**Connected Service Card** (Template)
- Grid: 2-3 columns responsive
- Show: Service icon, name, status badge, last sync, connect/revoke button
- Hover: Elevated card effect
- Disabled state: Opacity 50%

#### Badges & Status Indicators

**Status Badge**
- Height: 24px
- Padding: 4px 8px
- Border Radius: 12px
- Font: Label (12px, 500)
- Colors:
  - Connected: Green background, white text
  - Disconnected: Gray background, gray text
  - Pending: Amber background, white text
  - Error: Red background, white text

**Badge (General)**
- Height: 20px
- Padding: 2px 8px
- Border Radius: 10px
- Font: Body-S (12px)
- Used for: Scopes, tags, counts

#### Modals

**Modal Container**
- Border Radius: 12px
- Shadow: Xl + overlay (rgba(0,0,0,0.5))
- Min Width: 400px, Max Width: 600px
- Header: H2 or H3, 20px padding, border-bottom 1px gray-200
- Body: 20px padding
- Footer: 20px padding, border-top 1px gray-200, justify-end
- Close button: Top-right corner, transparent icon button

**Confirmation Modal** (Destructive)
- Header: "Confirm Action" or specific title
- Body: Clear warning message in red, action description
- Buttons: [Cancel (Secondary), Confirm (Danger)]
- Extra: Checkbox "I understand this action is permanent"

#### Forms

**Form Layout**
- Vertical stacking (labels above inputs)
- Label: Body-M (14px), 500 weight, 4px bottom margin
- Helper text: Body-S (12px), gray-500, 4px top margin
- Error message: Body-S (12px), red-500, 4px top margin
- Field spacing: 16px between fields
- Form sections: 32px between sections with section heading

**Form Validation**
- Inline validation: Show error message + red border on blur
- Helper text visible: Green checkmark + helper text on valid fields
- Prevent submit if invalid
- Accessibility: Use aria-invalid, aria-describedby

#### Tables

**Table Layout**
- Header row: Background gray-100 (light) or gray-700 (dark)
- Header font: Label (12px, 500)
- Body rows: Padding 12px vertical, 16px horizontal
- Row hover: Background gray-50 (light) or gray-800 (dark)
- Borders: 1px gray-200 between rows
- Striped: Optional alternating gray-50/white
- Responsive: Scroll horizontally on mobile, consider card view alternative

**Table Actions Column**
- Right-aligned icon buttons (edit, delete, copy)
- Dropdown menu for more actions (3-dot icon)
- Confirm on destructive actions

#### Alerts & Notifications

**Alert Container**
- Padding: 12px 16px
- Border Radius: 8px
- Border: 1px (left side 4px)
- Icon: 16x16px, left-aligned
- Text: Body-M
- Close: Icon button on right
- Position: Usually top of page or in context

**Alert Types**:
- **Success**: Green icon, green border, green background (light)
- **Error**: Red icon, red border, red background (light)
- **Warning**: Amber icon, amber border, amber background (light)
- **Info**: Indigo icon, indigo border, indigo background (light)

#### Avatars

**Avatar Sizes**:
- **XS**: 24x24px, font-size 10px
- **S**: 32x32px, font-size 12px
- **M**: 40x40px, font-size 14px
- **L**: 48x48px, font-size 16px
- **XL**: 56x56px, font-size 18px

**Avatar Options**:
- Initials (colored background with text)
- Image (user photo)
- Icon (service logo)
- Border Radius: Full circle
- Ring: 2px white ring on hover/active

#### Empty States

**Empty State Template**
- Icon: 48x48px, gray-400
- Headline: H3, gray-900
- Description: Body-M, gray-500
- CTA Button: Primary or Secondary
- Illustration: Optional (SVG)
- Padding: 40px

#### Pagination

**Pagination Controls**
- Buttons: Previous, numbered pages, Next
- Size: 32x32px buttons
- Active: Primary blue background
- Disabled: Gray with opacity 50%
- Text: "Page X of Y"
- Alignment: Center or right

---

## 3. Layout Specifications

### 3.1 Dashboard Layout Grid

**Overall Structure**:
```
┌─────────────────────────────────────┐
│         HEADER (64px fixed)          │
├──────────┬──────────────────────────┤
│          │                          │
│ SIDEBAR  │     MAIN CONTENT         │
│ (256px)  │     (Scrollable)         │
│          │                          │
│          │                          │
└──────────┴──────────────────────────┘
```

**Header**: 
- Height: 64px
- Display: flex, justify-between
- Left: Logo/App name
- Center: (Optional breadcrumbs or search)
- Right: Theme toggle, notifications, user profile menu

**Sidebar**:
- Width: 256px
- Fixed position (desktop), collapsible (mobile)
- Background: Slightly elevated from page
- Navigation items: 12px vertical spacing
- Active state: Left border 4px blue + highlight
- Hover: Background gray-100 (light) or gray-800 (dark)

**Main Content**:
- Padding: 32px
- Max width: None (full width except sidebar)
- Min height: 100vh - 64px

### 3.2 Responsive Breakpoints

| Device | Width | Sidebar | Columns | Touch Target |
|--------|-------|---------|---------|--------------|
| **Mobile** | <640px | Hidden/Drawer | 1 | 44x44px min |
| **Tablet** | 640px-1024px | Collapsible | 2 | 40x40px |
| **Desktop** | >1024px | Fixed | 3+ | 40x40px |

**Mobile Drawer**:
- Sidebar becomes hamburger menu
- Drawer overlays at 80% width
- Scrim (overlay) on main content
- Close on nav click or scrim click

**Tablet/Responsive Card Grid**:
- Services: 2 columns
- Tokens: Full width table with horizontal scroll
- Personas: 2 columns
- Responsive gaps: 16px (mobile), 24px (tablet+)

### 3.3 Tab Navigation (Main Content Area)

**Tabs Location**: Below header, above content
**Style**:
- Background: White (light) or gray-800 (dark)
- Tab styling: Transparent background, bottom border 2px (blue when active, transparent when inactive)
- Active state: Blue border, blue text
- Hover: Opacity transition
- Spacing: 24px between tabs
- Padding: 12px vertical, 0px horizontal (border handles spacing)
- Responsive: Consider overflow scroll with nav arrows on mobile

---

## 4. Component Inventory

### Core Components
- [ ] Header (with theme toggle, profile menu)
- [ ] Sidebar / Navigation drawer
- [ ] Tab navigation
- [ ] Service cards (connected/disconnected)
- [ ] Token card with copy/reveal/revoke
- [ ] Persona card with preview modal
- [ ] Identity form (split USER.md / SOUL.md editor)
- [ ] Knowledge base viewer/editor
- [ ] Settings forms (password, 2FA, privacy)
- [ ] Token creation form with scope selector
- [ ] OAuth flow trigger + status display
- [ ] Search/filter inputs
- [ ] Data tables (tokens list, KB documents)
- [ ] Confirmation modals
- [ ] Toast notifications
- [ ] Error boundaries
- [ ] Loading skeletons
- [ ] Empty states

---

## 5. Dark Mode Specification

**Default**: Light mode
**User Preference**: Detect `prefers-color-scheme` media query, allow manual toggle
**Toggle Location**: Header right side, near profile menu
**Storage**: LocalStorage + user profile preference

**Transition**: 200ms smooth color transition
**Avoid**: Animated transitions on page load (flash)

**Dark Mode Adjustments**:
- Increase contrast for text (use lighter shades)
- Reduce saturation of colors slightly
- Shadows become more visible (increase opacity)
- Borders may be less visible (increase opacity to 20-30%)

---

## 6. Accessibility Standards (WCAG 2.1 AA)

### Color Contrast
- **Normal text**: Minimum 4.5:1 ratio
- **Large text** (18px+): Minimum 3:1 ratio
- **Non-text elements**: Minimum 3:1 ratio

**Testing**:
- Use WebAIM contrast checker before release
- All interactive elements must be clearly visible

### Keyboard Navigation
- **Tab order**: Logical flow (left to right, top to bottom)
- **Tab stops**: All interactive elements
- **Skip links**: Skip to main content, skip to sidebar
- **Focus visible**: Blue ring shadow (3px, 0.3 opacity)
- **Shortcuts**: 
  - `?` = Show keyboard shortcuts modal
  - `Ctrl+K` or `Cmd+K` = Open command/search
  - `Esc` = Close modal/dropdown
  - `Enter` = Submit form or activate button

### Screen Reader Support
- **Semantic HTML**: Use proper heading levels, list elements, buttons
- **ARIA labels**: Provide descriptive labels for icons
  - `aria-label="Toggle dark mode"`
  - `aria-label="Disconnect GitHub"`
- **ARIA live regions**: Toast notifications use `role="status" aria-live="polite"`
- **ARIA hidden**: Hide purely decorative elements
- **Form validation**: Use `aria-invalid="true"`, `aria-describedby="error-id"`

### Visual Indicators
- **Focus state**: Always visible (blue ring)
- **Error state**: Color + icon + text (not just color)
- **Disabled state**: Clear visual difference + `cursor: not-allowed`
- **Required fields**: Asterisk (*) + `aria-required="true"`

---

## 7. Mobile-First Responsive Design

### Design Strategy
**Desktop-First approach** (but mobile-optimized):
1. Start with mobile layout (1 column, touch-friendly sizing)
2. Enhance for tablet (2 columns, more spacing)
3. Optimize for desktop (3+ columns, compact sidebar)

### Touch Targets
- Minimum 44x44px on mobile
- Minimum 40x40px on tablet/desktop
- Spacing: 8px minimum between touch targets

### Viewport Settings
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Mobile-Specific Considerations
- Sidebar: Hidden by default, accessible via hamburger menu
- Buttons: Full width on mobile, normal width on desktop
- Modals: Full screen (minus safe areas) on mobile
- Forms: Single column, large inputs
- Tables: Convert to stacked cards on mobile
- Token reveal: Requires authentication (Face ID, fingerprint)

---

## 8. Security UX Patterns

### Token Display Strategy
- **Master Token**: 
  - Default: Hidden (show last 10 characters only)
  - Reveal button: Show full token with warning
  - Copy button: Copy to clipboard, show "Copied!" toast
  - Duration: Auto-hide after 30 seconds

- **Guest Tokens**:
  - Show first 10 characters only
  - Full token visible on creation (with copy button, warning)
  - Token page shows: "••••••••••[last 4 chars]"

### Confirmation Dialogs
- **Destructive Actions**: Delete account, revoke token, disconnect service
- **Modal Content**:
  - Clear action title
  - Explanation of consequences
  - Cannot be reversed message (if true)
  - Require additional confirmation: "Type to confirm" or checkbox
  - Buttons: [Cancel], [Confirm] (Danger button)

### Visual Security Indicators
- **Sensitive Fields**: Padlock icon next to label
- **Protected Data**: Subtle warning background (light red/yellow)
- **Connected Services**: Green checkmark + "Connected" badge
- **Disconnected Services**: Gray badge with message
- **Warning Messages**: Red background, icon, clear language

---

## 9. Real-Time vs Polling

**Strategy**: Real-time-first with graceful fallback
- WebSocket connection for:
  - User profile updates
  - Service connection status changes
  - Token revocation confirmations
  - Persona list changes
- Polling fallback (15-30s) if WebSocket unavailable
- Service sync timestamps updated in real-time

**Implementation**:
- Show connection status indicator (small dot in header)
- Auto-retry with exponential backoff
- Offline indicator if no connection for 30s

---

## 10. Data Export & Backup Strategy

**Export Formats**:
1. **JSON**: Full profile backup (USER.md + SOUL.md + tokens metadata)
2. **Markdown**: Knowledge base as markdown files (zip)
3. **CSV**: Token list and usage logs

**Export Locations**:
- Settings → Privacy → Export Data button
- Generates timestamped file (e.g., `myapi-backup-2026-02-27.json`)
- Includes encryption warning: "Backup contains sensitive data"

**Retention Policy**:
- Settings → Privacy → Data Retention
- Options: 30 days, 90 days, 1 year, indefinite
- Auto-delete logs after selected period

---

## 11. Multi-User vs Single-User

**Decision**: Single-user primary, multi-persona support
- **UI reflects**: "You" with multiple personas
- **Sharing**: Future feature (not in MVP)
- **Accounts**: One account, multiple personas (SOUL.md variants)
- **Navigation**: Switch persona from profile menu

---

## 12. Animation & Transitions

**Principles**:
- Smooth, subtle animations (200-300ms)
- No auto-play animations on load
- Respects `prefers-reduced-motion`

**Common Transitions**:
- **Fade**: Page load, component appear/disappear (200ms)
- **Slide**: Modal appear, sidebar toggle (250ms)
- **Transform**: Button hover (hover effects), state changes
- **Color transition**: Theme toggle (300ms)

**Timing Functions**:
- Ease-in-out: Standard transitions
- Ease-out: Appears (entering)
- Ease-in: Disappears (exiting)

---

## End of DESIGN.md
