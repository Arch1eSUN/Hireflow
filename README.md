# 🚀 HireFlow AI — Intelligent Recruitment Platform

<div align="center">

**AI-Powered HR Recruitment Platform with Multi-LLM Support**

Automated video interviews • Smart resume screening • Anti-cheat proctoring • Team collaboration

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple?logo=vite)](https://vitejs.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black?logo=fastify)](https://fastify.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)

</div>

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Database Design](#-database-design)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [AI Provider Setup](#-ai-provider-setup)
- [Security](#-security)

---

## 🏗 Architecture Overview

```mermaid
graph TB
    subgraph Client["🖥 Frontend (React 18 + Vite)"]
        UI["UI Components<br/>Material Design 3"]
        Router["React Router v6<br/>Lazy Loading"]
        State["Context API<br/>Theme / Auth"]
        AI_Client["AI Gateway Client<br/>Provider Pattern"]
    end

    subgraph Gateway["🔀 AI Gateway Service"]
        Dispatcher["Request Dispatcher<br/>Fallback + Load Balance"]
        Logger["Usage Logger<br/>Token/Cost Tracking"]
        Cache["Response Cache<br/>Redis"]
    end

    subgraph Providers["🤖 AI Providers"]
        Gemini["Google Gemini<br/>2.5 Pro / Flash"]
        OpenAI["OpenAI<br/>GPT-4o / GPT-4o Mini"]
        Claude["Anthropic<br/>Claude Sonnet 4 / Opus 4"]
        Local["Local Model<br/>OpenAI-Compatible API"]
        Mock["Mock Provider<br/>Testing"]
    end

    subgraph Backend["⚙️ Backend (Fastify + TypeScript)"]
        API["REST API<br/>Zod Validation"]
        WS["WebSocket Server<br/>Signaling"]
        RuleEngine["Rule Engine<br/>JSON DSL"]
        Auth["Authentication<br/>JWT + Refresh"]
        ScreenSvc["Screening Service<br/>Resume Parser"]
    end

    subgraph Infra["🗄 Infrastructure"]
        PG["PostgreSQL 16<br/>Primary Database"]
        Redis["Redis 7<br/>Cache + Queue"]
        S3["MinIO / S3<br/>File Storage"]
        WebRTC["WebRTC<br/>Video/Audio"]
    end

    subgraph AntiCheat["🛡 Anti-Cheat Module"]
        Face["Face Detection<br/>Liveness Check"]
        Tab["Tab Monitor<br/>Focus Tracking"]
        Device["Device Fingerprint<br/>Environment Hash"]
        AIDetect["AI Answer Detection<br/>Pattern Analysis"]
    end

    Client --> Gateway
    Client --> Backend
    Client --> WebRTC

    Gateway --> Providers
    Gateway --> Logger
    Logger --> Redis

    Backend --> PG
    Backend --> Redis
    Backend --> S3
    Backend --> RuleEngine

    Client --> AntiCheat
```

---

## 💾 Database Design

```mermaid
erDiagram
    COMPANY ||--o{ USER : has
    COMPANY ||--o{ JOB : posts
    USER ||--o{ JOB : manages
    JOB ||--o{ PIPELINE_STAGE : defines
    JOB ||--o{ CANDIDATE : receives
    JOB ||--o{ SCREENING_RULE : configures
    CANDIDATE ||--o{ INTERVIEW_SESSION : participates
    CANDIDATE ||--|| RESUME : uploads
    CANDIDATE ||--o{ EVALUATION : receives
    INTERVIEW_SESSION ||--o{ ANTI_CHEAT_EVENT : monitors
    INTERVIEW_SESSION ||--o{ CHAT_MESSAGE : contains
    USER ||--o{ EVALUATION : writes
    JOB ||--o{ INTERVIEW_CONFIG : defines

    COMPANY {
        uuid id PK
        string name
        string domain
        string logo_url
        jsonb settings
        timestamp created_at
    }

    USER {
        uuid id PK
        uuid company_id FK
        string email UK
        string name
        string role
        string avatar_url
        boolean is_active
        timestamp last_login
    }

    JOB {
        uuid id PK
        uuid company_id FK
        uuid hiring_manager_id FK
        string title
        string department
        string location
        string employment_type
        int salary_min
        int salary_max
        string currency
        text description
        string status
        timestamp deadline
        timestamp created_at
    }

    PIPELINE_STAGE {
        uuid id PK
        uuid job_id FK
        string name
        int order_index
        boolean is_ai_stage
        string ai_model
    }

    CANDIDATE {
        uuid id PK
        uuid job_id FK
        string name
        string email
        string phone
        int score
        string stage
        string verification_status
        text[] skills
        text[] tags
        jsonb metadata
        timestamp applied_date
    }

    RESUME {
        uuid id PK
        uuid candidate_id FK
        string file_url
        jsonb parsed_data
        int ai_score
        text ai_summary
        string[] detected_skills
        boolean is_duplicate
        timestamp uploaded_at
    }

    SCREENING_RULE {
        uuid id PK
        uuid job_id FK
        string name
        jsonb rule_dsl
        int min_score
        boolean is_active
        timestamp created_at
    }

    INTERVIEW_SESSION {
        uuid id PK
        uuid candidate_id FK
        uuid job_id FK
        string stage
        string token UK
        string ai_model
        string status
        timestamp scheduled_at
        timestamp started_at
        timestamp ended_at
        int duration_seconds
        string recording_url
    }

    INTERVIEW_CONFIG {
        uuid id PK
        uuid job_id FK
        string stage
        string ai_model
        jsonb question_bank
        int duration_minutes
        jsonb anti_cheat_settings
    }

    CHAT_MESSAGE {
        uuid id PK
        uuid session_id FK
        string role
        text content
        timestamp created_at
    }

    EVALUATION {
        uuid id PK
        uuid candidate_id FK
        uuid evaluator_id FK
        uuid session_id FK
        int overall_score
        jsonb dimension_scores
        text notes
        string recommendation
        timestamp created_at
    }

    ANTI_CHEAT_EVENT {
        uuid id PK
        uuid session_id FK
        string type
        string severity
        text message
        jsonb metadata
        timestamp created_at
    }

    AI_USAGE_LOG {
        uuid id PK
        string model
        int prompt_tokens
        int completion_tokens
        int latency_ms
        decimal cost_usd
        string context
        timestamp created_at
    }
```

---

## 📁 Project Structure

```
hireflow/
├── 📄 index.html                    # Entry HTML (Vite)
├── 📄 package.json                  # Dependencies & scripts
├── 📄 vite.config.ts                # Vite + Tailwind + Proxy config
├── 📄 tsconfig.json                 # TypeScript configuration
├── 📄 docker-compose.yml            # Full dev environment
├── 📄 Dockerfile                    # Multi-stage production build
├── 📄 .env.example                  # Environment variables template
│
├── 📁 src/                          # Frontend source
│   ├── 📄 main.tsx                  # App entry point
│   ├── 📄 App.tsx                   # Root component + routing
│   ├── 📄 index.css                 # Design system (M3 tokens)
│   │
│   ├── 📁 components/
│   │   └── 📁 layout/
│   │       └── 📄 Layout.tsx        # Sidebar + Header + Page shell
│   │
│   ├── 📁 pages/
│   │   ├── 📄 Dashboard.tsx         # KPI cards, funnel, charts, table
│   │   ├── 📄 CandidatesPage.tsx    # Kanban + list view + comparison
│   │   ├── 📄 JobsPage.tsx          # Job openings management
│   │   ├── 📄 InterviewRoomPage.tsx # AI video interview room
│   │   ├── 📄 InterviewLinkPage.tsx # Candidate device check + entry
│   │   ├── 📄 RuleEditorPage.tsx    # Visual screening rule builder
│   │   └── 📄 SettingsPage.tsx      # AI models, security, integrations
│   │
│   ├── 📁 services/
│   │   ├── 📁 ai/
│   │   │   └── 📄 aiGateway.ts      # Multi-LLM gateway with fallback
│   │   └── 📁 rules/
│   │       └── 📄 ruleEngine.ts     # JSON DSL rule evaluation engine
│   │
│   ├── 📁 contexts/
│   │   └── 📄 ThemeContext.tsx       # Dark/Light theme management
│   │
│   ├── 📁 data/
│   │   └── 📄 mockData.ts           # Development mock data
│   │
│   ├── 📁 lib/
│   │   └── 📄 utils.ts              # Shared utility functions
│   │
│   └── 📁 types/
│       └── 📄 index.ts              # TypeScript type definitions
│
└── 📁 server/                       # Backend source
    ├── 📄 index.ts                  # Fastify API server
    └── 📄 tsconfig.json             # Server TypeScript config
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite 6 | SPA framework |
| **Styling** | Tailwind CSS v4, Framer Motion | Design system + animations |
| **Charts** | Recharts | Dashboard visualizations |
| **Icons** | Lucide React | Consistent iconography |
| **Routing** | React Router v6 | Client-side routing |
| **Backend** | Fastify + TypeScript | REST API server |
| **Validation** | Zod | Schema validation |
| **Database** | PostgreSQL 16 | Primary data store |
| **Cache** | Redis 7 | Sessions, cache, queue |
| **Storage** | MinIO (S3-compat) | File/video storage |
| **Real-time** | WebSocket + WebRTC | Video interviews |
| **AI** | Gemini, OpenAI, Claude | Multi-LLM support |
| **Container** | Docker Compose | Development environment |

---

## ✨ Features

### 🎯 Candidate Portal
- **Unique interview links** with expiration and single-use validation
- **Device pre-check** (camera, microphone, network quality)
- **AI video interview** with real-time chat and code editor
- **Anti-cheat monitoring** (tab switching, liveness, face detection)

### 📊 Enterprise Dashboard
- **Recruitment funnel** visualization with conversion rates
- **KPI cards** with trend indicators
- **Activity trends** chart (applications, interviews, offers)
- **Candidate Kanban board** with drag-and-drop
- **Radar chart comparison** for side-by-side candidate evaluation

### 🧠 AI-Powered Screening
- **Visual rule builder** with nested AND/OR/NOT logic
- **12+ operators** (EQUALS, GTE, CONTAINS, REGEX, BETWEEN, etc.)
- **Rule templates** for common roles
- **Match score calculation** with per-rule weighting
- **Test against sample data** before deploying

### ⚙️ Administration
- **Multi-model AI configuration** (8 models across 4 providers)
- **Temperature & token tuning** with visual sliders
- **API key management** with encryption status
- **Security toggles** (AES-256, anti-cheat, GDPR, data retention)
- **Integration directory** (Calendar, ATS, Messenger, Webhook)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Docker** (optional, for full stack)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/hireflow.git
cd hireflow
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Run Development Server

```bash
# Start frontend (port 3000)
npm run dev

# Start backend (port 4000) - in another terminal
npx tsx --watch server/index.ts
```

### 4. Open Browser

Navigate to **http://localhost:3000**

---

## 🐳 Docker Deployment

Run the entire stack with a single command:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop everything
docker compose down
```

**Services:**
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Vite dev server |
| API | 4000 | Fastify backend |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & queue |
| MinIO | 9000/9001 | Object storage |

---

## ⚙️ Configuration

### AI Provider Setup

| Provider | Environment Variable | Models |
|----------|---------------------|--------|
| Google Gemini | `GEMINI_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| OpenAI | `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4, claude-opus-4 |
| Local | `LOCAL_MODEL_URL` | Any OpenAI-compatible API |
| Mock | (none) | Built-in test responses |

The AI Gateway automatically falls back to the next available provider if the primary model fails.

### Anti-Cheat Configuration

The anti-cheat module can be configured per-interview:

```json
{
  "tabMonitoring": true,
  "faceLiveness": true,
  "multiPersonDetection": true,
  "aiAnswerDetection": false,
  "maxViolations": 3
}
```

---

## 📡 API Documentation

### Interview Link API

```
POST   /api/interviews/link          # Generate interview link
GET    /api/interviews/link/:token   # Validate interview link
```

### AI Usage API

```
POST   /api/ai/usage                 # Log AI call
GET    /api/ai/usage                 # Usage statistics
```

### Screening API

```
POST   /api/screening/evaluate       # Evaluate candidate against rules
```

### System

```
GET    /api/health                   # Health check
GET    /api/webrtc/ice-servers       # WebRTC ICE configuration
```

All endpoints return a standardized response:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 🔐 Security

- **AES-256 encryption** for all stored interview recordings
- **JWT authentication** with refresh token rotation
- **Zod validation** on all API inputs
- **Anti-cheat proctoring** with configurable strictness
- **GDPR / PIPL compliant** data handling options
- **Audit logging** for all sensitive operations
- **Data retention policies** with auto-purge support
- **Device fingerprinting** for interview integrity

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
<b>Built with ❤️ by the HireFlow AI Team</b>
</div>
