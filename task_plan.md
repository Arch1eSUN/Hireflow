# Hireflow 项目落地计划（面向生产上线）

## 目标
基于现有代码与 CLAUDE_REVIEW 现状，给出可执行的前后端改造建议、Google 风格设计建议，并生成可直接用于 antigravity 的详细开发提示词。

## 阶段
- [complete] Phase 1: 基线审阅（CLAUDE_REVIEW + 项目结构 + 运行状态）
- [complete] Phase 2: 前端改造方案（信息架构、组件、交互、可访问性）
- [complete] Phase 3: 后端改造方案（API、AI、实时、安全、可观测性）
- [complete] Phase 4: 产出 antigravity 详细提示词（按迭代执行）

## 风险与约束
- 避免大爆炸式重构，优先小步可回滚。
- 先确保“无死按钮、无假数据关键路径”，再做视觉精修。
- 目标是可上线，不是 Demo 过度堆功能。

## 验收标准
1. 给出分层建议（P0/P1/P2）且有收益/风险说明。
2. 提供页面级与接口级改造清单。
3. 提供可直接粘贴给 antigravity 的提示词（含输出格式与完成定义 DoD）。

---

## 2026-02-13 夜间循环执行计划（开发→学习→优化→再开发）

### 本轮目标（P0）
- 让 `server` 成功启动并打通 Interview 最小实时链路（audio/vad/transcript）。

### 当前阻塞
- `server/src/services/ai/gateway.ts` 引用了 `@hireflow/types` 中不存在的导出：`AIModelType`。
- monorepo type-check 在 `packages/shared/i18n` / `packages/shared/types` 出现 `TS18003 No inputs were found`。

### 执行步骤（按顺序）
1. [ ] 修复 `@hireflow/types` 导出与 `server` 引用不一致问题（先保证 server 能起）。
2. [ ] 修复 shared 包 tsconfig include 配置，恢复全仓 type-check。
3. [ ] 验证 `npm run dev` 三端状态：portal(3000)、interview(3001)、server(4000)。
4. [ ] 浏览器实测 Interview 页面：WebSocket 连接、消息收发、错误提示。
5. [ ] 记录未打通点到 `findings.md` 与 `progress.md`，进入下一轮优化。

### 风险控制
- 每步仅做小改动；每步后运行最小验证命令。
- 若修复导致连锁错误，立即回退到上一步并改最小补丁策略。

### 本轮完成定义（DoD）
- [ ] `server` 无运行时崩溃。
- [ ] `localhost:3000/3001` 可访问，`localhost:4000` 服务可连接。
- [ ] 输出“已跑通/未跑通/阻塞点（文件级）”清单。
