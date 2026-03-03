# MyApi

MyApi is a robust, privacy-first personal API platform and dashboard designed to consolidate your digital identity, service integrations, and autonomous agent capabilities. It serves as the bridge between your personal data, external APIs, and AI agents.

## Core Features

- **Services & Connectors**: Seamlessly connect and manage OAuth integrations and API keys for over 35+ services including Google, GitHub, Slack, Discord, Twitter, and more.
- **Tokens Vault**: Manage master tokens and generate fine-grained, scoped guest tokens to securely share access with external agents or third-party applications.
- **Persona Management**: Create, edit, and activate dynamic AI personas (with tailored `SOUL.md` variants) for specialized agent interactions.
- **Identity Docs**: A central hub to define and manage user profiles and identity metadata (`USER.md`).
- **Knowledge Base**: An integrated Markdown-supported knowledge base for attaching specific documents and long-term memory (`MEMORY.md`) to distinct personas.
- **Skills Marketplace**: Discover, install, and publish custom skills and capabilities that expand the functional toolset of your local agents.

## Architecture

The project follows a decoupled architecture emphasizing security and extensibility:

- **Backend** (`/src/`): A lightweight, fast Node.js/Express server that acts as the Gateway Context Assembler and OAuth proxy. It handles routing, authentication, and secure database interactions (SQLite).
- **Frontend Dashboard** (`/src/public/dashboard-app/`): A responsive, modern React + Vite single-page application styled with Tailwind CSS and utilizing Zustand for state management.
- **Design System** (`/docs/`): Comprehensive documentation covering UI architecture, color palettes, typography, and over 35 detailed component specifications.

## Quick Start (Local Development)

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/omribenami/MyApi.git
   cd MyApi
   ```

2. **Install backend dependencies:**
   ```bash
   cd src
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd src/public/dashboard-app
   npm install
   ```

### Running the App

1. **Start the Express Backend:**
   From the `/src` directory, run:
   ```bash
   npm run dev
   ```
   *The API will be available at `http://localhost:4500`*

2. **Start the Frontend Dashboard:**
   In a separate terminal, from the `/src/public/dashboard-app` directory, run:
   ```bash
   npm run dev
   ```
   *The Dashboard will be accessible at `http://localhost:5173`*

## Documentation

Extensive design and technical documentation can be found in the `/docs` directory:
- [Design Summary](docs/DESIGN_SUMMARY.md)
- [UI Architecture](docs/UI_ARCHITECTURE.md)
- [Developer Quick Start](docs/DEVELOPER_QUICK_START.md)

## Repository Policy

**Strict Isolation:** This repository is dedicated exclusively to the MyApi platform codebase. External workspace environments, agent runtime logs, python environments, and system-level caches (e.g., `.venv`, `__pycache__`, `*.sqlite-shm`) are strictly ignored via `.gitignore` and must never be committed.

## Changelog

### 2026-03-03

- Stabilized dashboard build/deploy flow and fixed dist asset hash mismatches that caused blank page loads.
- Added Knowledge Base multipart file upload support (txt/md/pdf), improved upload validation, and clearer error handling.
- Enabled persona-scoped KB context availability and improved persona-document attachment validation.
- Added AI self-discovery surfaces:
  - `GET /api/v1/capabilities`
  - `GET /api/v1/tokens/me/capabilities`
  - `GET /openapi.json`
  - `GET /.well-known/ai-plugin.json`
- Enhanced Vault API intake/discovery flow with website URL metadata and safer discovery error handling.
- Expanded automated validation with Phase 12A integration checks (discovery + KB upload + persona scope).
- Applied a professional minimal UI polish (less colorful, reduced emoji-heavy UI, cleaner GitHub-like visual style).

## License

All rights reserved.
