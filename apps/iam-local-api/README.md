# ll-score-iam-local-api

Fastify HTTP adapter over `@ll-score/iam-local`. Hosted environments may replace
this application with the external I-AM service without changing consumers.

Session cookies are HTTP-only and `SameSite=Strict`. Production mode also marks
them `Secure`.

Key endpoints:

```text
GET  /health/live
GET  /health/ready
GET  /api/v1/capabilities
GET  /bootstrap/status
POST /bootstrap/admin
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/authorize
GET  /auth/development-profiles
POST /auth/login/development
POST /api/security/users
POST /api/security/development-profiles
POST /api/security/assignments
POST /api/security/restrictions
```

Run locally:

```powershell
pnpm install
pnpm iam:dev
```
