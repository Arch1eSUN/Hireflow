# HireFlow 生产上线开发计划

> **文档状态**: 持续更新  
> **最后更新**: 2026-03-01  
> **项目进度**: ~78%（P0 全部完成）

---

## 📊 已完成进度总览

### Phase 1-3: 基础治理 ✅（已完成）
- [x] `process.env` 治理（47→20）+ Zod 校验
- [x] `console.*` → Pino 结构化日志（59→0）
- [x] Auth 日志安全（邮箱脱敏）
- [x] 统一错误处理（`catch any` 80→0，`AppError` + Fastify handler）
- [x] Orchestrator 拆分（945→848 + 192 行 `promptBuilder.ts`）
- [x] GDPR API（4 端点 + 审计日志）
- [x] 邮件模板（3→8，中文化，24 tests）
- [x] Sentry 接入（init/capture/flush + 全局 error handler）
- [x] 通知系统前端（badge 轮询 + 全部已读 + 2 新 API）
- [x] 面试全程录制（`useSessionRecorder` + REC 指示器 + 自动上传）

### P0: 上线阻塞项 ✅（已完成）
- [x] `@fastify/helmet` 安全头（XSS/Clickjacking/MIME sniffing 防护）
- [x] `console→logger` 全量清零（20 处，10 个文件）
- [x] `: any` 类型修复（9 处核心路由/webhook/gdpr）
- [x] Dockerfile × 3（server + portal + interview，多阶段构建）
- [x] `.dockerignore`

**验证**: tsc 0 errors / vitest 24/24 passed / console 残留 0

---

## 🔧 一、修改方向（Bugfix / 代码卫生）

### 1.1 `: any` 残留清理（~10 处）
- [ ] `socket/manager.ts`：4 处 `message: any` → 定义 `WsOutboundMessage` 联合类型
- [ ] `websocket.ts` L202：`message: any` → `Buffer | ArrayBuffer | Buffer[]`
- [ ] `evidence.ts` L78：`opinion: any` → `Record<string, unknown>`
- [ ] `settings/helpers.ts`：2 处 `request/reply: any` → `FastifyRequest/FastifyReply`
- [ ] `settings/keys.ts` L531：`item: any` → 具体 catalog 类型

### 1.2 `process.env` 剩余迁移（20 处）
- [ ] AI gateway 的 `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` → `env.ts`
- [ ] XiaoFan 专用变量：`XIAOFAN_OPENAI_BASE_URL` / `XIAOFAN_OPENAI_MODEL` / `XIAOFAN_API_MODE`
- [ ] `HIREFLOW_ALLOW_MOCK_PROVIDER` → `env.ts`

### 1.3 TODO 清理
- [ ] `email/index.ts` L90：决定是否实现 nodemailer SMTP 或移除 todo

---

## ➕ 二、新增方向（新功能）

### 2.1 密码重置流程（P1）
- [ ] `POST /api/auth/forgot-password`：生成重置 token + 发送 `passwordResetEmail`
- [ ] `POST /api/auth/reset-password`：验证 token + 更新密码
- [ ] 邮件模板已就绪（`passwordResetEmail`）

### 2.2 API 文档自动生成（P1）
- [ ] 集成 `@fastify/swagger` + `@fastify/swagger-ui`
- [ ] 核心路由添加 JSON Schema

### 2.3 数据保留自动清理（P2）
- [ ] 基于 `CompanySettings.dataRetentionDays` 定时清理过期数据
- [ ] 实现 cron 任务（agenda / node-cron）

### 2.4 APM 指标端点（P2）
- [ ] `/metrics` 端点（`prom-client`）
- [ ] 暴露并发连接数、请求延迟、AI 调用统计

---

## ♻️ 三、重构方向（架构改善）

### 3.1 AI Gateway 模块化（P1）
- [ ] 拆分 `gateway.ts`（504 行）为 `providers/` 目录
  - `base.ts` → abstract AIProvider
  - `gemini.ts` / `openai.ts` / `anthropic.ts` / `mock.ts`
- [ ] 统一 API key 从 `env.ts` 获取

### 3.2 WebSocket 消息类型安全（P1）
- [ ] 定义 `WsInboundMessage` / `WsOutboundMessage` 联合类型
- [ ] 替换 `socket/manager.ts` 中 4 处 `message: any`

### 3.3 Webhook Service 改用共享 Prisma 实例（P2）
- [ ] `webhook.ts` 独立 `new PrismaClient()` → 使用共享 `prisma` 单例

---

## 📝 四、补全方向（缺失部分）

### 4.1 测试覆盖率提升（P0 — 高风险）
当前：3 个文件 / 24 个用例 / 路由 0 测试

| 测试文件 | 目标用例数 | 优先级 |
|----------|-----------|--------|
| `auth.test.ts` | 8-10 | P0 |
| `candidates.test.ts` | 6-8 | P0 |
| `interviews.test.ts` | 6-8 | P1 |
| `gdpr.test.ts` | 5-6（已有） | ✅ |
| `gateway.test.ts` | 4-5 | P1 |
| `webhook.test.ts` | 3-4 | P2 |

**目标**: 24 → 60+ 用例

### 4.2 i18n 国际化补全（P1）
- [ ] 补全 `packages/i18n` 中英文翻译 JSON
- [ ] Portal 页面统一使用 `t()` 函数
- [ ] Interview app 检查 `useI18n` 覆盖度

### 4.3 .env.example 审查（P1）
- [ ] 确认新变量都在：`SENTRY_DSN` / `SENTRY_RELEASE` / `SENDGRID_API_KEY`
- [ ] 添加注释区分必填/可选

### 4.4 部署文档（P1）
- [ ] `DEPLOYMENT.md`：Docker 部署 + 环境变量 + 数据库迁移 + SSL

---

## ⚡ 五、优化方向（性能/体验）

### 5.1 数据库查询优化（P1）
- [ ] `$queryRaw`（5 处 analytics）添加索引确认
- [ ] Candidate/Interview 列表分页完善
- [ ] N+1 查询检查：`include` 嵌套深度审查

### 5.2 前端性能优化（P2）
- [ ] Portal bundle size 分析 + 代码分割
- [ ] 静态资源 CDN 配置
- [ ] Service Worker 缓存策略

### 5.3 API 响应缓存（P2）
- [ ] analytics 端点 Redis TTL 60s（已有 Redis 帮助函数在 `redis.ts`）
- [ ] 候选人列表 ETag 支持

### 5.4 WebSocket 心跳优化（P2）
- [ ] ping/pong 心跳机制
- [ ] 自动重连指数退避策略

### 5.5 AI 调用成本监控（P2）
- [ ] 每次 AI 调用 token 消耗记录到 AuditLog
- [ ] 仪表盘月度 AI 费用统计

---

## 🗓 建议上线路径

| 阶段 | 内容 | 估时 | 状态 |
|------|------|------|------|
| P0 阻塞项 | Helmet / console / any / Dockerfile | 9.5h | ✅ 完成 |
| P1 测试 | auth + candidates 冒烟测试 | 3h | 待开始 |
| P1 安全 | 密码重置 + .env.example + CORS 域名 | 2h | 待开始 |
| P1 文档 | DEPLOYMENT.md + API 文档 | 2h | 待开始 |
| **最低上线** | **↑ 以上全部完成** | **~7h** | — |
| P2 优化 | DB 索引 / Redis 缓存 / WS 心跳 / i18n | 上线后迭代 | — |
