# Little League Scoreboard Application Setup

## 1. Purpose

The Little League Scoreboard application records live games as an ordered
event timeline. The same events support live scoring, corrections, statistics,
pitching usage, player participation, media, and animated replay.

The initial release runs on one computer through a browser UI and stores its
data locally in readable text-based files. The architecture must also support
future container deployment, PostgreSQL storage, AWS hosting, and integration
with the external `i-am` identity and authorization platform.

## 2. Confirmed Product Decisions

| Area | Decision |
|---|---|
| Initial users | Multiple teams and seasons |
| Initial runtime | One computer with a locally hosted browser UI |
| Initial storage | JSONL event and record files |
| CSV usage | Validated imports and derived reports |
| Backup format | Portable ZIP archive with checksums |
| Media | Managed local media directory with approval workflow |
| Player identity | Independent from teams and seasons |
| Team membership | Historical, date-effective, and season-specific |
| Concurrent teams | A player may belong to multiple teams concurrently |
| Roles | Additive permission sets; roles are not mutually exclusive |
| Scoring | One active scorer per game in version 1 |
| Corrections | Append-only, transparent undo and correction events |
| Public access | Approved final games with anonymized data replay |
| Public media | Not allowed in version 1 |
| Parent access | Team game context with linked-child detail |
| Pitch limits | Warning with an audited override |
| Statistics | Basic statistics derived from the event timeline |
| Future hosting | AWS |
| Future database | PostgreSQL |

## 3. Repository And Container Model

Use individually versioned repositories. Every callable business capability
must be available through both:

1. A direct TypeScript library interface for in-process use.
2. A versioned REST/OpenAPI interface for container or remote use.

Recommended repositories:

```text
ll-score-contracts
  Shared schemas, OpenAPI definitions, event types, and generated clients

ll-score-game-engine
  Scoring, replay, corrections, rosters, pitching, and statistics
  Publishes a private npm package and an API container

ll-score-storage-jsonl
  JSONL repositories, integrity checks, backup, restore, and recovery
  Publishes a private npm package and an API container

ll-score-storage-postgres
  Future PostgreSQL implementation
  Publishes a private npm package and an API container

ll-score-media
  Local media management, metadata, thumbnails, approval, and retention
  Publishes a private npm package and an API container

ll-score-iam-adapter
  Development identity provider and future external I-AM integration
  Publishes a private npm package and an API container

ll-score-landing
  Next.js PWA and browser-facing request layer

ll-score-local-runtime
  Local launcher that embeds the direct library implementations

ll-score-infrastructure
  Docker Compose, AWS infrastructure, deployment, and observability
```

Pure contract, documentation, UI, and infrastructure repositories do not need
artificial business APIs. Domain, storage, media, and identity capabilities do.

## 4. Canonical Dual Interface

Each callable capability defines one canonical application interface.

```ts
export interface GameEngine {
  recordPitch(
    input: RecordPitchInput,
    context: RequestContext
  ): Promise<GameState>;

  undoEvent(
    input: UndoEventInput,
    context: RequestContext
  ): Promise<GameState>;

  getReplay(
    input: GetReplayInput,
    context: RequestContext
  ): Promise<Replay>;
}
```

Each capability provides:

```text
createGameEngine(...)       Direct in-process implementation
createGameEngineRouter(...) REST wrapper around the same implementation
GameEngineHttpClient        Generated client implementing the same interface
```

Rules:

- Business rules exist only in the canonical service implementation.
- REST handlers only validate transport data, build context, and call services.
- Direct-library calls cannot bypass validation, permissions, auditing, or
  transaction handling.
- API and library modes return equivalent outputs and stable error codes.
- Every call carries actor, organization, team, request ID, correlation ID,
  transport type, and authorization context.
- REST routes are versioned under `/api/v1`.
- OpenAPI is the authoritative network contract.
- JSON Schema or TypeBox schemas drive TypeScript types and runtime validation.
- Direct packages are published as immutable private npm packages.
- Packages, API contracts, event schemas, and storage formats use semantic
  versioning and a documented compatibility matrix.

## 5. Local Runtime

The initial installation uses the direct libraries in one local process:

```text
Browser
  -> local landing/server process
      -> game-engine library
      -> JSONL storage library
      -> media library
      -> local I-AM adapter
```

The local launcher:

- Starts the local server and browser UI.
- Listens on localhost by default.
- Claims exclusive ownership of the selected data directory.
- Prevents a second writer from opening the same directory.
- Detects stale locks and offers validated recovery.
- Releases the lock during a clean shutdown.
- Works without an internet connection after installation.

Only one process may write a JSONL data directory. Other processes or devices
must use the owning process's API. Direct-library and API modes must never
write the same directory concurrently.

## 6. Local Data Directory

The default Windows location is:

```text
%LOCALAPPDATA%\LittleLeagueScoreboard\data\
  manifest.json
  catalog/
    people.jsonl
    player-profiles.jsonl
    adult-profiles.jsonl
    organizations.jsonl
    seasons.jsonl
    teams.jsonl
    team-seasons.jsonl
    memberships.jsonl
    permission-assignments.jsonl
    relationships.jsonl
    games.jsonl
  games/
    {game-id}/
      roster.jsonl
      events.jsonl
      corrections.jsonl
      snapshots/
        current-game-state.json
        current-base-state.json
        statistics.json
  audit/
    audit-events.jsonl
  media/
    {game-id}/
      originals/
      thumbnails/
      media-index.jsonl
  imports/
  exports/
  backups/
  recovery/
```

The UI provides an **Open Data Folder** action and supports selecting a
different data directory.

## 7. JSONL Storage Rules

JSONL is authoritative. JSON snapshots and CSV reports are derived.

Each JSONL line is a complete transaction envelope:

```text
transaction_id
stream_id
stream_version
schema_version
occurred_at_utc
actor_id
operation
payload
previous_checksum
checksum
```

Storage requirements:

- Serialize writes through one write queue and an exclusive filesystem lock.
- Append complete transactions rather than partially updating documents.
- Flush successful writes before confirming them to the UI.
- Use stream versions and checksums to detect corruption or unexpected edits.
- Quarantine an incomplete final line after interrupted writes.
- Write snapshots to temporary files and atomically rename them.
- Rebuild snapshots, indexes, and statistics from authoritative JSONL.
- Preserve original events when undoing or correcting actions.
- Run versioned file migrations after creating a pre-migration backup.
- Keep files readable for inspection, but do not support direct manual edits.

## 8. People, Players, Adults, And Team History

Use a shared `person` identity so one individual can have several profiles and
responsibilities.

```text
people
adult_profiles
player_profiles
parent_player_relationships
```

A person may:

- Have a player profile.
- Have an adult profile.
- Be both an adult and a player.
- Be a player on one team and a coach for another team.
- Be a coach, scorer, and administrator at the same time.

Player identity is not owned by a team. Do not store a permanent `team_id`,
jersey number, or current position on the player profile.

Use these entities:

```text
organizations
seasons
teams
team_seasons
player_team_memberships
```

Each membership stores:

```text
membership_id
player_id
team_season_id
membership_type
membership_status
jersey_number
primary_position
joined_on
left_on
created_at_utc
created_by
updated_at_utc
archived_at_utc
notes
```

Membership rules:

- A player may have concurrent memberships with different teams.
- Membership types include regular, guest, tournament, and temporary.
- Duplicate overlapping memberships for the same player and team-season are
  rejected.
- Transfers close or append membership records; they never rewrite history.
- Past memberships remain attached to the player after the player leaves.
- Membership corrections require permission and an audit event.

Game rosters reference the applicable membership and snapshot:

```text
display_name_snapshot
jersey_number_snapshot
team_name_snapshot
batting_order
game_role
is_present
```

Later changes to a person, team, jersey number, or membership cannot alter
completed games or replays. Team statistics use the team represented in each
historical game; career statistics aggregate across memberships.

## 9. Permission Model

Permissions are additive and scope-aware. A person is never limited to one
role column.

Use:

```text
permission_sets
person_permission_assignments
parent_player_relationships
```

Each assignment contains:

```text
assignment_id
person_id
permission_set_id
scope_type
scope_id
effective_start_utc
effective_end_utc
status
granted_by
created_at_utc
updated_at_utc
```

Supported scope examples:

```text
application
organization
team
season
team-season
game
player
```

Initial permission sets:

- Public
- Authenticated
- Player
- Parent/Guardian
- Scorer
- Coach
- Team Admin
- Platform Admin
- Security Admin

Effective permissions are the union of all active assignments in the
applicable scope. Explicit restrictions override grants. Administrative access
does not automatically expose all player data.

Examples:

```text
Person: Alex Smith
Profiles: Adult, Player
Assignments:
  Player - Team A, 2026 season
  Coach - Team B, 2026 season
  Scorer - Team B games
  Team Admin - Team B
```

The local adapter implements this contract for development. Production must
fail closed unless the external `i-am` service can provide current
authorization decisions.

## 10. Event-Driven Game Model

`game_events` is the authoritative ordered timeline.

Each event includes:

```text
game_event_id
game_id
event_order
event_time_utc
logged_at_utc
event_type
event_status
inning_number
half_inning
actor_id
client_event_id
idempotency_key
payload
superseded_by_event_id
correction_note
```

Event details cover:

- Pitches and pitch location.
- Balls in play and hit location.
- Fielding involvement.
- Runner movement.
- Defensive alignment and bench changes.
- Pitcher changes and pitching usage.
- Score, count, and out changes.
- Media attachments.
- Manual corrections and reversals.

Undo and correction are different operations:

- **Undo Last Action** appends a reversal event.
- **Change/Correct Existing Action** appends a correction and superseding
  event.

Original events are never silently deleted or overwritten. Game state, base
state, pitcher usage, bench time, replay, and basic statistics are rebuildable
projections.

## 11. Landing Routes

### Public routes

```text
/
/games/public
/games/public/[gameId]
/games/public/[gameId]/replay
/login
/unauthorized
/offline
```

### Authenticated game routes

```text
/dashboard
/games
/games/new
/games/[gameId]
/games/[gameId]/setup
/games/[gameId]/score
/games/[gameId]/timeline
/games/[gameId]/replay
/games/[gameId]/stats
/games/[gameId]/media
/games/[gameId]/publish
```

### Team and season routes

```text
/teams
/teams/new
/teams/[teamId]
/teams/[teamId]/roster
/teams/[teamId]/games
/teams/[teamId]/media
/seasons
/seasons/[seasonId]
```

### Person and player routes

```text
/people
/people/[personId]
/players
/players/new
/players/[playerId]
/players/[playerId]/history
/players/[playerId]/stats
/players/[playerId]/media
/players/[playerId]/memberships/new
```

### Local data routes

```text
/imports
/exports
/backups
/data-health
/settings/storage
```

### Administration routes

```text
/admin
/admin/people
/admin/permissions
/admin/relationships
/admin/media-approval
/admin/audit
/admin/settings
/admin/pitching-rules
```

Navigation is permission-filtered, but the canonical service layer also
enforces authorization for every action.

## 12. Public, Parent, And Media Visibility

Public access:

- Only final games approved by a coach or administrator are published.
- Player labels are anonymized.
- Public output excludes private schedules, location details, membership
  history, and media.

Approved parents and guardians:

- See live team game context.
- See detailed information for linked children.
- See approved relevant media.
- See their own pending uploads.

Media:

- Scorers, coaches, and approved parents may upload.
- Coach or administrator approval is required before broader team visibility.
- No media is anonymously public in version 1.
- Media is retained through the season plus one year, followed by a warning,
  backup opportunity, and audited deletion workflow.

## 13. Local Media Storage

Selected media is copied into the managed application data directory.

Store:

```text
media_id
game_id
relative_path
original_file_name
generated_file_name
mime_type
file_size
checksum
captured_at_utc
uploaded_at_utc
uploaded_by
approval_status
visibility_level
player_tags
retention_date
```

Use generated collision-resistant storage names. Do not rely on the original
external file path after import.

## 14. Import, Export, Backup, And Recovery

CSV is supported for:

- Player and roster import.
- Team, season, schedule, and opponent import.
- Game summaries and statistics.
- Pitch count, bench time, and player-history reports.

Imports must be validated and previewed before commit. Invalid rows produce a
clear error report.

Portable ZIP archives include:

```text
archive-manifest.json
catalog JSONL
game JSONL
derived JSON snapshots
CSV reports
media files and metadata
checksums.json
```

Backup rules:

- Create automatic backups before migrations, imports, and bulk corrections.
- Keep rotating local backups.
- Validate checksums before restore.
- Restore into a temporary directory before atomically replacing active data.
- Use the same archive format as the future PostgreSQL migration input.

## 15. Pitching Rules And Statistics

Pitching rules are configurable by league, division, and season.

Version 1:

- Tracks pitches, balls, strikes, batters faced, innings pitched, first pitch,
  and last pitch.
- Shows escalating warnings near configured limits.
- Requires an authorized override reason after a limit is reached.
- Audits overrides without blocking continued scoring.

Basic derived statistics include:

- Plate appearances and outcomes.
- Pitch counts and pitching usage.
- Runs and outs.
- Steals and caught stealing.
- Defensive participation.
- Bench time.

Strict official scoring, advanced analytics, and automated rule enforcement
are deferred.

## 16. Future Container And AWS Runtime

The future distributed path is:

```text
Browser
  -> landing
      -> game-engine API
          -> storage API
          -> I-AM API
      -> media API
```

Each callable container exposes:

```text
GET /health/live
GET /health/ready
GET /api/v1/capabilities
GET /api/v1/openapi.json
```

The planned AWS deployment uses:

- ECS Fargate for containers.
- An Application Load Balancer exposing only `landing`.
- ECS Service Connect for internal APIs.
- Private encrypted RDS PostgreSQL.
- Private KMS-encrypted S3 media storage.
- Presigned multipart uploads.
- CloudFront OAC and short-lived signed URLs.
- Secrets Manager, CloudWatch, ECR scanning, and AWS WAF.

## 17. PostgreSQL Migration Contract

Consumers depend on repository interfaces, not filesystem paths.

```text
PersonRepository
PlayerRepository
MembershipRepository
TeamRepository
GameRepository
GameEventStore
PermissionAssignmentRepository
MediaRepository
AuditRepository
TransactionManager
```

The migration utility will:

1. Validate portable archives and schema versions.
2. Preserve existing stable IDs.
3. Load people, profiles, teams, seasons, memberships, and games.
4. Replay authoritative events into PostgreSQL.
5. Rebuild and compare projections and statistics.
6. Upload media and replace relative paths with managed object references.
7. Produce counts, checksum results, and an exception report.

## 18. Testing Requirements

Every callable repository passes the same conformance suite through:

1. Its direct library.
2. Its running API container through the generated client.

Required scenarios:

- Equivalent output, validation, permissions, errors, audit, and idempotency
  between library and API access.
- Player transfers and concurrent team memberships preserve history.
- Historical games retain original team, jersey, and display snapshots.
- Additive permission sets work for player/coach/scorer/admin combinations.
- Explicit restrictions override grants.
- Interrupted JSONL writes recover safely.
- Checksums detect corruption and unsupported edits.
- Snapshots and statistics rebuild from events.
- CSV imports validate before commit.
- Backup, restore, migration, and rollback are atomic and verifiable.
- Local scoring works without an internet connection.
- Public APIs do not reveal names, media, unpublished games, or protected
  location and membership information.
- Responsive and accessible behavior works on phone, tablet, and desktop.

## 19. Implementation Phases

1. Create shared contracts, interface standards, versioning rules, and the
   conformance harness.
2. Implement JSONL storage as a direct package and a thin API container.
3. Implement people, profiles, memberships, permission assignments, and
   historical roster snapshots.
4. Implement the game engine, event timeline, projections, undo, and
   corrections as a package and API container.
5. Build the local runtime with exclusive data-directory ownership.
6. Build the Next.js PWA and the routes listed in this document.
7. Add media, import/export, backup, restore, and recovery.
8. Add I-AM integration and verify both embedded and container modes.
9. Add PostgreSQL, AWS infrastructure, and production hardening.

## 20. Source Documents

This setup consolidates and extends:

- `little-league-replay-app-summary.md`
- `little-league-replay-app-schema.md`
- `G:\My Drive\Projects\AI\Docs\i-am\new_app_generic_process_template_v7.md`
- `G:\My Drive\Projects\AI\Docs\i-am\authentication-and-authorization-current-v4.md`
- `G:\My Drive\Projects\AI\Docs\i-am\company-stylesheet-integration.md`

When the older schema notes conflict with this document, this document controls
the application setup. Detailed schema work should preserve the event-driven
intent of the older notes while adopting the person, membership, permission,
local-storage, and dual-interface decisions recorded here.
