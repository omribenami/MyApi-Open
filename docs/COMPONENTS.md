# MyApi Dashboard - Component Specifications

## Component Library Detailed Specifications

### Common Components

---

## 1. Button Component

**File**: `src/components/common/Button.tsx`

### Props Interface
```typescript
interface ButtonProps {
  // Styling
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  
  // State
  disabled?: boolean;
  isLoading?: boolean;
  
  // Behavior
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  
  // Content
  children: React.ReactNode;
  icon?: React.ReactNode; // Icon to display before text
  iconPos?: 'left' | 'right';
  
  // HTML attributes
  className?: string;
  [key: string]: any;
}
```

### Variants

#### Primary
- Background: `#3B82F6` (blue)
- Text: White
- Hover: Background `#2563EB`
- Active: Background `#1E40AF`

#### Secondary
- Background: `#E5E7EB` (gray-200)
- Text: `#111827` (gray-900)
- Hover: Background `#D1D5DB`

#### Tertiary
- Background: Transparent
- Text: `#3B82F6`
- Border: 1px `#3B82F6`
- Hover: Background `#EBF2FF`

#### Danger
- Background: `#EF4444` (red)
- Text: White
- Hover: Background `#DC2626`
- Confirm action required

### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| **sm** | 32px | 6px 12px | 12px |
| **md** | 40px | 8px 16px | 14px |
| **lg** | 48px | 10px 20px | 16px |

### Usage Examples
```typescript
// Primary button
<Button variant="primary" onClick={handleSubmit}>
  Save Changes
</Button>

// Danger button with loading
<Button variant="danger" isLoading={isDeleting}>
  {isDeleting ? 'Deleting...' : 'Delete Account'}
</Button>

// Icon button
<Button variant="tertiary" icon={<EditIcon />} size="sm">
  Edit
</Button>

// Full width
<Button className="w-full">Sign In</Button>
```

---

## 2. Input Component

**File**: `src/components/common/Input.tsx`

### Props Interface
```typescript
interface InputProps {
  // Label & help
  label?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  
  // State
  disabled?: boolean;
  readOnly?: boolean;
  
  // Input specific
  type?: 'text' | 'email' | 'password' | 'number' | 'url';
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  
  // Validation
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  
  // Icons
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  
  // HTML attributes
  [key: string]: any;
}
```

### Features

- **Label**: Positioned above input, required asterisk if needed
- **Helper Text**: Gray, small font, appears below input
- **Error State**: Red border + error message
- **Icons**: Optional icons on left/right side
- **Disabled State**: Gray background, disabled cursor
- **Focus State**: Blue border (2px), shadow

### Usage Example
```typescript
<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  helperText="We'll never share your email"
  value={email}
  onChange={setEmail}
  error={errors.email?.message}
  required
/>
```

---

## 3. Select/Dropdown Component

**File**: `src/components/common/Select.tsx`

### Props Interface
```typescript
interface SelectProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  
  options: Array<{
    label: string;
    value: string;
    disabled?: boolean;
  }>;
  
  // Multiple selection
  multiple?: boolean;
  values?: string[]; // For multiple
  
  // Search
  searchable?: boolean;
  filterFn?: (options, searchText) => options;
  
  [key: string]: any;
}
```

### Behavior
- Click opens dropdown with options
- Keyboard: ↑/↓ to navigate, Enter to select, Esc to close
- Searchable variant: Type to filter options
- Multiple: Shows selected count or comma-separated list

### Usage Example
```typescript
<Select
  label="Expiration"
  value={expiration}
  onChange={setExpiration}
  options={[
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: 'Never expires', value: 'never' },
  ]}
  required
/>
```

---

## 4. Card Component

**File**: `src/components/common/Card.tsx`

### Props Interface
```typescript
interface CardProps {
  // Styling
  variant?: 'default' | 'elevated' | 'outlined';
  hover?: boolean; // Show hover effect
  
  // Content slots
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  
  // Padding
  padding?: 'none' | 'sm' | 'md' | 'lg';
  
  // Click handling
  onClick?: () => void;
  clickable?: boolean;
  
  [key: string]: any;
}
```

### Variants

#### Default
- Background: White/dark-surface
- Border: 1px gray-200
- Shadow: Sm
- Rounded: 8px

#### Elevated
- Shadow: Md (more prominent)
- Used for hover states, emphasis

#### Outlined
- Background: Transparent
- Border: 2px blue (or color)
- No shadow

### Layout
```
┌─────────────────────┐
│     Header (20px)   │  Optional
├─────────────────────┤
│                     │
│     Content (20px)  │  Main content
│                     │
├─────────────────────┤
│     Footer (20px)   │  Optional
└─────────────────────┘
```

### Usage Example
```typescript
<Card hover>
  <Card.Header>
    <h3>Service Name</h3>
  </Card.Header>
  
  <Card.Body>
    <p>Connected • Last synced 2 hours ago</p>
  </Card.Body>
  
  <Card.Footer>
    <Button size="sm">Revoke</Button>
  </Card.Footer>
</Card>
```

---

## 5. Modal Component

**File**: `src/components/common/Modal.tsx`

### Props Interface
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Content
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  
  // Sizing
  size?: 'sm' | 'md' | 'lg';
  maxWidth?: string; // CSS value
  
  // Behavior
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
  
  // Styling
  danger?: boolean; // Red header for destructive actions
  
  [key: string]: any;
}
```

### Structure
```
┌─────────────────────────────┐
│ Title          [Close Btn]  │  Header
├─────────────────────────────┤
│                             │
│      Modal Content          │  Body (scrollable)
│                             │
├─────────────────────────────┤
│              [Action Buttons]│ Footer
└─────────────────────────────┘
```

### Accessibility
- Trap focus inside modal
- Esc key closes modal
- Focus returns to trigger element after close
- ARIA: `role="dialog"`, `aria-labelledby`, `aria-describedby`

### Usage Example
```typescript
<Modal isOpen={isOpen} onClose={handleClose} title="Create Token">
  <TokenCreateForm onSuccess={handleClose} />
  
  <Modal.Footer>
    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
    <Button variant="primary" type="submit">Create</Button>
  </Modal.Footer>
</Modal>
```

---

## 6. Badge Component

**File**: `src/components/common/Badge.tsx`

### Props Interface
```typescript
interface BadgeProps {
  // Styling
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  
  // Content
  children: React.ReactNode;
  icon?: React.ReactNode;
  
  // Behavior
  onRemove?: () => void; // Shows X button to remove
  
  [key: string]: any;
}
```

### Variants & Colors
| Variant | Background | Text | Use Case |
|---------|------------|------|----------|
| **default** | Gray-100 | Gray-900 | Generic |
| **success** | Green-100 | Green-900 | Connected, success |
| **warning** | Amber-100 | Amber-900 | Pending, caution |
| **error** | Red-100 | Red-900 | Error, revoked |
| **info** | Indigo-100 | Indigo-900 | Info |

### Sizes
- **sm**: 20px height, 12px font
- **md**: 24px height, 14px font

### Usage Example
```typescript
// Simple badge
<Badge variant="success">Connected</Badge>

// Removable badge (for scopes)
<Badge onRemove={() => removeScope(scope)}>
  {scope}
</Badge>

// With icon
<Badge variant="warning" icon={<ClockIcon />}>
  Pending
</Badge>
```

---

## 7. Avatar Component

**File**: `src/components/common/Avatar.tsx`

### Props Interface
```typescript
interface AvatarProps {
  // Image or initials
  src?: string; // Image URL
  alt?: string;
  initials?: string; // 1-2 characters
  
  // Sizing
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  // Styling
  variant?: 'circle' | 'square'; // Default: circle
  color?: string; // Background for initials
  
  // Status indicator
  status?: 'online' | 'offline' | 'idle';
  
  [key: string]: any;
}
```

### Sizes
| Size | Dimension | Font |
|------|-----------|------|
| **xs** | 24x24px | 10px |
| **sm** | 32x32px | 12px |
| **md** | 40x40px | 14px |
| **lg** | 48x48px | 16px |
| **xl** | 56x56px | 18px |

### Usage Example
```typescript
// With image
<Avatar src={userPhoto} alt="John Doe" size="md" />

// With initials
<Avatar initials="JD" size="md" />

// With status
<Avatar src={profilePic} size="md" status="online" />
```

---

## 8. Alert Component

**File**: `src/components/common/Alert.tsx`

### Props Interface
```typescript
interface AlertProps {
  // Type
  variant?: 'success' | 'error' | 'warning' | 'info';
  
  // Content
  title?: string;
  message: string;
  
  // Behavior
  closable?: boolean;
  onClose?: () => void;
  
  // Icon
  showIcon?: boolean;
  icon?: React.ReactNode;
  
  [key: string]: any;
}
```

### Variants
```
┌─ [Icon] Title ────────────────── [×]
│  Message text describing the situation
└─────────────────────────────────────
```

### Usage Example
```typescript
<Alert
  variant="error"
  title="Something went wrong"
  message="Failed to connect GitHub. Please try again."
  closable
  onClose={() => setAlert(null)}
/>
```

---

## 9. Toast Notification Component

**File**: `src/components/common/Toast.tsx`

### Props Interface
```typescript
interface ToastProps {
  id: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number; // ms, 0 = never auto-dismiss
  onClose: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Behavior
- Appears in bottom-right corner (toast-bottom-right)
- Auto-dismisses after 4 seconds (default)
- Stacks vertically
- Can be clicked to dismiss
- Optional action button
- Animation: Slide in from right, fade out

### Usage (via hook)
```typescript
const { addToast } = useNotification();

addToast({
  variant: 'success',
  title: 'Token Created',
  message: 'Your guest token is ready to use',
  duration: 5000,
});

// With action
addToast({
  variant: 'success',
  message: 'Token copied to clipboard',
  action: {
    label: 'Undo',
    onClick: () => undoLastAction(),
  },
});
```

---

## 10. Skeleton Loader Component

**File**: `src/components/common/Skeleton.tsx`

### Props Interface
```typescript
interface SkeletonProps {
  // Sizing
  width?: string | number;
  height?: string | number;
  
  // Styling
  variant?: 'text' | 'circle' | 'rect';
  rounded?: boolean;
  
  // Animation
  animation?: 'pulse' | 'wave';
  
  [key: string]: any;
}
```

### Usage Example
```typescript
// Loading service card
{isLoading ? (
  <Card>
    <Skeleton height={40} width="60%" variant="text" />
    <Skeleton height={20} width="40%" variant="text" style={{ marginTop: '8px' }} />
  </Card>
) : (
  <ServiceCard service={service} />
)}
```

---

## Feature Components

---

## 11. ServiceCard Component

**File**: `src/components/services/ServiceCard.tsx`

### Props Interface
```typescript
interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    icon: React.ReactNode;
    description?: string;
    scopes?: string[];
    isConnected: boolean;
    lastSynced?: Date;
  };
  
  onConnect: () => void;
  onDisconnect: () => void;
}
```

### Layout
```
┌──────────────────────────────┐
│ [Icon] Service Name     [•]  │
├──────────────────────────────┤
│ Connected • Last synced...   │
│                              │
│ Scopes: scope1, scope2       │
├──────────────────────────────┤
│           [Connect] [Revoke] │
└──────────────────────────────┘
```

### State Colors
- **Connected**: Green badge "Connected"
- **Disconnected**: Gray badge "Not Connected"

### Responsive
- Desktop: 3 cards per row
- Tablet: 2 cards per row
- Mobile: 1 card per row

---

## 12. TokenCard Component

**File**: `src/components/tokens/TokenCard.tsx`

### Props Interface
```typescript
interface TokenCardProps {
  token: {
    id: string;
    name: string;
    preview: string; // First 10 chars: "xxxxxxx..."
    createdAt: Date;
    expiresAt?: Date;
    scopes: string[];
    lastUsed?: Date;
    requestCount: number;
    isMaster?: boolean;
  };
  
  onRevoke: () => void;
  onEditScopes?: () => void;
  onDuplicate?: () => void;
  onReveal?: () => void; // For master token
}
```

### Master Token Card
```
┌──────────────────────────────────┐
│ Master Token                     │
├──────────────────────────────────┤
│ ••••••••••••••••••••••••••••••  │
│                        [Reveal] │
│                                 │
│ Created: Feb 27, 2026           │
│ Never expires                   │
├──────────────────────────────────┤
│                    [Copy] [Revoke]│
└──────────────────────────────────┘
```

### Guest Token Card
```
┌──────────────────────────────────┐
│ Token Name                       │
│ myapik... (first 10 chars)       │
├──────────────────────────────────┤
│ Created: Feb 27, 2026            │
│ Expires: Mar 27, 2026            │
│ Scopes: read, write              │
│                                  │
│ Last used: 2 hours ago           │
│ Requests: 42                     │
├──────────────────────────────────┤
│ [Copy] [Edit] [Duplicate] [Revoke]│
└──────────────────────────────────┘
```

---

## 13. PersonaCard Component

**File**: `src/components/personas/PersonaCard.tsx`

### Props Interface
```typescript
interface PersonaCardProps {
  persona: {
    id: string;
    name: string;
    vibe: string;
    emoji?: string;
    description?: string;
    traits: string[]; // Core personality traits
    isActive: boolean;
  };
  
  onPreview: () => void;
  onEdit: () => void;
  onSetActive: () => void;
  onDelete: () => void;
}
```

### Layout
```
┌──────────────────────────────┐
│ 😊 Persona Name    [✓ Active]│
├──────────────────────────────┤
│                              │
│ Vibe: Friendly, helpful      │
│                              │
│ Traits: trait1, trait2, ...  │
│                              │
├──────────────────────────────┤
│ [Preview] [Edit] [Delete]    │
└──────────────────────────────┘
```

---

## 14. TokenCreateForm Component

**File**: `src/components/tokens/TokenCreateForm.tsx`

### Features
- Multi-step form (optional)
  1. Basic info (name, expiration)
  2. Scope selection (checkboxes)
  3. Review & create
- Real-time validation
- Scope search/filter
- Display restrictions note

### Form Fields
1. **Token Name** (required, text input)
2. **Expires In** (required, select dropdown)
3. **Scopes** (required, multi-checkbox)
4. **Description** (optional, textarea)

### On Success
- Show modal with generated token
- Copy button
- Warning: "This is the last time you'll see this token"
- Option to download as text file

---

## 15. ScopeSelector Component

**File**: `src/components/tokens/ScopeSelector.tsx`

### Props Interface
```typescript
interface ScopeSelectorProps {
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
  availableScopes: Array<{
    id: string;
    name: string;
    description: string;
    category?: string;
  }>;
  searchable?: boolean;
  disabled?: boolean;
}
```

### Features
- Grouped by category (e.g., "Services", "Tokens", "Identity")
- Checkboxes for each scope
- Description below scope name
- Search/filter by name
- "Select all" / "Clear all" buttons per category

---

## 16. IdentitySplitView Component

**File**: `src/components/identity/IdentitySplitView.tsx`

### Layout (Desktop)
```
┌─────────────────────┬─────────────────────┐
│   USER.md Editor    │   SOUL.md Editor    │
│                     │                     │
│ • Name              │ • Name              │
│ • Location          │ • Vibe              │
│ • Timezone          │ • Emoji             │
│ • Role              │ • Boundaries        │
│ • etc.              │ • Principles        │
│                     │                     │
└─────────────────────┴─────────────────────┘

[Preview] [Save Changes] [Reset]
```

### Layout (Mobile)
- Tab 1: USER.md Editor
- Tab 2: SOUL.md Editor
- Both full-width on mobile

---

## 17. MarkdownEditor Component

**File**: `src/components/identity/MarkdownEditor.tsx`

### Features
- Split view: Editor (left) + Preview (right, markdown rendering)
- Syntax highlighting (Prism.js or Highlight.js)
- Toolbar: Bold, Italic, Heading, Code, List buttons
- Line numbers
- Auto-save to localStorage (draft)
- Character count
- Undo/Redo support

### Keyboard Shortcuts
- `Ctrl+B` → Bold selected text
- `Ctrl+I` → Italic selected text
- `Ctrl+Shift+1-6` → Heading level
- `Tab` → Indent (in code blocks)
- `Shift+Tab` → Unindent

---

## 18. KnowledgeBaseViewer Component

**File**: `src/components/knowledge-base/KBViewer.tsx`

### Features
- Display list of documents
- Search/filter by name or content
- Sort by date created, name, size
- Show statistics: Total documents, total size
- Click to expand document content
- Syntax highlighting for code blocks
- Copy code block button

### Document List Item
```
┌──────────────────────────────────────┐
│ Document Name         [Size] [Date]   │
│ Preview of content... (max 100 chars) │
│ Tags: tag1, tag2                      │
└──────────────────────────────────────┘
```

---

## 19. DocumentUpload Component

**File**: `src/components/knowledge-base/DocumentUpload.tsx`

### Features
- Drag & drop zone for markdown files
- File input button
- Max file size: 5MB
- Allowed types: .md, .txt, .pdf (converted to text)
- Progress bar for upload
- Success/error toast
- Validation: Reject non-markdown files

### Validation
- File type check (extension or MIME)
- File size check
- Content preview before upload

---

## General Guidelines

### Prop Conventions
- Optional props have defaults
- Boolean props are prefixes: `isLoading`, `disabled`, `showIcon`
- Event handlers start with `on`: `onClick`, `onChange`, `onSubmit`
- Collections end with `s`: `options`, `errors`, `values`

### TypeScript
- All components have strict PropTypes or TypeScript interfaces
- Use discriminated unions for variant props
- Export interfaces separately for reusability

### Styling
- Use Tailwind CSS utility classes
- Avoid inline styles unless dynamic
- Use CSS Modules for scoped styles if needed
- Export styled components from component file

### Accessibility
- All interactive elements have proper ARIA labels
- Use semantic HTML (button, input, form, etc.)
- Focus states always visible
- Color never the only differentiator
- Form labels always associated with inputs

### Testing
- Unit tests for all components
- Test props, states, and user interactions
- Use `data-testid` for hard-to-select elements

---

## End of COMPONENTS.md
