# HireFlow AI — **Production Launch Blueprint** (Rev 6)

> **Document Purpose**: The **AUTHORITATIVE** guide for moving HireFlow AI from current MVP to a **Production-Ready** SaaS product.
> **Last Updated**: 2026-02-13 03:13 CST
> **Revision**: 6 — Project Vision, Gap Analysis & "Distance to Landing" detail added.

---

## 0. Project Overview & Status

### 0.1 Product Vision
HireFlow AI is an enterprise-grade **Intelligent Recruitment System** designed to reduce hiring time by **80%**. It bridges the gap between traditional **ATS** (Applicant Tracking Systems) and **Agentic AI**, automating the high-volume, low-value tasks of sourcing and screening so HR can focus on closing candidates.

**Core Capabilities**:
1.  **🤖 Smart Screening**: Automatically parses resumes and scores them against granular job requirements using a configurable Rule Engine (Boolean logic + Semantic Matching).
2.  **🎥 AI Interviewer**: Conducts **24/7 video/audio interviews** using LLMs (Gemini/GPT-4) to ask dynamic, context-aware technical questions while detecting cheating and analyzing soft skills.
3.  **📊 Data-Driven Hiring**: Provides real-time pipeline analytics, conversion funnels, and granular AI cost monitoring to optimize recruitment ROI.

### 0.2 Gap Analysis: Distance to Production ("落地")
To reach a production-ready **V1.0**, the system requires crossing three major technical bridges:

1.  **The Intelligence Bridge (Phase 5)** 🔴
    *   **Current**: Frontend mutations work, but `/ai/chat` and screening endpoints rely on hardcoded mocks.
    *   **Needed**: Migrate `AIGateway` to `server/`, wire up real LLM keys (OpenAI/Gemini), and activate the scoring logic.

2.  **The Real-Time Bridge (Phase 6)** 🔴
    *   **Current**: `InterviewRoomPage` is a UI shell.
    *   **Needed**: Implement **WebRTC** for video/audio capture and **WebSocket** for real-time Q&A orchestration. Connect Speech-to-Text (STT) and Text-to-Speech (TTS) services.

3.  **The Infrastructure Bridge (Phase 7-8)** 🟡
    *   **Current**: Database is active, but file storage and caching are dormant.
    *   **Needed**: Activate **MinIO** for resume/recording storage and **Redis** for session/rate-limiting.

### 0.3 Planned But Not Fully Implemented (The "To-Do" List)
These features have UI representation or database schemas but lack full backend logic:

*   **Screening Rule Builder**: The UI (`ScreeningPage`) exists for creating complex filtering rules like "(Experience > 3y AND Python) OR (Experience > 5y AND Java)", but the backend CRUD and execution engine are not wired.
*   **Live Interview Monitor**: The `InterviewMonitorPage` exists for HR to watch interviews in real-time, but currently displays static dummy data.
*   **Notification System**: The bell icon and dropdown exist, but they pull from a temporary in-memory mocked list, not the database.
*   **File Uploads**: The database has fields for `resumeUrl` and `recordingUrl`, but there is no API to handle file uploads to MinIO.
*   **API Key Management**: The `SettingsPage` UI has a place for AI settings, but the secure management of multiple provider keys (encryption/decryption flows) is partial.

### Completion Matrix

| Layer | Status | Completion |
|:------|:-------|:-----------|
| Infrastructure (Docker, Prisma, PostgreSQL) | ✅ Complete | 100% |
| Authentication (JWT, Refresh, RBAC) | ✅ Complete | 100% |
| Core CRUD APIs (Candidates, Jobs, Interviews) | ✅ Complete | 95% |
| Frontend — Data Binding (useQuery) | ✅ Complete | 100% |
| Frontend — Mutations (useMutation) | ✅ Complete | 95% |
| Frontend — Design System (M3) | ✅ Complete | 90% |
| Settings Configuration | ✅ Complete | 100% |
| API Key Management | 🟡 UI Only | 20% |
| AI Services (LLM Gateway, Screening) | 🟡 Scaffolded | 15% |
| Real-Time Interview (WebSocket, WebRTC) | 🟡 Scaffolded | 10% |
| Notifications (Real) | ⬜ Mock Data | 5% |
| Resume Upload (MinIO) | ⬜ Not Started | 0% |

---

## 1. Architecture & Tech Stack

### 1.1 Monorepo Structure (Turborepo)

```
hireflow-ai/
├── apps/
│   ├── portal/          # Enterprise Console (React 19, Vite, Port 3004)
│   └── interview/       # Candidate Interface (React 19, Vite, Port 3005)
├── server/              # Backend API (Fastify, Prisma, Port 4000)
├── packages/
│   └── shared/
│       ├── i18n/        # Internationalization (zh-CN, en-US)
│       ├── types/       # Shared TypeScript types
│       ├── utils/       # Common utilities (cn, formatNumber, getGreeting)
│       └── ui/          # Shared UI components (placeholder)
├── src/                 # ⚠️ LEGACY — Pre-monorepo code (aiGateway, ruleEngine)
└── services/            # ⚠️ LEGACY — Pre-monorepo services
```

### 1.2 Tech Stack Detail

| Layer | Technology | Notes |
|:------|:-----------|:------|
| **Runtime** | Node.js 24 | LTS |
| **Frontend** | React 19 + Vite | Code-split with `lazy()` |
| **Styling** | Tailwind CSS v4 + Custom M3 Design System | `index.css` (1040+ lines) |
| **State** | Zustand (auth) + TanStack Query v5 (server) | Persist middleware for auth |
| **Forms** | React Hook Form + Zod | Schema-validated mutations |
| **Animation** | Framer Motion | Page transitions, card reveals |
| **Backend** | Fastify | HTTP + WebSocket |
| **ORM** | Prisma | PostgreSQL |
| **Database** | PostgreSQL 16 (Docker) | Port 5433 |
| **Cache** | Redis (Docker) | Port 6379, **not yet used** |
| **Storage** | MinIO (Docker) | Port 9000/9001, **not yet used** |
| **Build** | Turborepo | `npm run dev` starts all apps |

### 1.3 Core Design Principles

| # | Principle | Status |
|:--|:----------|:-------|
| 1 | **Zero Dead Buttons** — Every action triggers a real API call + UI feedback | 🟡 95% (ScreeningPage, InterviewMonitor still static) |
| 2 | **Zero Placeholders** — No "Coming Soon" screens | 🟡 ScreeningPage is static, InterviewMonitor is static |
| 3 | **Absolute Security** — API keys encrypted AES-256 in DB, never exposed to frontend | ✅ Schema ready, encryption utils exist |
| 4 | **Full Data Flow** — Auth → Fetch → Mutate → Invalidate → Toast | ✅ Implemented for all CRUD pages |
| 5 | **Google M3 Aesthetics** — Liquid Glass sidebar, de-bordered cards, Inter font | ✅ CSS design system complete |

---

## 2. Database (Prisma Schema)

### 2.1 Entity Relationship

```
Company
 ├── Users[]              # Multi-tenant user management
 ├── CompanySettings      # AI config, security, notifications, privacy
 ├── ApiKeyStore[]        # AES-256 encrypted AI provider keys
 ├── Integrations[]       # Third-party connections (Calendar, Slack, etc.)
 ├── AuditLog[]           # Security & compliance events
 ├── Jobs[]
 │    ├── Candidates[]
 │    │    └── Interviews[]
 │    │         ├── InterviewFeedback[]  # Candidate satisfaction ratings
 │    │         └── Evaluation[]         # AI or human scoring
 │    └── Interviews[]
 └── Candidates[]
```

### 2.2 Key Models & Fields

| Model | Key Fields | Notes |
|:------|:-----------|:------|
| **Company** | `name, logo, primaryColor, welcomeText` | Supports white-labeling |
| **User** | `email, name, passwordHash, role, companyId` | Roles: `owner, admin, hr_manager, interviewer, viewer` |
| **CompanySettings** | `defaultModelId, temperature, maxTokens, antiCheatEnabled, ...` | 20+ configurable fields |
| **ApiKeyStore** | `provider, encryptedKey, baseUrl, status, cachedModels` | `@@unique([companyId, provider])` |
| **Job** | `title, department, location, type, descriptionJd, requirements[], status, salaryRange(JSON), candidateCount, pipeline(JSON)` | Status: `draft, active, closed, paused` |
| **Candidate** | `name, email, phone, stage, score, skills[], verificationStatus, tags[], source, resumeUrl` | Stage: `applied → screening → interview_1 → interview_2 → offer → hired / rejected` |
| **Interview** | `token(unique), status, type, startTime, endTime, score, feedback, recordingUrl, transcriptUrl, reportUrl` | Token-based public access |
| **Evaluation** | `evaluatorId, scores(JSON), comment, vote` | Supports both human and AI evaluators (`evaluatorId = 'AI'`) |

### 2.3 Docker Compose Services

```yaml
PostgreSQL 16 Alpine  →  Port 5433:5432  (hireflow-postgres)
Redis                →  Port 6379       (hireflow-redis)    # Not yet utilized
MinIO                →  Port 9000/9001  (hireflow-minio)    # Not yet utilized
```

---

## 3. Authentication System ✅ COMPLETE

### 3.1 Flow Diagram

```
[Register/Login]
     ↓
POST /auth/login → { accessToken (15min), refreshToken (7d, HTTP-Only Cookie) }
     ↓
[Frontend stores accessToken in Zustand (localStorage persist)]
     ↓
[API requests → Axios interceptor adds Bearer token]
     ↓
[401 Error?]
     ├── YES → Auto-refresh via POST /auth/refresh (Cookie) → Retry original request
     │         Queue concurrent requests during refresh → Process queue after
     └── NO  → Continue normally
     ↓
[Refresh fails?] → Logout + redirect to /login
```

### 3.2 Auth Endpoints

| Endpoint | Method | Description |
|:---------|:-------|:------------|
| `/api/auth/register` | POST | Creates Company + User + CompanySettings → returns tokens |
| `/api/auth/login` | POST | Validates email/password → returns tokens |
| `/api/auth/refresh` | POST | Reads HTTP-Only cookie → issues new accessToken |
| `/api/auth/logout` | POST | Clears refreshToken cookie |
| `/api/auth/me` | GET | Returns current user from JWT |

### 3.3 Frontend Auth Components

| Component | Purpose |
|:----------|:--------|
| `authStore.ts` | Zustand persist store: `login(token, user)`, `logout()`, `updateUser()` |
| `api.ts` | Axios instance with request interceptor (attach token) + response interceptor (auto-refresh flow) |
| `RequireAuth.tsx` | Route guard — redirects to `/login` if not authenticated |

---

## 4. Backend API Reference

### 4.1 Complete Route Inventory

#### Core CRUD Routes

| Route | Methods | File | Auth | Description |
|:------|:--------|:-----|:-----|:------------|
| `/api/candidates` | GET, POST | `candidates.ts` | ✅ | List (search, filter, paginate) / Create candidate |
| `/api/candidates/:id` | GET, PUT, DELETE | `candidates.ts` | ✅ | Detail / Update / Delete (cascade: feedback→eval→interview) |
| `/api/candidates/:id/stage` | PUT | `candidates.ts` | ✅ | Update candidate stage only |
| `/api/jobs` | GET, POST | `jobs.ts` | ✅ | List (search, filter, paginate) / Create job |
| `/api/jobs/:id` | GET, PUT, DELETE | `jobs.ts` | ✅ | Detail (with pipeline stats) / Update / Delete (cascade) |
| `/api/interviews` | GET, POST | `interviews.ts` | ✅ | List (with candidate & job names) / Create (auto-generate token) |
| `/api/interviews/:id` | GET, PUT | `interviews.ts` | ✅ | Detail / Update |

#### Public Routes (Candidate-Facing)

| Route | Method | Auth | Description |
|:------|:-------|:-----|:------------|
| `/api/public/interview/:token` | GET | ❌ | Candidate fetches interview details by token |
| `/api/public/interview/:token/start` | POST | ❌ | Candidate starts interview session |
| `/api/public/interview/:token/end` | POST | ❌ | Candidate ends interview session |

#### Settings & Team Routes

| Route | Methods | File | Auth | RBAC | Description |
|:------|:--------|:-----|:-----|:-----|:------------|
| `/api/team` | GET | `team.ts` | ✅ | Any | List company members |
| `/api/team/:id` | PUT | `team.ts` | ✅ | Admin/Owner | Update member role |
| `/api/team/:id` | DELETE | `team.ts` | ✅ | Admin/Owner | Remove member |
| `/api/settings` | GET | `settings.ts` | ✅ | Any | Get company settings (or create defaults) |
| `/api/settings` | PUT | `settings.ts` | ✅ | Admin/Owner | Update settings (Zod validated) |

#### Analytics & System Routes

| Route | Method | File | Auth | Description |
|:------|:-------|:-----|:-----|:------------|
| `/api/analytics/overview` | GET | `analytics.ts` | ✅ | Dashboard KPIs, funnel, schedule, trends, AI cost |
| `/api/notifications` | GET | `notifications.ts` | ❌ | ⚠️ **MOCK DATA** — returns hardcoded notifications |
| `/api/notifications/:id/read` | POST | `notifications.ts` | ❌ | ⚠️ **MOCK** — marks notification as read in memory |
| `/api/ai/chat` | POST | `ai.ts` | ❌ | ⚠️ **MOCK** — returns simulated AI response |
| `/api/screening/evaluate` | POST | `ai.ts` | ❌ | ⚠️ **MOCK** — returns simulated screening result |
| `/api/ws/interview/stream` | WebSocket | `websocket.ts` | ❌ | ⚠️ **MOCK** — simulated interview Q&A via WS |
| `/api/health` | GET | `index.ts` | ❌ | Server health check |

### 4.2 API Design Patterns

- **Multi-tenancy**: All queries include `WHERE companyId = user.companyId`
- **Validation**: Zod schemas on POST/PUT bodies
- **Pagination**: `?page=1&pageSize=20` (default 20)
- **Cascade Deletions**: Delete order: InterviewFeedback → Evaluation → Interview → Candidate → Job
- **Error Handling**: `try/catch` → `reply.status(err.statusCode || 500).send({ error: err.message })`

---

## 5. Frontend — Enterprise Console (`apps/portal`)

### 5.1 Routing

```
Public Routes:
  /login           → LoginPage       (M3 styled, i18n, dark mode ready)
  /register        → RegisterPage    (M3 styled, i18n, dark mode ready)

Protected Routes (RequireAuth → Layout with sidebar):
  /                → Redirect to /dashboard
  /dashboard       → Dashboard       (KPIs, Funnel, Schedule, Trends, AI Cost)
  /candidates      → CandidatesPage  (Search, Filter, Add Modal)
  /candidates/:id  → CandidateDetailPage (Profile, Timeline, Stage, Delete)
  /jobs            → JobsPage        (Search, Create, Status Update, Delete)
  /interviews      → InterviewsPage  (Tabs, Create Modal, Copy Link)
  /screening       → ScreeningPage   ⚠️ UI-Only, no backend
  /analytics       → AnalyticsPage   (KPIs, Charts from real API)
  /team            → TeamPage        (List, Role Edit, Remove Member)
  /settings        → SettingsPage    (AI Config, Security, Notifications, Privacy)

Protected (Standalone — no sidebar):
  /interviews/:id/monitor → InterviewMonitorPage  ⚠️ Static placeholder
```

### 5.2 Page Implementation Status

| Page | API Binding | Mutations | i18n | Dark Mode | Status |
|:-----|:------------|:----------|:-----|:----------|:-------|
| **LoginPage** | `POST /auth/login` | ✅ Login | ✅ | ✅ | ✅ Complete |
| **RegisterPage** | `POST /auth/register` | ✅ Register | ✅ | ✅ | ✅ Complete |
| **Dashboard** | `GET /analytics/overview` | — | ✅ | ✅ | ✅ Complete |
| **CandidatesPage** | `GET /candidates` | ✅ Create (Modal) | ✅ | ✅ | ✅ Complete |
| **CandidateDetailPage** | `GET /candidates/:id` | ✅ Stage, Delete, Reject | ✅ | ✅ | ✅ Complete |
| **JobsPage** | `GET /jobs` | ✅ Create, Status, Delete | ✅ | ✅ | ✅ Complete |
| **InterviewsPage** | `GET /interviews` | ✅ Create (Modal), Copy Link | ✅ | ✅ | ✅ Complete |
| **AnalyticsPage** | `GET /analytics/overview` | — | ✅ | ✅ | ✅ Complete |
| **TeamPage** | `GET /team` | ✅ Role Update, Remove | ✅ | ✅ | ✅ Complete |
| **SettingsPage** | `GET/PUT /settings` | ✅ Save All | ✅ | ✅ | ✅ Complete |
| **ScreeningPage** | ❌ None | ❌ | ✅ | ✅ | 🟡 UI Only |
| **InterviewMonitorPage** | ❌ None | ❌ | ✅ | — | 🔴 Placeholder |

### 5.3 Component Inventory

```
apps/portal/src/
├── App.tsx                                    # Router, QueryClient, Toaster
├── main.tsx                                   # React 19 root render
├── index.css                                  # M3 Design System (1040+ lines)
├── components/
│   ├── Layout.tsx                             # Sidebar + Topbar + content area
│   ├── auth/RequireAuth.tsx                   # Auth route guard
│   ├── candidates/AddCandidateModal.tsx       # RHF + Zod form
│   ├── interviews/CreateInterviewModal.tsx    # RHF + Zod form
│   ├── jobs/AddJobModal.tsx                   # RHF + Zod form
│   ├── ui/EmptyState.tsx                      # Reusable empty state with SVG icons
│   └── ui/Toast.tsx                           # Sonner with M3 styling
├── hooks/
│   └── useDebounce.ts                         # 300ms debounce for search inputs
├── stores/
│   └── authStore.ts                           # Zustand persist store
├── lib/
│   └── api.ts                                 # Axios + token refresh interceptor
├── contexts/
│   └── ThemeContext.tsx                        # Light/Dark/System theme
├── data/
│   └── mockData.ts                            # ⚠️ LEGACY — no longer imported
└── pages/
    └── (12 page files)
```

### 5.4 Design System — CSS Token Architecture

The `index.css` file implements a complete Google Material 3 design system:

| Category | Key Tokens | Examples |
|:---------|:-----------|:--------|
| **Colors** (Light) | `--color-primary: #1A73E8`, `--color-surface: #FFFFFF`, `--color-error: #D93025` | 16 color tokens |
| **Colors** (Dark) | `--color-primary: #8AB4F8`, `--color-surface: #1F1F1F` | All 16 overridden in `.dark` |
| **Typography** | `text-display-large`, `text-headline-medium`, `text-body-medium`, `text-label-small` | 10 type scales |
| **Buttons** | `btn-filled`, `btn-outlined`, `btn-tonal`, `btn-text`, `btn-danger`, `btn-icon` | + `btn-lg` size variant |
| **Cards** | `card`, `card-hover`, `card-elevated` | De-bordered, shadow-based |
| **Inputs** | `input`, `input-compact`, `m3-input` | Focus: 2px primary border |
| **Chips** | `chip-primary`, `chip-success`, `chip-error`, `chip-warning`, `chip-neutral` | 5 semantic variants |
| **Sidebar** | `sidebar`, `nav-item`, `nav-item.active` | Liquid Glass blur effect |
| **Topbar** | `topbar` | Glass blur, sticky |
| **Auth Pages** | `auth-page`, `auth-card`, `auth-input`, `auth-submit`, `auth-logo` | Glassmorphism card + gradient BG |
| **Animations** | `animate-fade-in-up`, `animate-stagger`, `pulse-live` | M3 easing curves |

---

## 6. Frontend — Candidate Interface (`apps/interview`)

### 6.1 Flow

```
/:token          → LandingPage       # Welcome, verify interview token
/:token/device   → DeviceCheckPage   # Camera/mic permissions check
/:token/waiting  → WaitingRoomPage   # Countdown/preparation
/:token/room     → InterviewRoomPage # AI interview session (WebSocket)
/:token/complete → CompletePage      # Thank you, feedback
```

### 6.2 Current Status: 🟡 UI Scaffolded, No Real Integration

- Pages exist with visual layouts but **no real API integration**
- `InterviewRoomPage` references WebSocket but uses mock connection
- No WebRTC audio/video capture implemented
- No speech-to-text integration
- This is the **highest-value work remaining**

---

## 7. AI Services Layer (Pre-Integration)

### 7.1 AI Gateway (`src/services/ai/aiGateway.ts`) — ⚠️ LEGACY LOCATION

A fully-implemented **multi-provider AI gateway** with:

| Provider | Models | Implementation |
|:---------|:-------|:---------------|
| **Gemini** | `gemini-2.5-pro`, `gemini-2.5-flash` | ✅ `@google/genai` SDK |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | ✅ REST API (`fetch`) |
| **Claude** | `claude-sonnet-4`, `claude-opus-4` | ✅ REST API (`fetch`) |
| **Local** | Any OpenAI-compatible (Ollama, vLLM) | ✅ Generic endpoint |
| **Mock** | `mock-model` | ✅ Simulated responses |

**Key Features**:
- Singleton pattern (`AIGateway.getInstance()`)
- Automatic **fallback** to MockProvider on primary failure
- Per-call **logging** with latency, token usage, cost estimate
- **Usage stats** aggregation (`getUsageStats()`)
- Dynamic **provider switching** (`setProvider(model, config)`)

**⚠️ Problem**: This file is in `src/services/`, which is the **legacy pre-monorepo location**. It needs to be migrated to `server/src/services/` and integrated with the Fastify routes.

### 7.2 Rule Engine (`src/services/rules/ruleEngine.ts`) — ⚠️ LEGACY LOCATION

A complete **resume screening rule engine** with:
- **DSL support**: AND / OR / NOT group logic
- **10 operators**: EQUALS, NOT_EQUALS, GTE, LTE, GT, LT, CONTAINS, NOT_CONTAINS, IN, BETWEEN, REGEX
- **Nested access**: `experience.years` dot-path resolution
- **Match scoring**: `calculateMatchScore()` returns 0-100
- **Templates**: Senior Engineer, Product Manager, Data Scientist presets

**⚠️ Same migration issue** — needs to move to `server/` and expose via REST API.

---

## 8. Known Issues & Technical Debt

### 8.1 Critical Issues (Blocking Production)

| # | Issue | Severity | Location | Details |
|:--|:------|:---------|:---------|:--------|
| 1 | **AI routes are mock** | 🔴 Critical | `server/src/routes/ai.ts` | `/ai/chat` and `/screening/evaluate` return hardcoded responses |
| 2 | **WebSocket is mock** | 🔴 Critical | `server/src/routes/websocket.ts` | Interview streaming returns scripted responses |
| 3 | **Notification routes use mock data** | 🟠 High | `server/src/routes/notifications.ts` | Imports from `../data` (in-memory MOCK_NOTIFICATIONS) |
| 4 | **No file upload** | 🟠 High | — | MinIO is provisioned but no upload routes exist. Candidate `resumeUrl` is always null |
| 5 | **Legacy code in `/src`** | 🟠 High | `src/services/`, `src/pages/` | AI Gateway and Rule Engine live outside the monorepo structure |
| 6 | **`mockData.ts` still exists** | 🟡 Low | `apps/portal/src/data/mockData.ts` | File is no longer imported but should be deleted |
| 7 | **`dailyMetrics` and `aiCost` are mocked** | 🟡 Medium | `server/src/routes/analytics.ts` | Need real historical aggregation queries |

### 8.2 Frontend Issues

| # | Issue | Severity | Details |
|:--|:------|:---------|:--------|
| 1 | **ScreeningPage is static** | 🟠 High | Rule builder UI exists but buttons do nothing (no API backend) |
| 2 | **InterviewMonitorPage is static** | 🟠 High | Hardcoded transcript/scores, no WebSocket connection |
| 3 | **Layout uses hardcoded user** | 🟡 Medium | `Layout.tsx:42` has `const currentUser = { name: '张通', role: 'HR 经理' }` instead of reading from authStore |
| 4 | **No logout action** | 🟡 Medium | Logout button in Layout dropdown doesn't call `authStore.logout()` |
| 5 | **Root `/src` has duplicate pages** | 🟡 Low | `src/pages/` has 7 old page files that may confuse developers |
| 6 | **No loading spinner for toast** | 🟡 Low | Mutations show spinner in button but no toast during loading |

### 8.3 Backend Issues

| # | Issue | Severity | Details |
|:--|:------|:---------|:--------|
| 1 | **No rate limiting** | 🟠 High | Auth endpoints have no throttle — vulnerable to brute force |
| 2 | **No input sanitization** | 🟡 Medium | User inputs go directly to Prisma (Prisma sanitizes SQL but XSS is possible) |
| 3 | **No CORS restriction for production** | 🟡 Medium | CORS allows `localhost:3000-3005` — needs env-based configuration |
| 4 | **Redis not utilized** | 🟡 Low | Provisioned in Docker but not used for sessions, caching, or rate limits |
| 5 | **Analytics groupBy type cast** | 🟡 Low | `analytics.ts:71` uses `as any` for Prisma groupBy `_count` access |
| 6 | **No Prisma `onDelete: Cascade`** | 🟡 Low | Cascade deletions are manual in route handlers — should be in schema |

---

## 9. Roadmap — From MVP to Production

### Phase 5: AI Integration (HIGHEST PRIORITY) 🔴

**Goal**: Connect the AI Gateway to the backend routes, enabling real AI-powered features.

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 5.1 Migrate AI Gateway | 🔴 P0 | 2h | Move `src/services/ai/aiGateway.ts` → `server/src/services/aiGateway.ts` |
| 5.2 API Key Management UI | 🔴 P0 | 4h | SettingsPage → AI tab: add/test/delete provider keys. Backend: encrypt with AES-256 and store in `ApiKeyStore` |
| 5.3 Real `/ai/chat` Route | 🔴 P0 | 3h | Integrate AIGateway with `/ai/chat`. Load provider key from DB → decrypt → generate → return |
| 5.4 AI Resume Evaluation | 🔴 P0 | 4h | `/screening/evaluate` → accept candidateId, load resume/skills, run through RuleEngine + LLM for scoring |
| 5.5 AI Interview Questions | 🟠 P1 | 4h | Given JD + candidate profile → generate tailored interview questions |
| 5.6 AI Interview Report | 🟠 P1 | 4h | Post-interview → generate comprehensive evaluation report → save as `reportUrl` |

### Phase 6: Real-Time Interview System 🔴

**Goal**: Enable actual AI-driven interviews with audio/video.

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 6.1 WebRTC Audio Capture | 🔴 P0 | 6h | `InterviewRoomPage` → capture microphone → stream to server |
| 6.2 Speech-to-Text (STT) | 🔴 P0 | 4h | Server-side STT (Whisper API or browser Web Speech API) → real transcript |
| 6.3 Text-to-Speech (TTS) | 🟠 P1 | 3h | AI-generated questions → TTS → play audio to candidate |
| 6.4 Real WebSocket Protocol | 🔴 P0 | 4h | Define message protocol: `AUDIO_CHUNK`, `TRANSCRIPT`, `AI_QUESTION`, `AI_SCORE_UPDATE` |
| 6.5 interview App API Binding | 🔴 P0 | 4h | Connect `apps/interview` pages to real `/public/interview/:token` endpoints |
| 6.6 Recording Storage | 🟠 P1 | 2h | Upload interview recordings to MinIO → store URL in Interview record |
| 6.7 Live Monitor Page | 🟠 P1 | 4h | HR-side `InterviewMonitorPage` → real-time transcript + AI scores via WS |

### Phase 7: Feature Completion 🟡

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 7.1 Screening Backend | 🟠 P1 | 4h | CRUD API for screening rules. Store rules in DB, expose `/screening/rules` endpoints |
| 7.2 Connect ScreeningPage | 🟠 P1 | 3h | Wire rule builder to backend, enable save/load/execute templates |
| 7.3 Notification System (Real) | 🟠 P1 | 3h | Replace mock data with Prisma-based notifications. Create on events (new candidate, interview complete) |
| 7.4 File Upload (Resume) | 🟠 P1 | 3h | MinIO integration for candidate resume upload. Multer middleware → MinIO → store URL |
| 7.5 Candidate Detail — Edit Mode | 🟡 P2 | 2h | Edit candidate profile fields inline (name, email, skills, tags) |
| 7.6 Job Detail Page | 🟡 P2 | 3h | Dedicated job detail page with candidate list, pipeline view, edit form |
| 7.7 Dashboard Real-Time Data | 🟡 P2 | 2h | Replace mocked `dailyMetrics` and `aiCost` with real aggregation queries |

### Phase 8: Security & Production Hardening 🟡

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 8.1 Rate Limiting | 🟠 P1 | 1h | `fastify-rate-limit` on auth routes (5 attempts/min for login) |
| 8.2 Input Sanitization | 🟠 P1 | 2h | XSS protection via `DOMPurify` or `sanitize-html` for user-generated content |
| 8.3 Audit Logging | 🟡 P2 | 2h | Log critical actions to `AuditLog` model (stage changes, deletions, settings updates) |
| 8.4 CORS Configuration | 🟡 P2 | 0.5h | Make CORS origins configurable via environment variables |
| 8.5 Prisma Cascade Config | 🟡 P2 | 1h | Add `onDelete: Cascade` to schema relations to simplify route handlers |
| 8.6 Redis Caching | 🟡 P2 | 2h | Cache analytics overview (TTL 5min), session blacklist for logout |
| 8.7 Environment Variables | 🟡 P2 | 1h | Replace hardcoded `localhost:4000` in `api.ts` with `VITE_API_URL` env variable |

### Phase 9: Code Quality & Cleanup 🟢

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 9.1 Delete `mockData.ts` | 🟢 P3 | 0.1h | `rm apps/portal/src/data/mockData.ts` |
| 9.2 Fix Layout hardcoded user | 🟢 P3 | 0.5h | Replace `Layout.tsx:42` mock user with `useAuthStore().user` |
| 9.3 Wire logout button | 🟢 P3 | 0.5h | Call `authStore.logout()` + `navigate('/login')` on click |
| 9.4 Remove legacy `/src` | 🟢 P3 | 1h | After migrating AI Gateway + Rule Engine to `server/`, delete old `src/` folder |
| 9.5 Fix `as any` casts | 🟢 P3 | 0.5h | ✅ Dashboard fixed. Analytics groupBy still needs fix. |
| 9.6 Notification bell (real data) | 🟢 P3 | 1h | Layout notification dropdown → fetch from `/notifications` with unread count |

---

## 1. Architecture & Tech Stack

### 1.1 Monorepo Structure (Turborepo)

```
hireflow-ai/
├── apps/
│   ├── portal/          # Enterprise Console (React 19, Vite, Port 3004)
│   └── interview/       # Candidate Interface (React 19, Vite, Port 3005)
├── server/              # Backend API (Fastify, Prisma, Port 4000)
├── packages/
│   └── shared/
│       ├── i18n/        # Internationalization (zh-CN, en-US)
│       ├── types/       # Shared TypeScript types
│       ├── utils/       # Common utilities (cn, formatNumber, getGreeting)
│       └── ui/          # Shared UI components (placeholder)
├── src/                 # ⚠️ LEGACY — Pre-monorepo code (aiGateway, ruleEngine)
└── services/            # ⚠️ LEGACY — Pre-monorepo services
```

### 1.2 Tech Stack Detail

| Layer | Technology | Notes |
|:------|:-----------|:------|
| **Runtime** | Node.js 24 | LTS |
| **Frontend** | React 19 + Vite | Code-split with `lazy()` |
| **Styling** | Tailwind CSS v4 + Custom M3 Design System | `index.css` (1040+ lines) |
| **State** | Zustand (auth) + TanStack Query v5 (server) | Persist middleware for auth |
| **Forms** | React Hook Form + Zod | Schema-validated mutations |
| **Animation** | Framer Motion | Page transitions, card reveals |
| **Backend** | Fastify | HTTP + WebSocket |
| **ORM** | Prisma | PostgreSQL |
| **Database** | PostgreSQL 16 (Docker) | Port 5433 |
| **Cache** | Redis (Docker) | Port 6379, **not yet used** |
| **Storage** | MinIO (Docker) | Port 9000/9001, **not yet used** |
| **Build** | Turborepo | `npm run dev` starts all apps |

### 1.3 Core Design Principles

| # | Principle | Status |
|:--|:----------|:-------|
| 1 | **Zero Dead Buttons** — Every action triggers a real API call + UI feedback | 🟡 95% (ScreeningPage, InterviewMonitor still static) |
| 2 | **Zero Placeholders** — No "Coming Soon" screens | 🟡 ScreeningPage is static, InterviewMonitor is static |
| 3 | **Absolute Security** — API keys encrypted AES-256 in DB, never exposed to frontend | ✅ Schema ready, encryption utils exist |
| 4 | **Full Data Flow** — Auth → Fetch → Mutate → Invalidate → Toast | ✅ Implemented for all CRUD pages |
| 5 | **Google M3 Aesthetics** — Liquid Glass sidebar, de-bordered cards, Inter font | ✅ CSS design system complete |

---

## 2. Database (Prisma Schema)

### 2.1 Entity Relationship

```
Company
 ├── Users[]              # Multi-tenant user management
 ├── CompanySettings      # AI config, security, notifications, privacy
 ├── ApiKeyStore[]        # AES-256 encrypted AI provider keys
 ├── Integrations[]       # Third-party connections (Calendar, Slack, etc.)
 ├── AuditLog[]           # Security & compliance events
 ├── Jobs[]
 │    ├── Candidates[]
 │    │    └── Interviews[]
 │    │         ├── InterviewFeedback[]  # Candidate satisfaction ratings
 │    │         └── Evaluation[]         # AI or human scoring
 │    └── Interviews[]
 └── Candidates[]
```

### 2.2 Key Models & Fields

| Model | Key Fields | Notes |
|:------|:-----------|:------|
| **Company** | `name, logo, primaryColor, welcomeText` | Supports white-labeling |
| **User** | `email, name, passwordHash, role, companyId` | Roles: `owner, admin, hr_manager, interviewer, viewer` |
| **CompanySettings** | `defaultModelId, temperature, maxTokens, antiCheatEnabled, ...` | 20+ configurable fields |
| **ApiKeyStore** | `provider, encryptedKey, baseUrl, status, cachedModels` | `@@unique([companyId, provider])` |
| **Job** | `title, department, location, type, descriptionJd, requirements[], status, salaryRange(JSON), candidateCount, pipeline(JSON)` | Status: `draft, active, closed, paused` |
| **Candidate** | `name, email, phone, stage, score, skills[], verificationStatus, tags[], source, resumeUrl` | Stage: `applied → screening → interview_1 → interview_2 → offer → hired / rejected` |
| **Interview** | `token(unique), status, type, startTime, endTime, score, feedback, recordingUrl, transcriptUrl, reportUrl` | Token-based public access |
| **Evaluation** | `evaluatorId, scores(JSON), comment, vote` | Supports both human and AI evaluators (`evaluatorId = 'AI'`) |

### 2.3 Docker Compose Services

```yaml
PostgreSQL 16 Alpine  →  Port 5433:5432  (hireflow-postgres)
Redis                →  Port 6379       (hireflow-redis)    # Not yet utilized
MinIO                →  Port 9000/9001  (hireflow-minio)    # Not yet utilized
```

---

## 3. Authentication System ✅ COMPLETE

### 3.1 Flow Diagram

```
[Register/Login]
     ↓
POST /auth/login → { accessToken (15min), refreshToken (7d, HTTP-Only Cookie) }
     ↓
[Frontend stores accessToken in Zustand (localStorage persist)]
     ↓
[API requests → Axios interceptor adds Bearer token]
     ↓
[401 Error?]
     ├── YES → Auto-refresh via POST /auth/refresh (Cookie) → Retry original request
     │         Queue concurrent requests during refresh → Process queue after
     └── NO  → Continue normally
     ↓
[Refresh fails?] → Logout + redirect to /login
```

### 3.2 Auth Endpoints

| Endpoint | Method | Description |
|:---------|:-------|:------------|
| `/api/auth/register` | POST | Creates Company + User + CompanySettings → returns tokens |
| `/api/auth/login` | POST | Validates email/password → returns tokens |
| `/api/auth/refresh` | POST | Reads HTTP-Only cookie → issues new accessToken |
| `/api/auth/logout` | POST | Clears refreshToken cookie |
| `/api/auth/me` | GET | Returns current user from JWT |

### 3.3 Frontend Auth Components

| Component | Purpose |
|:----------|:--------|
| `authStore.ts` | Zustand persist store: `login(token, user)`, `logout()`, `updateUser()` |
| `api.ts` | Axios instance with request interceptor (attach token) + response interceptor (auto-refresh flow) |
| `RequireAuth.tsx` | Route guard — redirects to `/login` if not authenticated |

---

## 4. Backend API Reference

### 4.1 Complete Route Inventory

#### Core CRUD Routes

| Route | Methods | File | Auth | Description |
|:------|:--------|:-----|:-----|:------------|
| `/api/candidates` | GET, POST | `candidates.ts` | ✅ | List (search, filter, paginate) / Create candidate |
| `/api/candidates/:id` | GET, PUT, DELETE | `candidates.ts` | ✅ | Detail / Update / Delete (cascade: feedback→eval→interview) |
| `/api/candidates/:id/stage` | PUT | `candidates.ts` | ✅ | Update candidate stage only |
| `/api/jobs` | GET, POST | `jobs.ts` | ✅ | List (search, filter, paginate) / Create job |
| `/api/jobs/:id` | GET, PUT, DELETE | `jobs.ts` | ✅ | Detail (with pipeline stats) / Update / Delete (cascade) |
| `/api/interviews` | GET, POST | `interviews.ts` | ✅ | List (with candidate & job names) / Create (auto-generate token) |
| `/api/interviews/:id` | GET, PUT | `interviews.ts` | ✅ | Detail / Update |

#### Public Routes (Candidate-Facing)

| Route | Method | Auth | Description |
|:------|:-------|:-----|:------------|
| `/api/public/interview/:token` | GET | ❌ | Candidate fetches interview details by token |
| `/api/public/interview/:token/start` | POST | ❌ | Candidate starts interview session |
| `/api/public/interview/:token/end` | POST | ❌ | Candidate ends interview session |

#### Settings & Team Routes

| Route | Methods | File | Auth | RBAC | Description |
|:------|:--------|:-----|:-----|:-----|:------------|
| `/api/team` | GET | `team.ts` | ✅ | Any | List company members |
| `/api/team/:id` | PUT | `team.ts` | ✅ | Admin/Owner | Update member role |
| `/api/team/:id` | DELETE | `team.ts` | ✅ | Admin/Owner | Remove member |
| `/api/settings` | GET | `settings.ts` | ✅ | Any | Get company settings (or create defaults) |
| `/api/settings` | PUT | `settings.ts` | ✅ | Admin/Owner | Update settings (Zod validated) |

#### Analytics & System Routes

| Route | Method | File | Auth | Description |
|:------|:-------|:-----|:-----|:------------|
| `/api/analytics/overview` | GET | `analytics.ts` | ✅ | Dashboard KPIs, funnel, schedule, trends, AI cost |
| `/api/notifications` | GET | `notifications.ts` | ❌ | ⚠️ **MOCK DATA** — returns hardcoded notifications |
| `/api/notifications/:id/read` | POST | `notifications.ts` | ❌ | ⚠️ **MOCK** — marks notification as read in memory |
| `/api/ai/chat` | POST | `ai.ts` | ❌ | ⚠️ **MOCK** — returns simulated AI response |
| `/api/screening/evaluate` | POST | `ai.ts` | ❌ | ⚠️ **MOCK** — returns simulated screening result |
| `/api/ws/interview/stream` | WebSocket | `websocket.ts` | ❌ | ⚠️ **MOCK** — simulated interview Q&A via WS |
| `/api/health` | GET | `index.ts` | ❌ | Server health check |

### 4.2 API Design Patterns

- **Multi-tenancy**: All queries include `WHERE companyId = user.companyId`
- **Validation**: Zod schemas on POST/PUT bodies
- **Pagination**: `?page=1&pageSize=20` (default 20)
- **Cascade Deletions**: Delete order: InterviewFeedback → Evaluation → Interview → Candidate → Job
- **Error Handling**: `try/catch` → `reply.status(err.statusCode || 500).send({ error: err.message })`

---

## 5. Frontend — Enterprise Console (`apps/portal`)

### 5.1 Routing

```
Public Routes:
  /login           → LoginPage       (M3 styled, i18n, dark mode ready)
  /register        → RegisterPage    (M3 styled, i18n, dark mode ready)

Protected Routes (RequireAuth → Layout with sidebar):
  /                → Redirect to /dashboard
  /dashboard       → Dashboard       (KPIs, Funnel, Schedule, Trends, AI Cost)
  /candidates      → CandidatesPage  (Search, Filter, Add Modal)
  /candidates/:id  → CandidateDetailPage (Profile, Timeline, Stage, Delete)
  /jobs            → JobsPage        (Search, Create, Status Update, Delete)
  /interviews      → InterviewsPage  (Tabs, Create Modal, Copy Link)
  /screening       → ScreeningPage   ⚠️ UI-Only, no backend
  /analytics       → AnalyticsPage   (KPIs, Charts from real API)
  /team            → TeamPage        (List, Role Edit, Remove Member)
  /settings        → SettingsPage    (AI Config, Security, Notifications, Privacy)

Protected (Standalone — no sidebar):
  /interviews/:id/monitor → InterviewMonitorPage  ⚠️ Static placeholder
```

### 5.2 Page Implementation Status

| Page | API Binding | Mutations | i18n | Dark Mode | Status |
|:-----|:------------|:----------|:-----|:----------|:-------|
| **LoginPage** | `POST /auth/login` | ✅ Login | ✅ | ✅ | ✅ Complete |
| **RegisterPage** | `POST /auth/register` | ✅ Register | ✅ | ✅ | ✅ Complete |
| **Dashboard** | `GET /analytics/overview` | — | ✅ | ✅ | ✅ Complete |
| **CandidatesPage** | `GET /candidates` | ✅ Create (Modal) | ✅ | ✅ | ✅ Complete |
| **CandidateDetailPage** | `GET /candidates/:id` | ✅ Stage, Delete, Reject | ✅ | ✅ | ✅ Complete |
| **JobsPage** | `GET /jobs` | ✅ Create, Status, Delete | ✅ | ✅ | ✅ Complete |
| **InterviewsPage** | `GET /interviews` | ✅ Create (Modal), Copy Link | ✅ | ✅ | ✅ Complete |
| **AnalyticsPage** | `GET /analytics/overview` | — | ✅ | ✅ | ✅ Complete |
| **TeamPage** | `GET /team` | ✅ Role Update, Remove | ✅ | ✅ | ✅ Complete |
| **SettingsPage** | `GET/PUT /settings` | ✅ Save All | ✅ | ✅ | ✅ Complete |
| **ScreeningPage** | ❌ None | ❌ | ✅ | ✅ | 🟡 UI Only |
| **InterviewMonitorPage** | ❌ None | ❌ | ✅ | — | 🔴 Placeholder |

### 5.3 Component Inventory

```
apps/portal/src/
├── App.tsx                                    # Router, QueryClient, Toaster
├── main.tsx                                   # React 19 root render
├── index.css                                  # M3 Design System (1040+ lines)
├── components/
│   ├── Layout.tsx                             # Sidebar + Topbar + content area
│   ├── auth/RequireAuth.tsx                   # Auth route guard
│   ├── candidates/AddCandidateModal.tsx       # RHF + Zod form
│   ├── interviews/CreateInterviewModal.tsx    # RHF + Zod form
│   ├── jobs/AddJobModal.tsx                   # RHF + Zod form
│   └── ui/Toast.tsx                           # Sonner with M3 styling
├── hooks/
│   └── useDebounce.ts                         # 300ms debounce for search inputs
├── stores/
│   └── authStore.ts                           # Zustand persist store
├── lib/
│   └── api.ts                                 # Axios + token refresh interceptor
├── contexts/
│   └── ThemeContext.tsx                        # Light/Dark/System theme
├── data/
│   └── mockData.ts                            # ⚠️ LEGACY — no longer imported
└── pages/
    └── (12 page files)
```

### 5.4 Design System — CSS Token Architecture

The `index.css` file implements a complete Google Material 3 design system:

| Category | Key Tokens | Examples |
|:---------|:-----------|:--------|
| **Colors** (Light) | `--color-primary: #1A73E8`, `--color-surface: #FFFFFF`, `--color-error: #D93025` | 16 color tokens |
| **Colors** (Dark) | `--color-primary: #8AB4F8`, `--color-surface: #1F1F1F` | All 16 overridden in `.dark` |
| **Typography** | `text-display-large`, `text-headline-medium`, `text-body-medium`, `text-label-small` | 10 type scales |
| **Buttons** | `btn-filled`, `btn-outlined`, `btn-tonal`, `btn-text`, `btn-danger`, `btn-icon` | + `btn-lg` size variant |
| **Cards** | `card`, `card-hover`, `card-elevated` | De-bordered, shadow-based |
| **Inputs** | `input`, `input-compact` | Focus: 2px primary border |
| **Chips** | `chip-primary`, `chip-success`, `chip-error`, `chip-warning`, `chip-neutral` | 5 semantic variants |
| **Sidebar** | `sidebar`, `nav-item`, `nav-item.active` | Liquid Glass blur effect |
| **Topbar** | `topbar` | Glass blur, sticky |
| **Auth Pages** | `auth-page`, `auth-card`, `auth-input`, `auth-submit`, `auth-logo` | Glassmorphism card + gradient BG |
| **Animations** | `animate-fade-in-up`, `animate-stagger`, `pulse-live` | M3 easing curves |

---

## 6. Frontend — Candidate Interface (`apps/interview`)

### 6.1 Flow

```
/:token          → LandingPage       # Welcome, verify interview token
/:token/device   → DeviceCheckPage   # Camera/mic permissions check
/:token/waiting  → WaitingRoomPage   # Countdown/preparation
/:token/room     → InterviewRoomPage # AI interview session (WebSocket)
/:token/complete → CompletePage      # Thank you, feedback
```

### 6.2 Current Status: 🟡 UI Scaffolded, No Real Integration

- Pages exist with visual layouts but **no real API integration**
- `InterviewRoomPage` references WebSocket but uses mock connection
- No WebRTC audio/video capture implemented
- No speech-to-text integration
- This is the **highest-value work remaining**

---

## 7. AI Services Layer (Pre-Integration)

### 7.1 AI Gateway (`src/services/ai/aiGateway.ts`) — ⚠️ LEGACY LOCATION

A fully-implemented **multi-provider AI gateway** with:

| Provider | Models | Implementation |
|:---------|:-------|:---------------|
| **Gemini** | `gemini-2.5-pro`, `gemini-2.5-flash` | ✅ `@google/genai` SDK |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | ✅ REST API (`fetch`) |
| **Claude** | `claude-sonnet-4`, `claude-opus-4` | ✅ REST API (`fetch`) |
| **Local** | Any OpenAI-compatible (Ollama, vLLM) | ✅ Generic endpoint |
| **Mock** | `mock-model` | ✅ Simulated responses |

**Key Features**:
- Singleton pattern (`AIGateway.getInstance()`)
- Automatic **fallback** to MockProvider on primary failure
- Per-call **logging** with latency, token usage, cost estimate
- **Usage stats** aggregation (`getUsageStats()`)
- Dynamic **provider switching** (`setProvider(model, config)`)

**⚠️ Problem**: This file is in `src/services/`, which is the **legacy pre-monorepo location**. It needs to be migrated to `server/src/services/` and integrated with the Fastify routes.

### 7.2 Rule Engine (`src/services/rules/ruleEngine.ts`) — ⚠️ LEGACY LOCATION

A complete **resume screening rule engine** with:
- **DSL support**: AND / OR / NOT group logic
- **10 operators**: EQUALS, NOT_EQUALS, GTE, LTE, GT, LT, CONTAINS, NOT_CONTAINS, IN, BETWEEN, REGEX
- **Nested access**: `experience.years` dot-path resolution
- **Match scoring**: `calculateMatchScore()` returns 0-100
- **Templates**: Senior Engineer, Product Manager, Data Scientist presets

**⚠️ Same migration issue** — needs to move to `server/` and expose via REST API.

---

## 8. Known Issues & Technical Debt

### 8.1 Critical Issues (Blocking Production)

| # | Issue | Severity | Location | Details |
|:--|:------|:---------|:---------|:--------|
| 1 | **AI routes are mock** | 🔴 Critical | `server/src/routes/ai.ts` | `/ai/chat` and `/screening/evaluate` return hardcoded responses |
| 2 | **WebSocket is mock** | 🔴 Critical | `server/src/routes/websocket.ts` | Interview streaming returns scripted responses |
| 3 | **Notification routes use mock data** | 🟠 High | `server/src/routes/notifications.ts` | Imports from `../data` (in-memory MOCK_NOTIFICATIONS) |
| 4 | **No file upload** | 🟠 High | — | MinIO is provisioned but no upload routes exist. Candidate `resumeUrl` is always null |
| 5 | **Legacy code in `/src`** | 🟠 High | `src/services/`, `src/pages/` | AI Gateway and Rule Engine live outside the monorepo structure |
| 6 | **`mockData.ts` still exists** | 🟡 Low | `apps/portal/src/data/mockData.ts` | File is no longer imported but should be deleted |
| 7 | **`dailyMetrics` and `aiCost` are mocked** | 🟡 Medium | `server/src/routes/analytics.ts` | Need real historical aggregation queries |

### 8.2 Frontend Issues

| # | Issue | Severity | Details |
|:--|:------|:---------|:--------|
| 1 | **ScreeningPage is static** | 🟠 High | Rule builder UI exists but buttons do nothing (no API backend) |
| 2 | **InterviewMonitorPage is static** | 🟠 High | Hardcoded transcript/scores, no WebSocket connection |
| 3 | **Layout uses hardcoded user** | 🟡 Medium | `Layout.tsx:42` has `const currentUser = { name: '张通', role: 'HR 经理' }` instead of reading from authStore |
| 4 | **No logout action** | 🟡 Medium | Logout button in Layout dropdown doesn't call `authStore.logout()` |
| 5 | **Root `/src` has duplicate pages** | 🟡 Low | `src/pages/` has 7 old page files that may confuse developers |
| 6 | **Framer Motion Variants type** | 🟡 Low | `Dashboard.tsx:26` uses `as any` for cardVariants typing |
| 7 | **No loading spinner for toast** | 🟡 Low | Mutations show spinner in button but no toast during loading |

### 8.3 Backend Issues

| # | Issue | Severity | Details |
|:--|:------|:---------|:--------|
| 1 | **No rate limiting** | 🟠 High | Auth endpoints have no throttle — vulnerable to brute force |
| 2 | **No input sanitization** | 🟡 Medium | User inputs go directly to Prisma (Prisma sanitizes SQL but XSS is possible) |
| 3 | **No CORS restriction for production** | 🟡 Medium | CORS allows `localhost:3000-3005` — needs env-based configuration |
| 4 | **Redis not utilized** | 🟡 Low | Provisioned in Docker but not used for sessions, caching, or rate limits |
| 5 | **Analytics groupBy type cast** | 🟡 Low | `analytics.ts:71` uses `as any` for Prisma groupBy `_count` access |
| 6 | **No Prisma `onDelete: Cascade`** | 🟡 Low | Cascade deletions are manual in route handlers — should be in schema |

---

## 9. Roadmap — From MVP to Production

### Phase 5: AI Integration (HIGHEST PRIORITY) 🔴

**Goal**: Connect the AI Gateway to the backend routes, enabling real AI-powered features.

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 5.1 Migrate AI Gateway | 🔴 P0 | 2h | Move `src/services/ai/aiGateway.ts` → `server/src/services/aiGateway.ts` |
| 5.2 API Key Management UI | 🔴 P0 | 4h | SettingsPage → AI tab: add/test/delete provider keys. Backend: encrypt with AES-256 and store in `ApiKeyStore` |
| 5.3 Real `/ai/chat` Route | 🔴 P0 | 3h | Integrate AIGateway with `/ai/chat`. Load provider key from DB → decrypt → generate → return |
| 5.4 AI Resume Evaluation | 🔴 P0 | 4h | `/screening/evaluate` → accept candidateId, load resume/skills, run through RuleEngine + LLM for scoring |
| 5.5 AI Interview Questions | 🟠 P1 | 4h | Given JD + candidate profile → generate tailored interview questions |
| 5.6 AI Interview Report | 🟠 P1 | 4h | Post-interview → generate comprehensive evaluation report → save as `reportUrl` |

### Phase 6: Real-Time Interview System 🔴

**Goal**: Enable actual AI-driven interviews with audio/video.

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 6.1 WebRTC Audio Capture | 🔴 P0 | 6h | `InterviewRoomPage` → capture microphone → stream to server |
| 6.2 Speech-to-Text (STT) | 🔴 P0 | 4h | Server-side STT (Whisper API or browser Web Speech API) → real transcript |
| 6.3 Text-to-Speech (TTS) | 🟠 P1 | 3h | AI-generated questions → TTS → play audio to candidate |
| 6.4 Real WebSocket Protocol | 🔴 P0 | 4h | Define message protocol: `AUDIO_CHUNK`, `TRANSCRIPT`, `AI_QUESTION`, `AI_SCORE_UPDATE` |
| 6.5 interview App API Binding | 🔴 P0 | 4h | Connect `apps/interview` pages to real `/public/interview/:token` endpoints |
| 6.6 Recording Storage | 🟠 P1 | 2h | Upload interview recordings to MinIO → store URL in Interview record |
| 6.7 Live Monitor Page | 🟠 P1 | 4h | HR-side `InterviewMonitorPage` → real-time transcript + AI scores via WS |

### Phase 7: Feature Completion 🟡

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 7.1 Screening Backend | 🟠 P1 | 4h | CRUD API for screening rules. Store rules in DB, expose `/screening/rules` endpoints |
| 7.2 Connect ScreeningPage | 🟠 P1 | 3h | Wire rule builder to backend, enable save/load/execute templates |
| 7.3 Notification System (Real) | 🟠 P1 | 3h | Replace mock data with Prisma-based notifications. Create on events (new candidate, interview complete) |
| 7.4 File Upload (Resume) | 🟠 P1 | 3h | MinIO integration for candidate resume upload. Multer middleware → MinIO → store URL |
| 7.5 Candidate Detail — Edit Mode | 🟡 P2 | 2h | Edit candidate profile fields inline (name, email, skills, tags) |
| 7.6 Job Detail Page | 🟡 P2 | 3h | Dedicated job detail page with candidate list, pipeline view, edit form |
| 7.7 Dashboard Real-Time Data | 🟡 P2 | 2h | Replace mocked `dailyMetrics` and `aiCost` with real aggregation queries |

### Phase 8: Security & Production Hardening 🟡

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 8.1 Rate Limiting | 🟠 P1 | 1h | `fastify-rate-limit` on auth routes (5 attempts/min for login) |
| 8.2 Input Sanitization | 🟠 P1 | 2h | XSS protection via `DOMPurify` or `sanitize-html` for user-generated content |
| 8.3 Audit Logging | 🟡 P2 | 2h | Log critical actions to `AuditLog` model (stage changes, deletions, settings updates) |
| 8.4 CORS Configuration | 🟡 P2 | 0.5h | Make CORS origins configurable via environment variables |
| 8.5 Prisma Cascade Config | 🟡 P2 | 1h | Add `onDelete: Cascade` to schema relations to simplify route handlers |
| 8.6 Redis Caching | 🟡 P2 | 2h | Cache analytics overview (TTL 5min), session blacklist for logout |
| 8.7 Environment Variables | 🟡 P2 | 1h | Replace hardcoded `localhost:4000` in `api.ts` with `VITE_API_URL` env variable |

### Phase 9: Code Quality & Cleanup 🟢

| Task | Priority | Effort | Description |
|:-----|:---------|:-------|:------------|
| 9.1 Delete `mockData.ts` | 🟢 P3 | 0.1h | `rm apps/portal/src/data/mockData.ts` |
| 9.2 Fix Layout hardcoded user | 🟢 P3 | 0.5h | Replace `Layout.tsx:42` mock user with `useAuthStore().user` |
| 9.3 Wire logout button | 🟢 P3 | 0.5h | Call `authStore.logout()` + `navigate('/login')` on click |
| 9.4 Remove legacy `/src` | 🟢 P3 | 1h | After migrating AI Gateway + Rule Engine to `server/`, delete old `src/` folder |
| 9.5 Fix `as any` casts | 🟢 P3 | 1h | Dashboard cardVariants, analytics groupBy — add proper types |
| 9.6 Notification bell (real data) | 🟢 P3 | 1h | Layout notification dropdown → fetch from `/notifications` with unread count |

---

## 10. New Feature Ideas & Product Vision

### 10.1 Short-Term Wins (1-2 Sprints)

| Feature | Value | Effort | Description |
|:--------|:------|:-------|:------------|
| **AI Interview Summary Email** | 🔥 High | 3h | After interview → LLM generates summary → email to HR with pass/fail recommendation |
| **Candidate Kanban Board** | 🔥 High | 4h | Drag-and-drop pipeline view in CandidatesPage (already have stage data) |
| **Batch Actions** | 🟠 Medium | 2h | Multi-select candidates → batch move to next stage / reject / delete |
| **Interview Calendar View** | 🟠 Medium | 3h | Replace interview list with calendar grid (weekly/monthly view) |
| **Dark Mode Polish** | 🟡 Low | 2h | Audit all pages for dark mode consistency (some inline colors may not adapt) |

### 10.2 Medium-Term Features (3-6 Sprints)

| Feature | Value | Description |
|:--------|:------|:------------|
| **AI Interview Playback** | 🔥 Critical | HR can replay interview recordings with synced transcript + AI annotations |
| **Multi-Language Interview** | 🔥 High | Support English, Chinese, Japanese interviews. AI adapts language based on JD |
| **Collaborative Evaluation** | 🟠 Medium | Multiple team members can submit independent evaluations → weighted scoring |
| **Custom Pipeline Stages** | 🟠 Medium | Companies define their own stage names (e.g., "Culture Fit", "Case Study") |
| **White-Label Branding** | 🟠 Medium | Company logo, colors, welcome text on candidate-facing interview pages |
| **Slack/Teams Integration** | 🟡 Low | Notify HR channels on new candidates, interview completions, etc. |

### 10.3 Long-Term Vision

| Feature | Description |
|:--------|:------------|
| **AI-Powered JD Generator** | Input: role title + requirements → Output: full JD with ideal candidate profile |
| **Candidate Matching Engine** | Cross-reference candidate skills against all open positions → auto-suggest matches |
| **Interview Analytics Dashboard** | Aggregate patterns: average interview length, pass rate by department, AI accuracy |
| **Mobile App** | React Native app for HR managers — quick actions, notifications, on-the-go approvals |
| **Compliance & GDPR Module** | Auto-delete recordings after retention period, data export for candidates |

---

## 11. Environment & Running

### 11.1 Prerequisites

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
npm install

# Initialize database
cd server && npx prisma migrate dev --name init && npx prisma db seed
```

### 11.2 Development

```bash
# Start all services (Turborepo)
npm run dev

# Or individually:
npm run dev:portal     # → http://localhost:3004
npm run dev:interview  # → http://localhost:3005
npm run dev:server     # → http://localhost:4000
```

### 11.3 Environment Variables (`server/.env`)

```env
DATABASE_URL="postgresql://hireflow:hireflow_password@127.0.0.1:5433/hireflow_db"
REDIS_URL="redis://127.0.0.1:6379"
MINIO_ENDPOINT="127.0.0.1"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="hireflow_minio"
MINIO_SECRET_KEY="hireflow_minio_password"
MINIO_BUCKET="hireflow-assets"
JWT_SECRET="dev-jwt-secret-do-not-use-in-prod"
ENCRYPTION_KEY="dev-32-byte-key-for-aes-256-gcm-00"  # Must be 32 chars
PORT=4000
HOST=0.0.0.0
```

---

## 12. File Inventory

### Backend (`server/`)

```
server/
├── .env
├── prisma/
│   ├── schema.prisma             # 229 lines — 12 models
│   ├── seed.ts                   # Database seeding script
│   └── migrations/
├── src/
│   ├── index.ts                  # Fastify entry — registers 10 route modules
│   ├── routes/
│   │   ├── auth.ts               # 5 endpoints (register/login/refresh/logout/me)
│   │   ├── candidates.ts         # 6 endpoints (CRUD + stage + cascade delete)
│   │   ├── jobs.ts               # 5 endpoints (CRUD + cascade delete)
│   │   ├── interviews.ts         # 6 endpoints (CRUD + 3 public)
│   │   ├── analytics.ts          # 1 endpoint (overview with partial mocks)
│   │   ├── team.ts               # 3 endpoints (list/update/delete with RBAC)
│   │   ├── settings.ts           # 2 endpoints (get/upsert with Zod validation)
│   │   ├── ai.ts                 # ⚠️ 2 mock endpoints
│   │   ├── notifications.ts      # ⚠️ 2 mock endpoints
│   │   └── websocket.ts          # ⚠️ 1 mock WebSocket endpoint
│   └── utils/
│       ├── auth.ts               # authenticate() middleware
│       ├── jwt.ts                # sign/verify tokens, TokenPayload type
│       ├── passwords.ts          # bcrypt hash/compare
│       ├── prisma.ts             # Singleton PrismaClient
│       └── response.ts           # success()/error() helpers
```

### Frontend — Portal (`apps/portal/src/`)

```
apps/portal/src/
├── App.tsx                       # Router + QueryClient + Toaster
├── main.tsx                      # React 19 root + ThemeProvider + I18nProvider
├── index.css                     # M3 Design System (1040+ lines)
├── components/
│   ├── Layout.tsx                # Sidebar + Topbar (Liquid Glass)
│   ├── auth/RequireAuth.tsx
│   ├── candidates/AddCandidateModal.tsx
│   ├── interviews/CreateInterviewModal.tsx
│   ├── jobs/AddJobModal.tsx
│   └── ui/Toast.tsx
├── hooks/useDebounce.ts
├── stores/authStore.ts
├── lib/api.ts                    # Axios + auto-refresh interceptor
├── contexts/ThemeContext.tsx
├── data/mockData.ts              # ⚠️ LEGACY — should delete
└── pages/                        # 12 page files
```

### Frontend — Interview (`apps/interview/src/`)

```
apps/interview/src/
├── App.tsx                       # Router: /:token flow
├── index.css
├── main.tsx
├── components/
│   └── AudioVisualizer.tsx       # Canvas-based audio waveform
└── pages/
    ├── LandingPage.tsx           # Welcome + verify token
    ├── DeviceCheckPage.tsx       # Camera/mic permissions
    ├── WaitingRoomPage.tsx       # Countdown
    ├── InterviewRoomPage.tsx     # AI interview (mock WS)
    └── CompletePage.tsx          # Thank you
```

### Legacy Code (⚠️ Needs Migration)

```
src/                              # Pre-monorepo code
├── services/
│   ├── ai/aiGateway.ts          # → Move to server/src/services/
│   └── rules/ruleEngine.ts      # → Move to server/src/services/
├── pages/                        # 7 old page files (duplicates of apps/portal)
└── types/                        # Old type definitions
```

---

## 13. Quick Reference — Important Constants

| Constant | Value | Location |
|:---------|:------|:---------|
| Primary Color | `#1A73E8` | `index.css :root` |
| Primary Color (Dark) | `#8AB4F8` | `index.css .dark` |
| Font | `Inter` | Google Fonts import |
| Sidebar Width | `256px` / `72px` collapsed | `--sidebar-width`, `--sidebar-collapsed` |
| Topbar Height | `64px` | `--topbar-height` |
| Access Token TTL | `15 minutes` | `jwt.ts` |
| Refresh Token TTL | `7 days` | `jwt.ts` |
| API Base URL | `http://localhost:4000/api` | `api.ts` |
| Portal Port | `3004` | Vite config |
| Interview Port | `3005` | Vite config |
| Server Port | `4000` | `.env` |
| PostgreSQL Port | `5433` (host) → `5432` (container) | `docker-compose.yml` |

---

**Next Immediate Action**: **Phase 5** — Migrate the AI Gateway from legacy `src/` to `server/src/services/`, implement API Key management in the Settings UI, and wire up the real `/ai/chat` endpoint. This unlocks the core product value.
