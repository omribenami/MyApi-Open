# User Instructions & Directives
*Append all new architectural decisions, preferences, and directives from Omri here.*

- **2026-02-27**: MyAPI is NOT an AI token manager. It IS a personal middleware hub that sits between the user and ANY AI platform (Claude, GPT, Gemini, Local).
- **2026-02-27**: Maintain one token (e.g., "myapi_abc123") that provides access to all user services (Google, Todoist, WhatsApp), identity files (USER.md, SOUL.md), personas, and skills.
- **2026-02-27**: Architecture must support Platform Independence, Single Source of Truth, Easy Collaboration (guest tokens), Security & Privacy (proxying), and Persona Management.
- **2026-02-27**: Tech Stack is Python/FastAPI backend (Identity Store, Token Vault, Service Connectors, Persona Manager, Gateway API, Guest Token System) and React Dashboard frontend.
- **2026-02-27**: Keep the Node.js MVP running for reference while building the new Python/FastAPI version. Keep security in mind (no one uses it if it's not secure).
- **2026-02-27**: Use Opus only for critical parts to avoid cooldown; prefer cheaper models for regular work.
- **2026-02-27**: Maintain a strict mechanism to track instructions (`INSTRUCTIONS.md`) and current state (`STATE.md`) to seamlessly resume work across cooldowns.
