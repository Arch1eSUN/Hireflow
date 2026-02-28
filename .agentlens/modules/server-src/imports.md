# Imports

[← Back to MODULE](MODULE.md) | [← Back to INDEX](../../INDEX.md)

## Dependency Graph

```mermaid
graph TD
    server_src[server-src] --> utils[utils]
    server_src[server-src] --> ai[ai]
    server_src[server-src] --> audio[audio]
    server_src[server-src] --> audio[audio]
    server_src[server-src] --> socket[socket]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> routes[routes]
    server_src[server-src] --> utils[utils]
    server_src[server-src] --> _fastify[@fastify]
    server_src[server-src] --> _fastify[@fastify]
    server_src[server-src] --> _fastify[@fastify]
    server_src[server-src] --> _fastify[@fastify]
    server_src[server-src] --> _hireflow[@hireflow]
    server_src[server-src] --> crypto[crypto]
    server_src[server-src] --> dotenv[dotenv]
    server_src[server-src] --> fastify[fastify]
    server_src[server-src] --> ws[ws]
```

## External Dependencies

Dependencies from other modules:

- `../../utils/prisma`
- `../ai/gateway`
- `../audio/stt`
- `../audio/tts`
- `../socket/manager`
- `./routes/ai`
- `./routes/analytics`
- `./routes/auth`
- `./routes/candidates`
- `./routes/interviews`
- `./routes/jobs`
- `./routes/notifications`
- `./routes/screening`
- `./routes/settings`
- `./routes/team`
- `./routes/websocket`
- `./utils/response`
- `@fastify/cookie`
- `@fastify/cors`
- `@fastify/rate-limit`
- `@fastify/websocket`
- `@hireflow/types`
- `crypto`
- `dotenv/config`
- `fastify`
- `ws`

