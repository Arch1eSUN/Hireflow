# Imports

[← Back to MODULE](MODULE.md) | [← Back to INDEX](../../INDEX.md)

## Dependency Graph

```mermaid
graph TD
    apps_portal_src_pages[apps-portal-src-pages] --> hooks[hooks]
    apps_portal_src_pages[apps-portal-src-pages] --> candidates[candidates]
    apps_portal_src_pages[apps-portal-src-pages] --> interviews[interviews]
    apps_portal_src_pages[apps-portal-src-pages] --> jobs[jobs]
    apps_portal_src_pages[apps-portal-src-pages] --> ui[ui]
    apps_portal_src_pages[apps-portal-src-pages] --> ui[ui]
    apps_portal_src_pages[apps-portal-src-pages] --> hooks[hooks]
    apps_portal_src_pages[apps-portal-src-pages] --> lib[lib]
    apps_portal_src_pages[apps-portal-src-pages] --> stores[stores]
    apps_portal_src_pages[apps-portal-src-pages] --> i18n[i18n]
    apps_portal_src_pages[apps-portal-src-pages] --> _hireflow[@hireflow]
    apps_portal_src_pages[apps-portal-src-pages] --> src[src]
    apps_portal_src_pages[apps-portal-src-pages] --> _tanstack[@tanstack]
    apps_portal_src_pages[apps-portal-src-pages] --> framer_motion[framer-motion]
    apps_portal_src_pages[apps-portal-src-pages] --> lucide_react[lucide-react]
    apps_portal_src_pages[apps-portal-src-pages] --> react[react]
    apps_portal_src_pages[apps-portal-src-pages] --> react_router_dom[react-router-dom]
    apps_portal_src_pages[apps-portal-src-pages] --> recharts[recharts]
    apps_portal_src_pages[apps-portal-src-pages] --> sonner[sonner]
```

## External Dependencies

Dependencies from other modules:

- `../hooks/useWebSocket`
- `@/components/candidates/AddCandidateModal`
- `@/components/interviews/CreateInterviewModal`
- `@/components/jobs/AddJobModal`
- `@/components/ui/EmptyState`
- `@/components/ui/LanguageSwitcher`
- `@/hooks/useDebounce`
- `@/lib/api`
- `@/stores/authStore`
- `@hireflow/i18n/react`
- `@hireflow/types`
- `@hireflow/utils/src/index`
- `@tanstack/react-query`
- `framer-motion`
- `lucide-react`
- `react`
- `react-router-dom`
- `recharts`
- `sonner`

