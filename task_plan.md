# Hireflow 项目落地计划（面向生产上线）

## 目标
基于现有代码与 CLAUDE_REVIEW 现状，给出可执行的前后端改造建议、Google 风格设计建议，并生成可直接用于 antigravity 的详细开发提示词。

## 阶段
- [in_progress] Phase 1: 基线审阅（CLAUDE_REVIEW + 项目结构 + 运行状态）
- [pending] Phase 2: 前端改造方案（信息架构、组件、交互、可访问性）
- [pending] Phase 3: 后端改造方案（API、AI、实时、安全、可观测性）
- [pending] Phase 4: 产出 antigravity 详细提示词（按迭代执行）

## 风险与约束
- 避免大爆炸式重构，优先小步可回滚。
- 先确保“无死按钮、无假数据关键路径”，再做视觉精修。
- 目标是可上线，不是 Demo 过度堆功能。

## 验收标准
1. 给出分层建议（P0/P1/P2）且有收益/风险说明。
2. 提供页面级与接口级改造清单。
3. 提供可直接粘贴给 antigravity 的提示词（含输出格式与完成定义 DoD）。
