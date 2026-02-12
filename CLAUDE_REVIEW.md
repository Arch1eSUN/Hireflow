# HireFlow AI — 项目全景审查文档

> **文档目的**: 供 Claude 阅读，对 HireFlow AI 项目当前状态进行全面审查，提出下一步行动计划和改进建议。
> **生成时间**: 2026-02-12 21:45 CST
> **项目阶段**: Monorepo架构重构完成，双端（B端/C端）MVP前端开发已完成，后端基础框架已就绪

---

## 1. 项目概述

HireFlow AI 是一个企业级 AI 招聘与面试平台，采用 Monorepo 架构管理 B 端企业后台、C 端候选人面试应用以及共享后端服务。

### 核心子应用
1.  **Portal (B端)**:HR/面试官使用的企业管理后台。
    *   **核心功能**: 招聘看板、候选人管理、岗位发布、面试安排、AI 筛选规则配置、数据分析、团队管理、系统设置。
    *   **设计风格**: Google Material Design 3 (M3)，专业、高效、冷色调 (Blue/Teal)。
2.  **Interview (C端)**: 候选人使用的沉浸式面试应用。
    *   **核心功能**: 设备检测、等候室、AI 视频面试、代码考核、面试反馈。
    *   **设计风格**: 温暖、亲和、沉浸式、极简 (Warm/Clean)。

---

## 2. 技术栈与架构 (Monorepo)

**包管理器**: npm (Workspace) + Turborepo (任务编排)

### 2.1 应用层 (`apps/`)

| 应用 | 路径 | 端口 | 技术栈 | 关键依赖 |
| :--- | :--- | :--- | :--- | :--- |
| **@hireflow/portal** | `apps/portal` | 3000 | React 19, Vite 6, Tailwind v4, Framer Motion | `@dnd-kit`, `recharts`, `@radix-ui/*` |
| **@hireflow/interview** | `apps/interview` | 3001 | React 19, Vite 6, Tailwind v4, Framer Motion | `framer-motion` (重动画) |

### 2.2 共享层 (`packages/`)

通过 `packages/` 目录实现代码复用，所有包均为各种 TypeScript 配置。

| 包名 | 路径 | 用途 |
| :--- | :--- | :--- |
| **@hireflow/types** | `packages/shared/types` | 全局 TypeScript 类型定义 (User, Job, Candidate, Interview 等) |
| **@hireflow/utils** | `packages/shared/utils` | 通用工具函数 (日期格式化, Class合并, ID生成等) |
| **@hireflow/i18n** | `packages/shared/i18n` | 国际化核心逻辑 + 语言包 (zh/en) + React Provider |

### 2.3 服务端 (`server/`)

| 服务 | 路径 | 端口 | 技术栈 |
| :--- | :--- | :--- | :--- |
| **@hireflow/server** | `server` | 4000 | Fastify 5, TypeScript |

---

## 3. 详细代码结构与实现

### 3.1 目录结构概览
```
Hireflow/
├── turbo.json                      # Turborepo 任务编排
├── package.json                    # Root Workspace 配置
├── apps/
│   ├── portal/                     # 🏢 企业后台
│   │   ├── src/
│   │   │   ├── components/         # 业务组件 (Layout)
│   │   │   ├── contexts/           # 上下文 (Theme)
│   │   │   ├── data/               # Mock 数据
│   │   │   ├── pages/              # 页面路由 (Dashboard, Candidates, etc.)
│   │   │   ├── index.css           # M3 设计系统实现 (CSS Variables)
│   │   │   └── App.tsx             # 路由配置 (React Router)
│   │   └── vite.config.ts          # Vite 配置 (代理 /api -> :4000)
│   │
│   └── interview/                  # 🎤 候选人应用
│       ├── src/
│       │   ├── pages/              # 面试流程页面 (Landing -> Device -> Room)
│       │   ├── index.css           # 温暖系设计系统
│       │   └── App.tsx             # 流程路由
│       └── vite.config.ts
│
├── packages/shared/                # 📦 共享包
│   ├── types/                      # 只包含 .d.ts 或 export type
│   ├── utils/                      # 纯函数工具
│   └── i18n/                       # i18n 逻辑与翻译文件
│
└── server/                         # ⚡ 后端服务
    └── src/
        └── index.ts                # Fastify 入口与 API 定义
```

### 3.2 Portal 应用详解 (`apps/portal`)

**前端路由 (`src/App.tsx`)**:
*   `/dashboard`: 仪表盘 (KPI, 漏斗图, 趋势图, 日程)
*   `/candidates`: 候选人列表/看板 (支持批量操作, 详情侧滑)
*   `/jobs`: 岗位管理 (卡片视图, pipeline 预览)
*   `/interviews`: 面试日程 (标签页切换: 待开始/进行中/已完成)
*   `/screening`: 规则引擎配置 (可视化编辑器, 预设模板)
*   `/analytics`: 数据分析 (Recharts 图表: 效率/来源/AI成本)
*   `/team`: 团队成员管理
*   `/settings`: 系统设置 (AI 模型配置, API Key, 安全设置)

**设计系统 (`src/index.css`)**:
*   基于 CSS Variables 定义完整的 Material Design 3 Token。
*   **色彩**: 定义了 `primary`, `surface`, `outline`, `error` 等语义化颜色，支持 `.dark` 模式。
*   **排版**: 定义了 `display`, `headline`, `title`, `body`, `label` 等排版层级。
*   **组件**: 内置 `.btn`, `.card`, `.input`, `.chip`, `.table` 等基础组件样式，减少 JSX 中的 Tailwind 类名堆积。

### 3.3 Interview 应用详解 (`apps/interview`)

**面试流程**:
1.  **Landing**: 输入 Token 进入，展示面试须知。
2.  **Device Check**: 摄像头/麦克风/网络/浏览器兼容性检测。
3.  **Waiting Room**: 呼吸动画，平复心情，等待面试开始。
4.  **Interview Room**: 全屏沉浸式面试。
    *   WebRTC 视频区域 (Mock)
    *   AI 聊天互动区域
    *   代码编辑器区域
    *   反作弊监控提示
5.  **Complete**: 面试结束反馈与评分。

**设计特点**:
*   使用更柔和的圆角 (`--radius-xl`) 和更温暖的背景色。
*   大量使用 `framer-motion` 进行页面转场和状态动画 (`animate-breathe`, `slideInFromBottom`).

### 3.4 后端服务 (`server/src/index.ts`)

*   基于 Fastify 构建，轻量高效。
*   启用 `@fastify/cors` 支持跨域。
*   启用 `@fastify/websocket` 支持实时通信 (不仅是 HTTP)。
*   **API 端点 (Stub)**:
    *   `/api/health`: 健康检查
    *   `/api/auth/*`: 认证相关 (Mock)
    *   `/api/candidates/*`: 候选人 CRUD
    *   `/api/ai/chat`: AI 对话接口 (Mock)
    *   `/api/interviews/token/:token`: 面试令牌验证

---

## 4. 已知问题与待办事项 (TODO)

### 🔴 高优先级 (Blocking/Critical)

1.  **后端逻辑缺失**: `server/src/index.ts` 目前仅包含路由定义和 Mock 返回，**没有任何真实的业务逻辑**。
    *   **Action**: 需要接入 PostgreSQL 数据库 (Prisma/TypeORM)。
    *   **Action**: 实现真实的 JWT 认证逻辑。
    *   **Action**: 实现真实的 AI Provider 调用 (OpenAI/Gemini SDK)。

2.  **前端数据 Mock**: Portal 和 Interview 应用目前均使用本地静态 Mock 数据 (`MOCK_DATA`)。
    *   **Action**: 使用 React Query / SWR 替换本地数据，对接真实后端 API。

3.  **WebSocket 未联调**: 虽然 Portal 配置了 ws 代理，后端引入了 ws 插件，但目前没有任何实时的 ws 业务逻辑 (如面试状态同步)。

### 🟡 中优先级 (Important)

4.  **AI Gateway 复用**: 原单体项目中的 `AIGateway` (支持多模型切换/降级) 尚未迁移到 Monorepo 的 shared packages 或 server 中。
    *   **建议**: 将 AI 核心逻辑封装在 `server` 端，前端只通过统一 API 调用，避免 API Key 泄露。

5.  **类型共享**: 虽然有 `@hireflow/types`，但前后端目前并未严格共用同一套 Zod Schema 进行运行时校验。

### 🟢 低优先级 (Enhancement)

6.  **测试覆盖**: 目前无单元测试和 E2E 测试。
7.  **CI/CD**: 未配置自动化构建流程。

---

## 5. 给 Claude 的审查指引

**请重点关注以下领域并提供建议**:

1.  **数据库设计**:
    *   鉴于招聘业务的复杂性 (Candidate, Job, Interview, Application 之间的多对多关系)，请提供一份稳健的 Prisma Schema 设计建议。
2.  **AI 流式响应架构**:
    *   如何设计后端 API 以支持 AI 文本的流式输出 (Server-Sent Events vs WebSocket)?
    *   Interview 端如何优雅地处理流式语音/视频数据?
3.  **反作弊系统实现**:
    *   前端如何通过 Web API (Page Visibility, Blur) 收集作弊信号?
    *   后端如何分析这些信号并生成置信度报告?

---

> **注意**: 旧的根目录文件 (`src/`, `components/` 等在 `apps/` 之外的文件) 多数已废弃，请以 `apps/` 和 `packages/` 目录下的代码为准。
