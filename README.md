# Little League Scoreboard

Local-first Little League live scoring and replay application.

## Current Structure

```text
apps/
  landing/          Browser-facing Next.js PWA
  local-runtime/    Local executable and process wiring
  game-api/         Game Engine REST adapter
  storage-api/      Storage REST adapter
  media-api/        Media REST adapter
  iam-local-api/    Optional local I-AM REST adapter

packages/
  scoreboard/       Scoreboard display
  rosters/          Rosters and lineups
  base-runners/     Base occupancy and runner movement
  count-controls/   Balls, strikes, and outs
  pitch-location/   Pitch-location input and display
  hit-location/     Batted-ball location input and display
  field-diagram/    Shared field geometry and rendering primitives
  game-engine/      Authoritative application and baseball workflows
  storage-*/        Persistence interfaces and implementations
  contracts/        Shared schemas and API/event contracts
```

See `CURRENT_ARCHITECTURE.md` for dependency and ownership rules and
`APP_SETUP.md` for the broader product, runtime, storage, permission, and
deployment plan.

## Workspace

The repository is a pnpm TypeScript workspace requiring Node.js 22 or later.

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The local I-AM implementation is documented in
`docs/IAM_IMPLEMENTATION.md`.

## Git Synchronization

```powershell
.\pull-all-changes.cmd
.\push-all-changes.cmd "Commit message"
```
