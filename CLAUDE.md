# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
docker compose up -d db minio  # Postgres 17 + MinIO (S3 API :9000, console :9001)
cd infra && terraform apply    # creates the attachments bucket (see infra/README.md)
cp .env.example .env         # DATABASE_HOST/PORT/USER/PASSWORD/NAME, JWT_SECRET

npm run start:dev            # nest start --watch
npm run build                # nest build (deletes dist first)
npm run start:prod           # node dist/main
npm run lint                 # oxlint --type-aware (not ESLint)
npm run format               # prettier on src/ and test/
```

Tests use **Vitest** (not Jest):

```bash
npm test                                   # unit tests (**/*.spec.ts)
npm run test:e2e                           # e2e (**/*.e2e-spec.ts, vitest.config.e2e.ts)
npx vitest run src/app.controller.spec.ts  # single file
npx vitest run -t "test name"              # single test by name
```

Optional env vars: `PORT` (default 3000), `JWT_ACCESS_EXPIRES_IN` (seconds, default 900), `JWT_REFRESH_EXPIRES_IN` (seconds, default 30 days), `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_SYNCHRONIZE`, and `S3_*` (see `config/s3.config.ts`; defaults target local MinIO).

## Architecture

NestJS 12 + TypeORM + Postgres, JWT auth via passport. Code is organized **by layer, not by feature**:

`controllers/` → `services/` → `repositories/`, each folder with its own `*.module.ts` (`AppModule` imports `EventEmitterModule`, `DatabaseModule`, `ControllersModule`, `GatewaysModule` and `ListenersModule`). `entities/` and `dto/<domain>/` (with `index.ts` barrels) are shared across layers.

- **Domain**: users, conversations (`pair` or group), conversation members, messages. Services enforce membership/authorization rules; repositories wrap TypeORM access.
- **Auth**: `common/guards/jwt-auth.guard.ts` extends `AuthGuard('jwt')`, backed by `common/strategies/jwt.strategy.ts`. The guard re-declares an `@Optional()` constructor because Nest 12 doesn't inherit optional-dependency metadata, so keep it when editing. Password hashing is in `common/security/password.ts`; `common/types/authenticated-request.ts` types `req.user`. Login/register return a short-lived access JWT plus an opaque refresh token. Only the token's sha256 is stored in `refresh_tokens`. `POST /auth/refresh` rotates it, and presenting a revoked token revokes all of the user's sessions. Full flow in [docs/auth.md](docs/auth.md).
- **Validation**: a global `ValidationPipe` in `main.ts` uses `whitelist`, `forbidNonWhitelisted` and `transform`. Unknown body fields are rejected, and DTOs (class-validator) must declare every accepted field.
- **Attachments**: files go straight to S3 via presigned POST (`StorageService`); messages link them by `attachmentIds`. Full flow in [docs/attachments.md](docs/attachments.md).
- **Realtime**: socket.io via `gateways/realtime.gateway.ts` (`GatewaysModule`). A handshake middleware verifies the JWT (`handshake.auth.token` or `Authorization: Bearer`) through `AuthService.verifyAccessToken`, and each socket joins `user:<id>` (`common/realtime/rooms.ts`). To send events, inject `services/realtime.service.ts` (`emitToUser`/`emitToRoom`/`emitToAll`/`emit`, `joinRoom`/`leaveRoom`). It is transport-only and never throws. The gateway hands it the server in `afterInit`, so it has no dependency on the gateway.
- **Domain events**: domain services never call `RealtimeService`. After a successful write they publish `DomainEvent.*` (`common/events/domain-events.ts`) through `EventEmitter2`, and `listeners/chat-realtime.listener.ts` turns them into socket events (`common/realtime/events.ts`). Sockets also join `conversation:<id>` rooms, which the listener keeps in sync. The typing relay and the `WsHttpExceptionFilter` (the global `ValidationPipe` also runs for gateways) live in the gateway. Event contract for clients: [docs/realtime.md](docs/realtime.md).
- **Database**: `config/database.config.ts` is registered with `registerAs('database')` and loaded by `core/database/database.module.ts`. `synchronize` is on outside production unless `DATABASE_SYNCHRONIZE=false`. Hand-written migrations live in `core/database/migrations/` (loaded by glob), so schema changes may need both entity edits and a migration.

## Gotchas

- Pure ESM (`"type": "module"`, `module: nodenext`): relative imports **must use the `.js` extension** even though sources are `.ts`.
- Decorators rely on `emitDecoratorMetadata`; Vitest runs with `globals: true`.