# Little League Scoreboard I-AM Implementation

## Status

The application-level I-AM integration and local offline authority are
implemented. A complete standalone enterprise I-AM platform is intentionally
external to this repository.

Implemented packages:

```text
@ll-score/contracts       Shared I-AM schemas and IamService interface
@ll-score/iam-client      HTTP client implementing IamService
@ll-score/iam-local       Offline identity, policy, session, JSONL, and audit
@ll-score/iam-local-api   Fastify HTTP and cookie-session adapter
```

## Data Processing Dependency

I-AM does not require Game Engine, JSONL game storage, or PostgreSQL to be
implemented first. It owns identity and policy data independently.

The following are available now:

- Authentication and sessions.
- Users and development profiles.
- Permission sets and assignments.
- Scope evaluation.
- Restrictions.
- Authorization decisions.
- UI claims.
- Security audit records.

The following integration work occurs when game data processing is built:

- Game Engine defines stable resource and action names for every operation.
- Landing registers stable route/component resources when UI resource sync is
  added.
- Storage maps authorization field decisions into JSONL projections or SQL
  query shape.
- Schema-derived resource discovery is added after repository schemas exist.

I-AM returns policy decisions and field rules. It never returns raw SQL and
never directly reads game files or tables.

## Local Storage

By default the API stores data beneath `LL_SCORE_DATA_DIR`:

```text
catalog/iam-records.jsonl
audit/iam-audit-events.jsonl
```

If `LL_SCORE_DATA_DIR` is not set during direct API development, the application
uses `.local-data` beneath the current working directory.

Passwords are stored only as Argon2id hashes. Raw session tokens are returned
to the client but only SHA-256 token hashes are persisted.

## Bootstrap

`POST /bootstrap/admin` works only when no users exist. The first administrator
receives application-scoped Platform Admin and Security Admin assignments.
After success, bootstrap permanently returns a conflict.

Example input:

```json
{
  "username": "admin",
  "password": "use-a-long-unique-password",
  "displayName": "Local Administrator"
}
```

## Local Login Modes

Normal operation uses username and password.

Development profiles are available only when:

```text
LL_SCORE_ALLOW_DEVELOPMENT_PROFILES=true
```

They must be explicitly created by a security-authorized actor. Disabling the
environment setting removes profile listing and profile login without deleting
the underlying user.

## Built-In Permission Sets

```text
Public
Authenticated
Player
Parent/Guardian
Scorer
Coach
Team Admin
Platform Admin
Security Admin
```

Assignments are additive, scoped, and date-effective. Explicit restrictions
win over grants. Requests with no matching rule are denied.

Team Admin may delegate Player, Parent/Guardian, Scorer, and Coach assignments
only within the exact team scope they administer. Team Admin cannot grant Team
Admin, Platform Admin, or Security Admin.

## Session Model

- Server-authoritative sessions.
- Eight-hour default local session lifetime.
- One-minute default authorization-decision lifetime.
- HTTP-only, strict same-site cookies through the local API.
- Secure cookies in production.
- Session invalidation when revoked, expired, disabled, or when the user's
  security version changes.
- Public requests use the Public principal without storing a session.

## Verification

The workspace includes tests for:

- One-time bootstrap and password login.
- Public-principal allow and default deny.
- Explicit restriction precedence.
- Team Admin delegation boundaries.
- HTTP-only cookie creation and `auth/me`.
- HTTP-client authorization requests.

Run:

```powershell
pnpm typecheck
pnpm test
pnpm build
```
