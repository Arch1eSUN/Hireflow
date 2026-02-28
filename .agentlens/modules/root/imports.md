# Imports

[← Back to MODULE](MODULE.md) | [← Back to INDEX](../../INDEX.md)

## Dependency Graph

```mermaid
graph TD
    root[root] --> stores[stores]
    root[root] --> __[..]
    root[root] --> lib[lib]
    root[root] --> ai[ai]
    root[root] --> rules[rules]
    root[root] --> stores[stores]
    root[root] --> __[..]
    root[root] --> _[.]
    root[root] --> _[.]
    root[root] --> _[.]
    root[root] --> _[.]
    root[root] --> components[components]
    root[root] --> components[components]
    root[root] --> components[components]
    root[root] --> components[components]
    root[root] --> auth[auth]
    root[root] --> ui[ui]
    root[root] --> contexts[contexts]
    root[root] --> _[.]
    root[root] --> contexts[contexts]
    root[root] --> lib[lib]
    root[root] --> stores[stores]
    root[root] --> _google[@google]
    root[root] --> i18n[i18n]
    root[root] --> src[src]
    root[root] --> src[src]
    root[root] --> resolvers[resolvers]
    root[root] --> _tailwindcss[@tailwindcss]
    root[root] --> _tanstack[@tanstack]
    root[root] --> _vitejs[@vitejs]
    root[root] --> axios[axios]
    root[root] --> framer_motion[framer-motion]
    root[root] --> lucide_react[lucide-react]
    root[root] --> node_fs[node:fs]
    root[root] --> node_path[node:path]
    root[root] --> path[path]
    root[root] --> react[react]
    root[root] --> react_dom[react-dom]
    root[root] --> react_hook_form[react-hook-form]
    root[root] --> react_router_dom[react-router-dom]
    root[root] --> recharts[recharts]
    root[root] --> sonner[sonner]
    root[root] --> zod[zod]
    root[root] --> zustand[zustand]
    root[root] --> zustand[zustand]
```

## Internal Dependencies

Dependencies within this module:

- `vite`

## External Dependencies

Dependencies from other modules:

- `../../stores/authStore`
- `../../types`
- `../lib/api`
- `../services/ai/aiProvider`
- `../services/rules/ruleEngine`
- `../stores/authStore`
- `../types`
- `./AntiCheatMonitor`
- `./App`
- `./CommandPalette`
- `./NotificationPopover`
- `./components/Dashboard`
- `./components/InterviewRoom`
- `./components/Layout`
- `./components/RuleEditor`
- `./components/auth/RequireAuth`
- `./components/ui/Toast`
- `./contexts/ThemeContext`
- `./index.css`
- `@/contexts/ThemeContext`
- `@/lib/api`
- `@/stores/authStore`
- `@google/genai`
- `@hireflow/i18n/react`
- `@hireflow/i18n/src/react`
- `@hireflow/utils/src/index`
- `@hookform/resolvers/zod`
- `@tailwindcss/vite`
- `@tanstack/react-query`
- `@vitejs/plugin-react`
- `axios`
- `framer-motion`
- `lucide-react`
- `node:fs`
- `node:path`
- `path`
- `react`
- `react-dom/client`
- `react-hook-form`
- `react-router-dom`
- `recharts`
- `sonner`
- `zod`
- `zustand`
- `zustand/middleware`

