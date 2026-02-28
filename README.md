# 🚀 HireFlow AI — Intelligent Recruitment Platform

<div align="center">

**Enterprise AI Recruitment & Interview Platform**

*B-Side Enterprise Portal • C-Side Candidate App • AI Interview Agent*

[![Monorepo](https://img.shields.io/badge/Monorepo-Turborepo-ef4444?logo=turborepo)](https://turbo.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple?logo=vite)](https://vitejs.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black?logo=fastify)](https://fastify.dev/)

</div>

---

## 📖 Project Overview

HireFlow AI is a modern, full-stack monorepo for intelligent recruitment. It consists of two distinct frontend applications sharing a common backend and logic libraries.

### 🏢 **Portal (Enterprise B-Side)**
The command center for HR and interviewers.
- **Stack**: React 19, Vite, Tailwind v4, Recharts, Radix UI.
- **Design**: Google Material Design 3 (M3) - Professional, Information-Dense.
- **Key Features**:
    - **Dashboard**: Real-time hiring funnel, KPI cards, AI cost tracking.
    - **Candidate Management**: Kanban board, list view, rich profile details.
    - **Job Management**: Pipeline configuration, requirements analysis.
    - **Screening Rules**: Visual DSL rule builder for auto-filtering resumes.
    - **Settings**: AI model configuration (OpenAI/Gemini/Claude), API key management.

### 🎤 **Interview (Candidate C-Side)**
A dedicated, immersive interview application for candidates.
- **Stack**: React 19, Vite, Tailwind v4, Framer Motion.
- **Design**: Warm, Clean, Immersive, Anxiety-Reducing.
- **Key Features**:
    - **Device Check**: Camera/Mic/Network pre-flight capability.
    - **Waiting Room**: Interactive tips and breathing exercises.
    - **Interview Room**: WebRTC video, AI chat agent, code editor, anti-cheat monitoring.

### ⚡ **Server (Backend)**
Unified API service powering both applications.
- **Stack**: Fastify, TypeScript, Zod.
- **Key Features**:
    - **REST API**: For data management and orchestration.
    - **WebSocket**: For real-time interview signaling and chat.
    - **AI Gateway**: Centralized LLM access control (Future migration target).

---

## 🏗 Repository Structure (Monorepo)

This project uses **Turborepo** and **npm workspaces**.

```
Hireflow/
├── turbo.json                      # Build system configuration
├── package.json                    # Root workspace config
│
├── apps/                           # Application Logic
│   ├── portal/                     # 🏢 Enterprise Dashboard (:3000)
│   │   └── src/index.css           # M3 Design Tokens
│   │
│   └── interview/                  # 🎤 Candidate App (:3001)
│       └── src/index.css           # Warm Design Tokens
│
├── packages/                       # Shared Libraries
│   └── shared/
│       ├── types/                  # Types: User, Job, Candidate, Interview
│       ├── utils/                  # Shared utility functions
│       └── i18n/                   # Internationalization (zh/en) logic
│
└── server/                         # ⚡ Backend API (:4000)
    └── src/index.ts                # Fastify Server Entry
```

---

## 🚦 Current Development Status

| Module | Feature | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Portal** | Dashboard UI | ✅ Ready | Complete Mock Data integration |
| **Portal** | Candidate Kanban | ✅ Ready | Drag-and-drop & Filters working |
| **Portal** | Settings Page | ✅ Ready | AI Model Config UI complete |
| **Portal** | API Integration | 🚧 Pending | Currently using local mocks |
| **Interview** | Landing/Device Check | ✅ Ready | Full UI flow implemented |
| **Interview** | Video Room UI | ✅ Ready | Layout & Controls ready |
| **Interview** | Real-time connection | 🚧 Pending | WebRTC wiring needed |
| **Server** | API Skeleton | ✅ Ready | Routes defined, types aligned |
| **Server** | Database | 📅 Planned | PostgreSQL + Prisma integration needed |
| **Server** | Auth System | 📅 Planned | JWT implementation needed |

---

## 🚀 Getting Started

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Arch1eSUN/Hireflow.git

# Install dependencies for all workspaces
npm install
```

### 2. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```
Update `.env` with your API keys (optional for UI development, required for AI features).

### 3. Run Development Environment

You can start all services simultaneously:

```bash
# Starts Portal (:3000), Interview (:3001), and Server (:4000)
npm run dev
```

Or run specific workspaces:

```bash
# Run only Portal
npm run dev:portal

# Run only Interview App
npm run dev:interview

# Run only Server
npm run dev:server
```

### 4. API E2E Test (Auth + Monitor Policy + XiaoFan Voice Path)

```bash
# One-command mode:
# - Runs timeline-link compatibility precheck
# - Checks /api/health
# - Auto-builds and auto-starts server when needed
# - Tries to auto-start postgres via docker compose
npm run test:e2e:api

# Direct mode (requires server already running)
npm run test:e2e:api:direct

# Core smoke suite (job -> candidate -> interview -> monitor -> integrity)
# - Includes timeline-link compatibility precheck
npm run test:e2e:smoke

# Voice-path suite (startup readiness + websocket dialogue with XiaoFan)
# - Includes timeline-link compatibility precheck
npm run test:e2e:voice

# Screening isolation suite (cross-tenant access guard for screening APIs)
npm run test:e2e:screening:direct

# Timeline link compatibility check (legacy -> v2 query migration rules)
npm run test:timeline-link:compat

# Run all suites sequentially (includes timeline-link compat precheck):
# auth/policy + core smoke + screening isolation + voice path
npm run test:e2e:all
```

Optional environment variables:

```bash
# Target API base URL (default http://localhost:4000)
HIREFLOW_BASE_URL=http://localhost:4000

# Disable docker auto-start for postgres (default: enabled)
HIREFLOW_E2E_AUTO_DB_START=false

# Force voice-path suite to fail (instead of skip) when no valid AI key is configured
HIREFLOW_E2E_REQUIRE_AI_KEY=true

# Optional explicit provider/key bootstrap for voice-path suite
HIREFLOW_E2E_AI_PROVIDER=openai
HIREFLOW_E2E_AI_KEY=sk-xxx
HIREFLOW_E2E_AI_BASE_URL=https://api.openai.com/v1
HIREFLOW_E2E_AI_MODEL=gpt-4o
```

Evidence chain verification API (new):

```bash
GET /api/interviews/:id/evidence-chain/verify?limit=500
```

The endpoint verifies the interview evidence hash-chain and returns:
- `status`: `valid | partial | broken | not_initialized`
- `linkedEvents` / `checkedEvents`
- `latestHash`, `latestSeq`, and `brokenAt` (if broken)

Company export guardrail policy:

```bash
GET /api/settings/evidence-chain-policy
PUT /api/settings/evidence-chain-policy
GET /api/settings/evidence-chain-policy/history?limit=20
POST /api/settings/evidence-chain-policy/rollback
```

Policy save / rollback endpoints support optional request fields:
- `reason` (string, audit note)
- `idempotencyKey` (string, deduplicates repeated submit/retry)

The same optional fields are also supported on company monitor template policy APIs:
- `PUT /api/settings/monitor-policy`
- `POST /api/settings/monitor-policy/rollback`

Interview-level monitor policy APIs also support these optional fields:
- `PUT /api/interviews/:id/monitor-policy`
- `POST /api/interviews/:id/monitor-policy/rollback`

When enabled, server-side evidence export writes are blocked if chain state is `broken` (and optionally `partial`).

Realtime update event (monitor websocket):

```bash
type: company_evidence_chain_policy_updated
type: company_monitor_policy_template_updated
```

The monitor side receives these events after save/rollback and refreshes policy state + history.

---

## 🤖 AI Context (For LLM Agents)

**To any AI Agent reading this codebase:**

1.  **Source of Truth**: 
    - Frontend source code is located in `apps/portal/src` and `apps/interview/src`.
    - Backend source code is in `server/src`.
    - Shared types are in `packages/shared/types`.
    
2.  **Design Patterns**:
    - **Frontend**: Functional React components, Hooks for logic, Context for global state (Theme/Auth).
    - **Styling**: Tailwind CSS utility classes + CSS Variables for Design Tokens (defined in `index.css`).
    - **Data**: Currently transitioning from `MOCK_DATA` constants to React Query/SWR + API calls.

3.  **Strict Rules**:
    - **Do NOT** modify `packages/shared/types` without checking impact on both frontend and backend.
    - **Do NOT** put business logic in components; use hooks or services.
    - **Do NOT** commit `.env` files.

---

## 🗺 Roadmap

1.  **Backend Core**: Connect `server` to PostgreSQL using Prisma ORM.
2.  **Authentication**: Implement unified JWT auth for HR users (Portal) and Token-based access for Candidates (Interview).
3.  **AI Integration**: Move AI Gateway logic from frontend (if any) to `server` to secure API keys.
4.  **Real-time Features**: Implement WebSocket signaling for interview rooms.

---

<div align="center">
<b>Built with ❤️ by Arch1eSUN</b>
</div>
