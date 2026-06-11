# @ll-score/iam-local

Offline implementation of the shared I-AM contract for the local-first runtime.

Implemented behavior:

- One-time first-administrator bootstrap.
- Username/password authentication using Argon2id.
- Random session tokens stored only as SHA-256 hashes.
- Optional explicit development-profile login.
- Public-principal authorization without an anonymous session.
- Additive, date-effective, scope-aware permission assignments.
- Explicit restrictions overriding all grants.
- Default-deny authorization.
- Platform Admin and Security Admin separation.
- Team Admin delegation of Player, Parent/Guardian, Scorer, and Coach only
  within the administrator's team.
- Append-only JSONL identity and policy records.
- Separate append-only security audit events.
- Versioned policy decisions and user security versions.

The package does not depend on game storage implementation. Game Engine and
storage call `authorize()` using stable resource and action names.
