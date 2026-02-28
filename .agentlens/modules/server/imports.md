# Imports

[← Back to MODULE](MODULE.md) | [← Back to INDEX](../../INDEX.md)

## Dependency Graph

```mermaid
graph TD
    server[server] --> utils[utils]
    server[server] --> _fastify[@fastify]
    server[server] --> _prisma[@prisma]
    server[server] --> fastify[fastify]
    server[server] --> uuid[uuid]
    server[server] --> zod[zod]
```

## External Dependencies

Dependencies from other modules:

- `./src/utils/passwords`
- `@fastify/cors`
- `@prisma/client`
- `fastify`
- `uuid`
- `zod`

