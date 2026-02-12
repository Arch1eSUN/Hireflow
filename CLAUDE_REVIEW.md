# HireFlow AI — 项目全景深度审查文档

> **文档目的**: 供 Claude 或其他 AI 助手深度阅读，以理解 HireFlow AI 项目的每一行代码、架构决策和当前状态。
> **生成时间**: 2026-02-12 22:15 CST
> **项目阶段**: Monorepo 架构重构完成 (Phase 1)，前端双端 MVP 完成 (Phase 2)，后端数据库接入准备中 (Phase 3)。

---

## 1. 核心架构与技术决策 (Monorepo)

本项目采用 **Turborepo** 管理的 Monorepo 架构，旨在实现前后端代码共享与高效构建。

### 1.1 顶层配置
- **包管理器**: `npm` (Workspaces enabled)
- **任务编排**: `turbo.json` 定义了 `build`, `dev`, `lint` 的依赖关系。
    - `dev` 任务配置为 `persistent: true` (不缓存)。
    - `build` 任务依赖上游的 `^build`。
- **TypeScript**: 根目录 `tsconfig.json` 作为 base config，各子包通过 `extends` 继承。

### 1.2 目录结构深度解析

```
Hireflow/
├── apps/                           # 🚀 应用程序层
│   ├── portal/                     # [前端] B端企业管理后台 (React 19 + Vite)
│   │   ├── Port: 3000
│   │   ├── Tech: Tailwind v4, Framer Motion, Recharts, Radix UI
│   │   └── Role: HR/面试官的主工作台
│   │
│   └── interview/                  # [前端] C端候选人面试应用 (React 19 + Vite)
│       ├── Port: 3001
│       ├── Tech: Tailwind v4, Framer Motion (重动画), WebRTC (Mock)
│       └── Role: 候选人沉浸式面试环境
│
├── packages/                       # 📦 共享库层 (所有包均为 TypeScript 项目)
│   └── shared/
│       ├── types/                  # @hireflow/types (纯类型定义)
│       │   └── 包含: User, Candidate, Job, InterviewSession, AIModel
│       ├── utils/                  # @hireflow/utils (纯函数工具)
│       │   └── 包含: cn(), formatDate(), generateId()
│       └── i18n/                   # @hireflow/i18n (国际化)
│           └── 包含: en/zh locales, I18nProvider context
│
└── server/                         # ⚡ 后端服务层
    └── src/                        # @hireflow/server (Fastify API)
        ├── Port: 4000
        ├── Tech: Fastify, Zod, WebSocket
        └── Role: 统一 API 网关, 数据持久化, AI流式代理
```

---

## 2. 前端应用详解 (Implementation Status)

### 2.1 Portal (B端后台) - `apps/portal`
**完成度**: ⭐⭐⭐⭐⭐ (UI/交互 100%, 真实数据 0%)

*   **设计系统 (`index.css`)**: 
    *   实现了完整的 **Material Design 3** Token (`--color-primary`, `--color-surface` 等)。
    *   支持**深色模式** (`.dark` class)。
    *   组件级样式封装 (`.btn`, `.card`, `.chip`, `.input`) 减少了 Tailwind 类名冗余。

*   **核心页面实现**:
    *   **Dashboard**: 集成了 KPI 卡片、漏斗图 (Recharts)、每日趋势图。
    *   **Candidates**: 实现了**看板 (Kanban)** 和 **列表 (List)** 双视图切换。支持多选批量操作。
    *   **Jobs**: 岗位卡片展示，包含招聘进度条 (Pipeline progress)。
    *   **Interviews**: 标签页切换 (待开始/进行中/已完成)，状态徽章 (Badge) 渲染。
    *   **Settings**: 侧边栏导航设置页，包含 AI 模型配置 (Temperature 滑块)、API Key 管理。
    *   **Screening**: 可视化规则编辑器 (Rule Builder)，支持嵌套逻辑 (AND/OR)。

*   **数据流**:
    *   目前完全依赖 `src/data/mockData.ts` 中的静态常量。
    *   **关键 Action**: 需要迁移至 React Query (`useQuery`) 对接后端。

### 2.2 Interview (C端应用) - `apps/interview`
**完成度**: ⭐⭐⭐⭐ (UI/流程 90%, WebRTC/Socket 0%)

*   **设计风格**:
    *   与 Portal 不同，这里使用了更温暖的色调 (`Warm/Clean`) 和更大的圆角 (`--radius-xl`)。
    *   强调**沉浸感**，无侧边栏，全屏体验。

*   **核心流程**:
    1.  **Landing**: 输入 Interview Token (Mock 验证)。
    2.  **Device Check**: 模拟摄像头/麦克风检测动画。
    3.  **Waiting Room**: 呼吸动画 (`animate-breathe`) 引导候选人放松。
    4.  **Interview Room**: 
        *   布局: 左侧视频流 (User Media), 右侧 Tab (AI Chat / Code Editor)。
        *   反作弊: 实现了 Tab 切换监听 (Page Visibility API) 并触发警告 UI。

---

## 3. 后端服务详解 (Backend Stub)

### 3.1 Server - `server`
**完成度**: ⭐ (仅骨架)

*   **入口 (`server/src/index.ts`)**:
    *   初始化了 Fastify 实例。
    *   配置了 CORS (`@fastify/cors`) 允许前端跨域。
    *   配置了 WebSocket (`@fastify/websocket`) 用于将来实现实时通信。

*   **API 路由 (目前均为 Mock 实现)**:
    *   `GET /api/health`: 返回 `{ status: 'ok' }`。
    *   `GET /api/interviews/token/:token`: 验证面试令牌 (硬编码逻辑)。
    *   `GET /api/candidates`: 返回空数组或 Mock 数据。

*   **缺失的关键模块**:
    *   ❌ **Database**: 未连接 PostgreSQL。
    *   ❌ **ORM**: 未配置 Prisma / TypeORM。
    *   ❌ **Auth**: 无 JWT 认证中间件。
    *   ❌ **AI**: 无真实的 LLM 调用逻辑 (OpenAI/Gemini SDK)。

---

## 4. 下一步开发路线图 (Roadmap)

为了从 "演示版" 进化为 "生产就绪" 系统，必须按以下顺序执行：

### 🔴 Phase 3: 后端核心 (当前优先级最高)
1.  **数据库接入**:
    *   初始化 **Prisma ORM**。
    *   设计 Schema: `User`, `Company`, `Job`, `Candidate`, `Interview`, `Application`.
    *   启动 PostgreSQL Docker 容器。
2.  **认证系统**:
    *   实现 **JWT 签发与验证**。
    *   Portal 端登录 (HR) vs Interview 端登录 (Token-based)。

### 🟡 Phase 4: 前后端对接
1.  **API Client**: 在前端引入 `tanstack-query` (React Query)。
2.  **替换 Mock**: 将 `mockData.ts` 替换为 API 调用 hooks (`useCandidates`, `useJobs`).

### 🟢 Phase 5: AI 与 实时功能
1.  **AI Gateway**: 在 Backend 实现统一的 LLM 调用接口 (流式响应 SSE)。
2.  **WebRTC**: 实现真实的 P2P 视频通话信令服务器 (Socket.io / Fastify WS)。

---

## 5. 关键文件索引 (Source of Truth)

AI 助手在进行修改时，请优先参考以下文件：

*   **通用类型定义**: `packages/shared/types/src/index.ts`
*   **前端路由配置**: `apps/portal/src/App.tsx` 和 `apps/interview/src/App.tsx`
*   **前端样式变量**: `apps/portal/src/index.css` (M3 Tokens)
*   **后端入口文件**: `server/src/index.ts`
*   **Mock 数据源**: `apps/portal/src/data/mockData.ts` (修改此文件可立即改变 UI 展示)

---
