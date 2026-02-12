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
