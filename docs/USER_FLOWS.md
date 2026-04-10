# MyApi Dashboard - User Flows & Wireframes

## 1. First-Time Setup Flow

### Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY: SETUP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  STEP 1          STEP 2           STEP 3          STEP 4        │
│  ┌──────────┐   ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Login   │──▶│ Onboard  │───▶│  Setup   │───▶│ Create   │   │
│  │  Page    │   │  Profile │    │ Persona  │    │ Persona  │   │
│  │(OAuth)   │   │(USER.md) │    │(SOUL.md) │    │ Success  │   │
│  └──────────┘   └──────────┘    └──────────┘    └──────────┘   │
│                                                         │          │
│                                                         ▼          │
│                                                  Dashboard Home    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Login Page Wireframe

```
┌─────────────────────────────────────┐
│                                      │
│           MyApi Dashboard            │
│                                      │
│         [Logo/Illustration]          │
│                                      │
│      Welcome Back, User!             │
│   Manage your APIs & Personas        │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  [🔵] Login with Google         │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  [⬛] Login with GitHub         │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  [📘] Login with Facebook       │ │
│  └─────────────────────────────────┘ │
│                                      │
│           OR                         │
│                                      │
│  Email: [___________________]        │
│  Password: [_______________]         │
│                                      │
│       [Sign In]  [Sign Up]           │
│                                      │
└─────────────────────────────────────┘
```

### Step 2: Onboarding - User Profile Setup

```
┌──────────────────────────────────────────────────┐
│ Complete Your Profile                      [Next] │
├──────────────────────────────────────────────────┤
│                                                  │
│ Step 1 of 2: Basic Information                  │
│                                                  │
│ [___] Profile Photo (optional)                  │
│       Click to upload or drag & drop            │
│                                                  │
│ Name: [_________________________] *              │
│                                                  │
│ Email: [_______________________] *              │
│                                                  │
│ Location: [____________________]                │
│                                                  │
│ Timezone: [GMT±0              ▼]                │
│                                                  │
│ Bio/About: [________________]                   │
│            [________________]                   │
│                                                  │
│                              [Back] [Next →]    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Step 3: Create First Persona (SOUL.md)

```
┌──────────────────────────────────────────────────┐
│ Create Your First Persona                 [Skip] │
├──────────────────────────────────────────────────┤
│                                                  │
│ Step 2 of 2: Persona Setup                      │
│                                                  │
│ Persona Name: [_____________________] *         │
│                                                  │
│ Emoji: [😊▼] Vibe: [_____________] *           │
│                                                  │
│ Core Principles: (Enter each on new line)       │
│ [_________________________________]              │
│ [_________________________________]              │
│ [_________________________________]              │
│                                                  │
│ Boundaries: (What you won't do)                 │
│ [_________________________________]              │
│ [_________________________________]              │
│                                                  │
│ Upload SOUL.md (optional):                      │
│ [Choose file] or [Paste YAML]                  │
│                                                  │
│                              [Back] [Create →]  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Success Screen

```
┌──────────────────────────────────────────────────┐
│                   Welcome!                        │
│                                                  │
│              ✓ Setup Complete                    │
│                                                  │
│   Your dashboard is ready to use                 │
│                                                  │
│   [🎊 Illustration/Animation]                   │
│                                                  │
│   You're all set! Here's what you can do:       │
│   ✓ Connect external services (Google, etc.)    │
│   ✓ Create API tokens for integrations         │
│   ✓ Manage multiple AI personas                │
│   ✓ Maintain your personal knowledge base       │
│                                                  │
│          [Go to Dashboard] or [Skip Tour]       │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 2. Main Dashboard Layout Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  MyApi       [🌙] [📬] [👤 User ▼]  [Settings] [Logout]         │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│ • Services   │  Services / Connectors                           │
│ • Tokens     │  ═════════════════════════════════════════════ │
│ • Personas   │                                                  │
│ • Identity   │  [🔵 Google]        [⬛ GitHub]        [💜]     │
│ • Knowledge  │  Connected          Disconnected               │
│   Base       │  Last sync: 2h      [Connect]                  │
│ • Settings   │  Scopes: X, Y, Z                               │
│              │                     [Revoke]                    │
│              │                                                  │
│              │  [🔗 Slack]         [💬 Discord]       [📱]    │
│              │  Connected          Connected                   │
│              │  Last sync: 1h      Last sync: 30m              │
│              │  [Revoke]           [Revoke]                    │
│              │                                                  │
│              │  [+] Add Service                                │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## 3. Services / Connectors Tab Flow

### User Action: Connect New Service

```
User clicks [Connect] on Service Card
           ↓
┌─────────────────────────────────┐
│  OAuth Modal Opens              │
│  "Authorize MyApi to access     │
│   your GitHub account"          │
│                                 │
│  Required Scopes:              │
│  ✓ user:email                  │
│  ✓ repo                         │
│  ✓ gist                         │
│                                 │
│         [Authorize] [Cancel]   │
└─────────────────────────────────┘
           ↓
   (Redirect to OAuth provider)
           ↓
   (User grants permission)
           ↓
   (Redirect back to app)
           ↓
┌─────────────────────────────────┐
│  ✓ GitHub Connected!            │
│  Scopes granted successfully    │
│  Last synced: Just now          │
│                                 │
│  [Close] [View Details]         │
└─────────────────────────────────┘
```

### Services Tab Full Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ Services & Connectors                              [+ Add]    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Connected Services: 3 / 5                                     │
│                                                                │
│ ┌─────────────────────┐  ┌─────────────────────┐              │
│ │ 🔵 Google          │  │ ⬛ GitHub           │              │
│ │ Connected ✓        │  │ Connected ✓         │              │
│ │ Last sync: 2h ago  │  │ Last sync: 1h ago   │              │
│ │                    │  │                     │              │
│ │ Scopes:            │  │ Scopes:             │              │
│ │ • user:email       │  │ • user:email        │              │
│ │ • calendar         │  │ • repo              │              │
│ │ • drive            │  │ • gist              │              │
│ │                    │  │                     │              │
│ │    [View]          │  │    [View]           │              │
│ │  [Revoke]          │  │  [Revoke]           │              │
│ └─────────────────────┘  └─────────────────────┘              │
│                                                                │
│ ┌─────────────────────┐  ┌─────────────────────┐              │
│ │ 💜 Discord         │  │ 🔗 Slack            │              │
│ │ Connected ✓        │  │ Disconnected        │              │
│ │ Last sync: 30m     │  │                     │              │
│ │                    │  │ [Connect to use     │              │
│ │ Scopes:            │  │  integrations]      │              │
│ │ • server:manage    │  │                     │              │
│ │ • webhooks         │  │    [Connect]        │              │
│ │                    │  │                     │              │
│ │    [View]          │  │                     │              │
│ │  [Revoke]          │  │                     │              │
│ └─────────────────────┘  └─────────────────────┘              │
│                                                                │
│ ┌─────────────────────┐  ┌─────────────────────┐              │
│ │ 📱 WhatsApp        │  │ [+ Add Service]     │              │
│ │ Disconnected       │  │ Find & connect more │              │
│ │                    │  │ external services   │              │
│ │ [Connect]          │  │                     │              │
│ └─────────────────────┘  └─────────────────────┘              │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Tokens Vault Tab

### Token Creation Flow

```
User clicks [+ New Token]
           ↓
┌────────────────────────────────────┐
│ Create Guest Token                 │
├────────────────────────────────────┤
│                                    │
│ Token Name: [________________] *   │
│                                    │
│ Expires In: [30 days        ▼]     │
│                                    │
│ Description (optional):            │
│ [____________________________]      │
│ [____________________________]      │
│                                    │
│ Scopes: (Select at least one)     │
│ ☑ read                           │
│ ☑ write                          │
│ ☐ admin                          │
│ ☐ delete                         │
│                                    │
│              [Create Token] [X]    │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│ ✓ Token Created Successfully       │
│                                    │
│ Token Value: [Copy button]         │
│ myapi_XXX...XXX                    │
│                                    │
│ ⚠️  This is the last time you'll  │
│ see this token. Copy it now!       │
│                                    │
│ [Copy] [Download] [Done]           │
└────────────────────────────────────┘
```

### Tokens Vault Full Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ API Tokens Vault                              [+ New Token]   │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Master Token                                   [👁 Reveal]    │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ••••••••••••••••••••••••••••••••••••••••••••••••••••••  │  │
│ │ Created: Feb 27, 2026                                   │  │
│ │ Expires: Never                                          │  │
│ │ Requests this month: 1,234                             │  │
│ │                                              [Copy]     │  │
│ │                                             [Revoke]    │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
│ Guest Tokens (2)                              [Search...]     │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ API Integration Token          myapi_abc... [Expires 3d]  │
│ │ Scopes: read, write                  Last used: 2h ago    │
│ │ Requests: 42                                              │
│ │                          [Copy] [Edit] [Dup] [Revoke]     │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Mobile App Token                   myapi_def... [Exp 7d]  │
│ │ Scopes: read                       Last used: Just now    │
│ │ Requests: 1,023                                            │
│ │                          [Copy] [Edit] [Dup] [Revoke]     │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Old Token (Revoked)       myapi_old... [Revoked 2w ago]  │
│ │ Scopes: read              Last used: Mar 15              │
│ │ Requests: 3                         [Delete]               │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Personas Tab

### Create Persona Flow

```
User clicks [+ Create Persona]
           ↓
┌────────────────────────────────────┐
│ Create New Persona                 │
├────────────────────────────────────┤
│                                    │
│ Persona Name: [_______________] *  │
│                                    │
│ Emoji: [😊▼]  Vibe: [________] *  │
│                                    │
│ Description:                       │
│ [____________________________]      │
│                                    │
│ Core Principles (one per line):   │
│ [____________________________]      │
│ [____________________________]      │
│                                    │
│ Boundaries:                        │
│ [____________________________]      │
│                                    │
│ [Upload SOUL.md] or [Paste YAML]  │
│                                    │
│        [Create] [Preview] [Cancel] │
└────────────────────────────────────┘
           ↓
   (Save to backend)
           ↓
   (Return to Personas list)
```

### Personas Tab Full Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ AI Personas                                  [+ Create New]   │
│ Switch Active Persona: [Current Persona ▼]                   │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌──────────────────────┐  ┌──────────────────────┐            │
│ │ 😊 Main Persona      │  │ 🤖 Code Reviewer     │            │
│ │ [Active ✓]           │  │ [Switch to this]     │            │
│ │                      │  │                      │            │
│ │ Vibe: Friendly,      │  │ Vibe: Precise,       │            │
│ │ Helpful              │  │ Technical            │            │
│ │                      │  │                      │            │
│ │ Traits:              │  │ Traits:              │            │
│ │ • Empathetic         │  │ • Detail-oriented    │            │
│ │ • Patient            │  │ • Thorough           │            │
│ │ • Creative           │  │ • Critical feedback  │            │
│ │                      │  │                      │            │
│ │ [Preview] [Edit]     │  │ [Preview] [Edit]     │            │
│ │ [Delete]             │  │ [Delete] [Duplicate] │            │
│ └──────────────────────┘  └──────────────────────┘            │
│                                                                │
│ ┌──────────────────────┐  ┌──────────────────────┐            │
│ │ 📚 Teacher Mode      │  │ [+ Add New Persona]  │            │
│ │ [Switch to this]     │  │ Create another       │            │
│ │                      │  │ AI persona           │            │
│ │ Vibe: Educational,   │  │                      │            │
│ │ Explanatory          │  │                      │            │
│ │                      │  │                      │            │
│ │ Traits:              │  │                      │            │
│ │ • Clear              │  │                      │            │
│ │ • Thorough           │  │                      │            │
│ │ • Encouraging        │  │                      │            │
│ │                      │  │                      │            │
│ │ [Preview] [Edit]     │  │                      │            │
│ │ [Delete] [Duplicate] │  │                      │            │
│ └──────────────────────┘  └──────────────────────┘            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Persona Preview Modal

```
┌──────────────────────────────────┐
│ Main Persona                  [×] │
├──────────────────────────────────┤
│                                  │
│ 😊 Main Persona                  │
│ Vibe: Friendly, Helpful          │
│ Status: Active                   │
│                                  │
│ Core Principles:                 │
│ • Always be helpful and honest   │
│ • Explain complex topics simply  │
│ • Ask clarifying questions       │
│                                  │
│ Boundaries:                      │
│ • Won't engage in deception      │
│ • Won't provide legal advice     │
│ • Won't pretend to be human      │
│                                  │
│ Voice Protocol:                  │
│ • Conversational tone            │
│ • Use emojis occasionally        │
│ • Ask follow-up questions        │
│                                  │
│              [Close] [Edit SOUL]  │
│                                  │
└──────────────────────────────────┘
```

---

## 6. Identity Tab (USER.md + SOUL.md)

### Split View Layout

```
┌────────────────────────────────────────────────────────────────┐
│ User Profile & AI Identity                      [Save] [Reset] │
├────────────────┬──────────────────────────────────────────────┤
│                │                                              │
│ [Tab: Profile] │ [Tab: AI Persona]                            │
│ [Tab: Persona] │                                              │
│                │ Name: Main Persona                           │
│ Name:          │ Emoji: 😊                                     │
│ Jane Smith     │ Vibe: Helpful, Friendly                      │
│                │                                              │
│ Location:      │ Fundamental Principles:                      │
│ Tel Aviv       │ • Always be helpful                          │
│                │ • Explain clearly                            │
│ Timezone:      │ • Ask questions when unclear                 │
│ GMT+2          │                                              │
│                │ Boundaries:                                  │
│ Role:          │ • Won't pretend to be human                  │
│ Software Dev   │ • Won't give medical advice                  │
│                │ • Won't engage in deception                  │
│ Company:       │                                              │
│ [___________]  │ Voice Protocol:                              │
│                │ • Conversational & engaging                  │
│ Languages:     │ • Use emojis when appropriate                │
│ English, Hebrew│ • Be concise but thorough                    │
│                │ • Ask clarifying questions                   │
│ Bio:           │                                              │
│ [__________]   │ [Rich editor with markdown                  │
│ [__________]   │  support and preview]                       │
│                │                                              │
│ [Save Profile] │                                              │
│                │                                              │
└────────────────┴──────────────────────────────────────────────┘
```

### Identity Edit Form (USER.md)

```
┌────────────────────────────────────────┐
│ Edit User Profile                 [×]  │
├────────────────────────────────────────┤
│                                        │
│ Avatar: [Profile Photo] [Upload]       │
│                                        │
│ Basic Information                      │
│ ──────────────────────────────────     │
│ Name: [Jane Smith            ] *       │
│ Email: [jane@example.com     ] *       │
│ Location: [Your City         ]         │
│ Timezone: [UTC+0             ▼]        │
│ Website: [https://example.com]         │
│                                        │
│ Professional Information                │
│ ──────────────────────────────────     │
│ Role: [Software Developer    ]         │
│ Company: [MyApi Inc          ]         │
│ Education: [CS Degree        ]         │
│ Years of Experience: [5 years]         │
│                                        │
│ Personal Information                   │
│ ──────────────────────────────────     │
│ Languages: [English, Hebrew  ]         │
│ Interests: [AI, Web Dev, Music]        │
│ Bio/About: [________________]          │
│            [________________]          │
│                                        │
│ Contact Preferences                    │
│ ──────────────────────────────────     │
│ ☑ Email notifications                 │
│ ☐ SMS notifications                   │
│ ☑ Marketing emails                    │
│ ☐ Weekly digest                       │
│                                        │
│          [Save Changes] [Cancel]       │
│                                        │
└────────────────────────────────────────┘
```

---

## 7. Knowledge Base Tab

### KB Viewer Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ Knowledge Base                      [+ Upload] [+ New Doc]    │
│                           [Search...] [Sort ▼] [Filter ▼]    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ KB Statistics:                                                 │
│ 12 Documents • 450 KB • Last updated 2 hours ago              │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 📄 Company Values                    [Size] [Feb 27]     │  │
│ │ Our core company values and mission statement are...     │  │
│ │ Tags: company, values, mission                          │  │
│ │              [View] [Edit] [Delete] [Share]             │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 📄 API Integration Guide               [Size] [Feb 20]   │  │
│ │ Step-by-step guide for integrating MyApi into your app  │  │
│ │ Tags: api, integration, tutorial                        │  │
│ │              [View] [Edit] [Delete] [Share]             │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 📄 Meeting Notes - Feb 27                  [Size] [NOW]  │  │
│ │ Discussed roadmap, Q2 priorities, team growth plans...   │  │
│ │ Tags: meetings, planning, team                          │  │
│ │              [View] [Edit] [Delete] [Share]             │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Document Editor Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ Edit: Company Values                              [Save] [×]  │
├──────────────────┬─────────────────────────────────────────┤
│                  │                                         │
│ Title:           │ Markdown Editor                        │
│ [Company Values] │ ────────────────────────────────────  │
│                  │ # Company Values                       │
│ Tags:            │                                        │
│ [company]        │ We believe in three core principles:  │
│ [values]         │                                        │
│ [mission]        │ ## 1. Innovation                       │
│                  │ - Constant learning                    │
│ Save:            │ - Risk-taking                          │
│ [Auto-saving]    │ - Experimentation                     │
│                  │                                        │
│ Delete:          │ ## 2. Integrity                        │
│ [Delete Doc]     │ - Transparency                         │
│                  │ - Honesty                             │
│                  │ - Accountability                      │
│                  │                                        │
│                  │ ────────────────────────────────────  │
│                  │ PREVIEW:                              │
│                  │ # Company Values                       │
│                  │ We believe in three core...            │
│                  │                                         │
└──────────────────┴─────────────────────────────────────────┘
```

---

## 8. Settings Tab

### Settings Overview Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ Settings                                                      │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Account Settings                                              │
│ ─────────────────                                             │
│ • Profile Settings                     [Manage Profile]       │
│ • Email & Notifications                [Manage              │
│ • Privacy                              [Manage Privacy]      │
│                                                                │
│ Security                                                      │
│ ────────                                                      │
│ • Password & Authentication            [Change Password]     │
│ • Two-Factor Authentication (2FA)      [Enable 2FA]          │
│ • Active Sessions                      [View Sessions]       │
│ • Connected Devices                    [Manage Devices]      │
│                                                                │
│ Data & Privacy                                                │
│ ─────────────                                                 │
│ • Data Retention Policy                [View Policy]         │
│ • Download Your Data                   [Export Data]         │
│ • API Documentation                    [View Docs]           │
│                                                                │
│ Webhooks (Coming Soon)                                        │
│ ─────────────────────                                         │
│ • Webhook Configuration                [Coming Soon]         │
│                                                                │
│                                                                │
│ Danger Zone                                                   │
│ ───────────                                                   │
│ Delete Account                                                │
│ ⚠️  This action cannot be undone.                            │
│                                        [Delete Account]       │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Delete Account Flow (Confirmation)

```
User clicks [Delete Account]
           ↓
┌────────────────────────────────────────┐
│ ⚠️  Delete Account                  [×] │
├────────────────────────────────────────┤
│                                        │
│ Are you absolutely sure?                │
│                                        │
│ This action will:                      │
│ • Permanently delete your account      │
│ • Remove all tokens and personas       │
│ • Delete all stored documents          │
│ • Disconnect all services              │
│                                        │
│ This cannot be reversed.               │
│                                        │
│ Type "DELETE" to confirm:              │
│ [____________________]                 │
│                                        │
│ ☐ I understand this is permanent      │
│                                        │
│     [Cancel] [Delete Permanently]     │
│                                        │
└────────────────────────────────────────┘
```

---

## 9. Confirmation Dialogs

### Standard Confirmation

```
┌────────────────────────────────────┐
│ Confirm Action               [×]   │
├────────────────────────────────────┤
│                                    │
│ Are you sure you want to:          │
│ Disconnect GitHub?                 │
│                                    │
│ This will revoke all GitHub        │
│ integrations and stop syncing       │
│ data from GitHub.                  │
│                                    │
│ ☑ I understand this action        │
│                                    │
│    [Cancel] [Confirm] [Delete]     │
│                                    │
└────────────────────────────────────┘
```

### Destructive Action (Red)

```
┌────────────────────────────────────┐
│ ⚠️  Revoke Token                [×] │
├────────────────────────────────────┤
│                                    │
│ Revoke "Mobile App Token"?         │
│                                    │
│ This token will no longer work.    │
│ You can create a new one later.    │
│                                    │
│ ☑ I understand this action        │
│                                    │
│    [Cancel] [Revoke]               │
│                                    │
└────────────────────────────────────┘
```

---

## 10. Error States & Empty States

### Empty State: No Services Connected

```
┌──────────────────────────────────────────────────┐
│ Services & Connectors                   [+ Add]  │
├──────────────────────────────────────────────────┤
│                                                  │
│           [🔗 Illustration]                      │
│                                                  │
│     No Services Connected Yet                    │
│                                                  │
│  Get started by connecting your first            │
│  external service (Google, GitHub, etc.)        │
│                                                  │
│         [Browse Available Services]              │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Error State: Connection Failed

```
┌──────────────────────────────────────────────────┐
│ ❌ Connection Failed                             │
│                                                  │
│ Could not connect to GitHub.                     │
│                                                  │
│ Error Details:                                   │
│ "Authorization request timeout"                  │
│                                                  │
│ Try:                                             │
│ • Check your internet connection                │
│ • Close other login tabs                        │
│ • Clear browser cache                           │
│                                                  │
│         [Try Again] [Get Help]                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Empty State: No Tokens

```
┌──────────────────────────────────────────────────┐
│ API Tokens Vault                  [+ New Token]  │
├──────────────────────────────────────────────────┤
│                                                  │
│         [🔐 Illustration]                        │
│                                                  │
│     No Guest Tokens Yet                          │
│                                                  │
│  Create your first guest token to:              │
│  • Integrate with external apps                 │
│  • Share limited access securely                │
│  • Manage API access granularly                 │
│                                                  │
│         [Create Your First Token]                │
│                                                  │
│ Master Token: Ready to use                       │
│ ••••••••••••••••••••••••••••••••••••••••••••     │
│                                    [Reveal]      │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 11. Responsive Layouts

### Mobile Layout - Sidebar as Drawer

```
┌────────────────────────────┐
│ ☰ MyApi         [🌙] [👤] │
├────────────────────────────┤
│                            │
│  Services                  │
│  ════════════════════════  │
│                            │
│  [🔵 Google]               │
│  Connected                 │
│  [Revoke]                  │
│                            │
│  [⬛ GitHub]               │
│  Disconnected              │
│  [Connect]                 │
│                            │
│  [+ Add Service]           │
│                            │
│  [Hamburger opens drawer] ◀─┐
│                              │
└────────────────────────────┘
                                 ┌─────────────┐
                                 │  • Services │
                                 │  • Tokens   │
                                 │  • Personas │
                                 │  • Identity │
                                 │  • KB       │
                                 │  • Settings │
                                 │             │
                                 │  [X] Close  │
                                 └─────────────┘
```

### Tablet Layout - 2 Columns

```
┌──────────────────────────────────────────┐
│ MyApi       [🌙] [📬] [👤▼]             │
├────────────────┬───────────────────────┤
│   Navigation   │  Services & Connectors│
│   (Sidebar)    │  ═════════════════    │
│                │                       │
│ • Services     │ [🔵 Google]           │
│ • Tokens       │ Connected             │
│ • Personas     │ [Revoke]              │
│ • Identity     │                       │
│ • KB           │ [⬛ GitHub]           │
│ • Settings     │ Disconnected          │
│                │ [Connect]             │
│                │                       │
│ [Collapse ◀]   │ [+ Add Service]       │
│                │                       │
└────────────────┴───────────────────────┘
```

---

## 12. Toast Notifications

### Success Toast

```
┌─────────────────────────────────┐
│ ✓ Token Created                 │
│ Your guest token is ready to use│
│                        [Dismiss] │
└─────────────────────────────────┘
```

### Error Toast

```
┌─────────────────────────────────┐
│ ✗ Connection Failed             │
│ GitHub OAuth request timed out  │
│                  [Retry] [×]     │
└─────────────────────────────────┘
```

### Info Toast with Action

```
┌─────────────────────────────────┐
│ ℹ Token Copied                  │
│ Token copied to clipboard       │
│                  [Undo] [×]      │
└─────────────────────────────────┘
```

---

## End of USER_FLOWS.md
