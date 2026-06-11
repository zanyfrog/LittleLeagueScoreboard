# Little League Scoreboard Current Architecture

## 1. Purpose

This document records the current recommended application structure for the
Little League Scoreboard.

The application is local-first and event-driven. Version 1 runs on one
computer through a browser interface, uses direct TypeScript libraries, and
stores authoritative data in JSONL files. The same capability boundaries also
support future REST containers, PostgreSQL storage, external I-AM integration,
and AWS deployment.

## 2. Architecture Terms

The architecture uses three related boundary types:

| Boundary | Meaning |
|---|---|
| Repository | Source-code, ownership, and versioning boundary |
| Library/package | Direct TypeScript interface used in the same process |
| Container | Independently deployable runtime exposing an HTTP API |

Version 1 should use one monorepo with clearly separated applications and
packages. A package or application may move to an independent repository later
when ownership, release cadence, security, or scaling justifies the split.

## 3. Recommended Monorepo

```text
LittleLeagueScoreboard/
  apps/
    landing/
    local-runtime/
    game-api/
    storage-api/
    media-api/
    iam-local-api/
  packages/
    contracts/
    game-engine/
    scoreboard/
    rosters/
    base-runners/
    count-controls/
    pitch-location/
    hit-location/
    field-diagram/
    storage-core/
    storage-jsonl/
    storage-postgres/
    media/
    iam-client/
    iam-local/
    ui/
    testing/
    config/
  data/
    sample/
    seed/
  docs/
    adr/
    diagrams/
    runbooks/
  infrastructure/
    docker/
    aws/
  tests/
    unit/
    integration/
    contract/
    permissions/
    recovery/
    e2e/
```

The API applications may remain thin wrappers or be deferred until container
mode is needed. Their interfaces and contracts should still be designed and
tested from the beginning.

## 4. Repositories, Libraries, and Containers

| Capability | TypeScript library/package | Container or executable | Responsibility |
|---|---|---|---|
| Contracts | `@ll-score/contracts` | None | Runtime schemas, TypeScript types, OpenAPI, event definitions, and stable error codes |
| Game engine | `@ll-score/game-engine` | `ll-score-game-api` | Games, rosters, lineups, scoring, corrections, replay, pitching, and statistics |
| Scoreboard feature | `@ll-score/scoreboard` | None | Reusable score, inning, half-inning, count, outs, and game-status display |
| Rosters feature | `@ll-score/rosters` | None | Reusable roster, lineup, batting-order, position, bench, batter, pitcher, and catcher views |
| Base runners feature | `@ll-score/base-runners` | None | Reusable occupied-base display, runner movement intents, corrections, and replay animation state |
| Count controls feature | `@ll-score/count-controls` | None | Reusable balls, strikes, and outs display and scorer controls |
| Pitch location feature | `@ll-score/pitch-location` | None | Reusable strike-zone and outside-zone pitch-location input and display |
| Hit location feature | `@ll-score/hit-location` | None | Reusable field-map hit-location input, display, and replay coordinates |
| Field diagram primitives | `@ll-score/field-diagram` | None | Shared field geometry, coordinate conversion, responsive SVG/canvas primitives, and accessibility helpers |
| Storage ports | `@ll-score/storage-core` | None | Persistence interfaces and transaction contracts |
| Local storage | `@ll-score/storage-jsonl` | `ll-score-storage-api` | JSONL reads and writes, locks, checksums, snapshots, recovery, backup, and restore |
| PostgreSQL storage | `@ll-score/storage-postgres` | Used behind `ll-score-storage-api` | Future PostgreSQL implementation of the storage ports |
| Media | `@ll-score/media` | `ll-score-media-api` | Managed media files, metadata, thumbnails, approval, visibility, and retention |
| Hosted identity | `@ll-score/iam-client` | External `i-am` service | Authentication, authorization, sessions, policy decisions, and effective access |
| Local identity | `@ll-score/iam-local` | `ll-score-iam-local-api` when needed | Offline development and local permission implementation using the I-AM contract |
| Shared UI | `@ll-score/ui` | None | Generic accessible components and design-system integration with no baseball workflow ownership |
| Browser application | Internal landing application code | `ll-score-landing` | Next.js PWA, browser-facing BFF, routing, session UX, and permission-filtered screens |
| Local launcher | `@ll-score/local-runtime` | `ll-score-local` executable | Starts the local server, owns the data directory, and opens the browser |
| Testing | `@ll-score/testing` | None | Fixtures, fakes, builders, and library/API conformance tests |
| Infrastructure | None | Deployment definitions | Docker Compose, AWS infrastructure, networking, secrets references, and observability |

## 5. Local Version 1 Runtime

```text
Browser
  -> ll-score-landing
      -> @ll-score/game-engine
          -> @ll-score/storage-core
              -> @ll-score/storage-jsonl
          -> @ll-score/media
          -> @ll-score/iam-local
```

The local runtime has these rules:

- Landing calls application services, not storage implementations.
- Landing assembles screens from reusable feature packages.
- Game Engine contains the business rules.
- Feature packages own presentation state, interaction rules, and reusable
  components for one process only.
- Storage implementations contain persistence behavior, not game rules.
- Only one process may write to a selected JSONL data directory.
- All writes use one serialized queue and an exclusive filesystem lock.
- The application works without an internet connection after installation.
- UI, validation, authorization, auditing, and transaction behavior are the
  same whether a capability is called as a library or through HTTP.

## 6. Future Container Runtime

```text
Browser
  -> ll-score-landing
      -> ll-score-game-api
          -> ll-score-storage-api
          -> ll-score-media-api
          -> external i-am
```

The browser should normally communicate only with Landing. Landing shapes the
user experience and proxies authentication. The Game API enforces application
rules. Storage enforces persistence and data-access rules. I-AM owns identity
and authorization policy.

Each callable container should expose:

```text
GET /health/live
GET /health/ready
GET /api/v1/capabilities
GET /api/v1/openapi.json
```

## 7. Canonical Dual Interface

Each callable business capability has one canonical TypeScript interface.
The direct implementation and HTTP client both implement that interface.

```ts
export interface RosterService {
  getTeamRoster(
    input: GetTeamRosterInput,
    context: RequestContext
  ): Promise<TeamRoster>;

  getGameLineup(
    input: GetGameLineupInput,
    context: RequestContext
  ): Promise<GameLineup>;

  getCurrentLineups(
    input: GetCurrentLineupsInput,
    context: RequestContext
  ): Promise<CurrentGameLineups>;
}
```

The standard implementation pattern is:

```text
createRosterService(...)       Direct in-process implementation
createRosterServiceRouter(...) REST wrapper around the implementation
RosterServiceHttpClient        Generated or contract-tested HTTP client
```

Business logic must not be duplicated in REST handlers. REST handlers validate
transport data, create request context, call the canonical service, and map
stable results and errors to HTTP.

## 8. Game Engine Services

Landing uses the following application-facing services from
`@ll-score/game-engine`:

| Service | Responsibility |
|---|---|
| `GameService` | Create, configure, start, suspend, finalize, approve, and publish games |
| `RosterService` | Team rosters, game rosters, batting orders, current lineups, positions, and opponent aliases |
| `ScoringService` | Pitches, balls in play, fielding actions, runner movements, score changes, undo, and corrections |
| `ReplayService` | Ordered replay frames, base-state transitions, fielding state, and permission-filtered replay output |
| `StatisticsService` | Derived game, player, team, pitching, participation, and bench-time statistics |
| `PitchingService` | Pitch counts, innings pitched, rule warnings, and audited overrides |
| `PeopleService` | People, player profiles, adult profiles, and parent-player relationships |
| `TeamService` | Organizations, seasons, teams, team-seasons, and historical memberships |
| `PublishingService` | Sanitized public game and replay projections |

These may be exposed through one `GameEngine` facade while remaining separate
internal capability interfaces.

## 8A. Landing Feature Libraries

Landing functionality is split into separately versionable feature libraries.
Each library must be usable on the live scoring screen, replay screen, public
viewer, team dashboard, or another future landing surface without copying its
logic.

| Package | Owns | Does not own |
|---|---|---|
| `@ll-score/scoreboard` | Scoreboard view model and score/game-status components | Authoritative score calculation or persistence |
| `@ll-score/rosters` | Roster and lineup view models, tables, cards, position selectors, and highlights | Membership storage or lineup event persistence |
| `@ll-score/base-runners` | Base occupancy, runner labels, movement animation, and correction intents | Authoritative runner-event validation or storage |
| `@ll-score/count-controls` | Balls, strikes, outs, fast controls, and correction intents | Authoritative count transition rules |
| `@ll-score/pitch-location` | 3x3 strike zone, special outside zones, handedness-aware labels, and selection | Updating the count or deciding the umpire result |
| `@ll-score/hit-location` | Field-map selection, coordinate normalization, markers, and replay placement | Determining the scoring result of a batted ball |
| `@ll-score/field-diagram` | Shared field geometry and rendering primitives used by location and replay packages | Feature workflows, game state, or storage |

Each feature package uses this internal shape:

```text
package/
  src/
    model/       Pure types, state, selectors, and view-model builders
    application/ Ports and adapters for Game Engine service data
    components/  Reusable React components and hooks
    index.ts      Deliberate public exports
  tests/
```

Feature package rules:

- Export a narrow public API from `index.ts`; do not expose internal files.
- Keep React components controlled where practical: data enters through typed
  props and user actions leave through typed callbacks or command intents.
- Pure models and coordinate functions must not import React or Next.js.
- Feature packages may depend on `@ll-score/contracts`, `@ll-score/ui`, and
  narrowly required feature primitives.
- Feature packages must not import Landing routes, Next.js server modules,
  JSONL/PostgreSQL adapters, or internal storage repositories.
- Landing owns page composition, routing, data loading, authorization-aware
  orchestration, and calls to Game Engine services.
- Game Engine validates and records commands emitted by feature packages.
- Reuse does not require independent deployment. These packages are libraries,
  not containers.

Recommended screen composition:

```text
Live scoring page
  -> @ll-score/scoreboard
  -> @ll-score/rosters
  -> @ll-score/base-runners
  -> @ll-score/count-controls
  -> @ll-score/pitch-location
  -> @ll-score/hit-location

Replay page
  -> @ll-score/scoreboard
  -> @ll-score/rosters
  -> @ll-score/base-runners
  -> @ll-score/pitch-location
  -> @ll-score/hit-location
```

## 9. Roster and Lineup Access

Landing reads roster and lineup information through `RosterService`.

```text
Landing
  -> RosterService
      -> RosterRepository and MembershipRepository
          -> JSONL now
          -> PostgreSQL later
```

Recommended library call:

```ts
const lineups = await rosterService.getCurrentLineups(
  { gameId },
  requestContext
);
```

Recommended REST endpoints:

```text
GET /api/v1/teams/{teamId}/roster
GET /api/v1/games/{gameId}/lineups
GET /api/v1/games/{gameId}/lineups/current
```

The returned current-lineup view should include both teams, batting order,
presence, current defensive position, bench status, current batter, current
pitcher, current catcher, tracking depth, and permission-filtered display
labels.

The following concepts must remain distinct:

| Concept | Meaning |
|---|---|
| Team roster | Date-effective membership for a team-season |
| Game roster | Historical snapshot of players available for one game |
| Game lineup | Batting order and initial game assignments |
| Current lineup | Game lineup after all active position, substitution, undo, and correction events |

`@ll-score/rosters` renders these service results and emits lineup or position
change intents. It does not call `RosterRepository` or persist changes itself.

## 10. Internal Storage Repositories

Game Engine services depend on interfaces from `@ll-score/storage-core`.
Landing must not call these repositories directly.

```text
PersonRepository
PlayerRepository
RelationshipRepository
OrganizationRepository
SeasonRepository
TeamRepository
MembershipRepository
GameRepository
RosterRepository
GameEventStore
MediaRepository
AuditRepository
TransactionManager
```

Example implementations:

```text
JsonlRosterRepository
JsonlGameEventStore
PostgresRosterRepository
PostgresGameEventStore
```

Consumers depend on repository interfaces rather than filesystem paths,
JSONL details, SQL, or database-specific models.

## 11. Authoritative Game Data

The ordered game event stream is authoritative.

Important event categories include:

```text
GameStarted
HalfInningStarted
PlateAppearanceStarted
PitchRecorded
BallPutInPlay
FieldingActionRecorded
RunnerMoved
RunnerOut
RunScored
DefensivePositionChanged
PitcherChanged
EventReversed
EventCorrected
GameFinalized
```

Derived projections include:

```text
Current game state
Current base state
Current lineups
Pitcher usage
Defensive alignment
Bench time
Statistics
Replay frames
Public replay
```

Snapshots improve read speed but are never the authoritative source. They must
be rebuildable by replaying active events in order.

## 12. Base Runner and Replay Data

Every runner movement is an event with a start location, destination, outcome,
reason, and related play.

```ts
export interface RunnerMovement {
  runnerId: string;
  from: "BATTER" | "FIRST" | "SECOND" | "THIRD";
  to: "FIRST" | "SECOND" | "THIRD" | "HOME" | "OUT";
  outcome: "SAFE" | "OUT";
  reason: string;
}
```

The base-state projection identifies the runner currently occupying each base:

```ts
export interface BaseState {
  first: RunnerOnBase | null;
  second: RunnerOnBase | null;
  third: RunnerOnBase | null;
}
```

Replay frames include both state and movement:

```ts
export interface ReplayFrame {
  eventId: string;
  eventOrder: number;
  movements: RunnerMovement[];
  baseStateBefore: BaseState;
  baseStateAfter: BaseState;
}
```

This allows live scoring and replay to show who is on each base, animate runner
movement, remove runners who are out, and update the score when runners reach
home.

`@ll-score/base-runners` consumes `BaseState` and `ReplayFrame` values for both
live and replay displays. Its movement and correction callbacks are submitted
to `ScoringService`, which remains responsible for validation and persistence.

## 13. Request and Authorization Context

Every application-service call receives a request context.

```ts
export interface RequestContext {
  actorId: string;
  organizationId?: string;
  teamId?: string;
  gameId?: string;
  requestId: string;
  correlationId: string;
  transport: "library" | "http";
  authorization: AuthorizationContext;
}
```

The local I-AM adapter and external I-AM service must share the same
authorization vocabulary and behavior:

```text
actor + action + resource + scope + fields + context
  -> allow, deny, or partial decision
  -> permitted data shape
```

Navigation hiding is only a user-experience feature. Server-side service and
storage boundaries must still enforce authorization.

The local implementation is available now in `@ll-score/iam-local`. It uses
Argon2id credentials, hashed session tokens, append-only JSONL policy records,
scope-aware assignments, explicit restrictions, and a separate security audit
stream. It does not require Game Engine or storage implementations to exist.
Data-processing services later consume its `IamService.authorize()` contract.

## 14. Public Data

Public pages must read a sanitized publishing projection rather than raw game,
roster, event, correction, relationship, or media data.

Version 1 public output:

- Includes only final games approved for publication.
- Uses approved anonymous player labels.
- Excludes private schedules and location details.
- Excludes membership and family relationship data.
- Excludes media.
- Includes only permission-safe correction descriptions.

## 15. Styling

Landing uses a versioned shared company stylesheet followed by local app
overrides.

```text
Company base styles
  -> Company theme and components
      -> App overrides
          -> Component-specific styles
```

CSS cascade layers should enforce:

```text
company < app < components
```

The app must not edit shared company styles directly.

## 16. Core Dependency Rules

```text
Landing/UI
  -> Feature libraries
  -> Game Engine services
      -> Storage interfaces
          -> JSONL or PostgreSQL adapters

Landing/UI
  -> UI package
  -> Contracts

Feature libraries
  -> Contracts
  -> UI package
  -> Field diagram primitives when needed

Game Engine
  -> Contracts
  -> Storage interfaces
  -> I-AM interface

Storage adapters
  -> Storage interfaces
  -> Contracts
```

Forbidden dependencies:

- Landing directly reading or writing JSONL or PostgreSQL.
- Landing directly using internal storage repositories.
- Feature libraries calling storage repositories or filesystem/database APIs.
- Feature libraries importing Landing routes or Next.js server-only code.
- One feature library silently owning another feature's business workflow.
- Storage adapters implementing scoring or baseball rules.
- REST handlers duplicating Game Engine rules.
- Browser code acting as the final authorization authority.
- Snapshots becoming a second authoritative game record.

## 17. Current Naming Recommendation

Use `ll-score-*` for deployables and `@ll-score/*` for TypeScript packages.

```text
Deployables:
  ll-score-landing
  ll-score-local
  ll-score-game-api
  ll-score-storage-api
  ll-score-media-api
  ll-score-iam-local-api

Packages:
  @ll-score/contracts
  @ll-score/game-engine
  @ll-score/scoreboard
  @ll-score/rosters
  @ll-score/base-runners
  @ll-score/count-controls
  @ll-score/pitch-location
  @ll-score/hit-location
  @ll-score/field-diagram
  @ll-score/storage-core
  @ll-score/storage-jsonl
  @ll-score/storage-postgres
  @ll-score/media
  @ll-score/iam-client
  @ll-score/iam-local
  @ll-score/ui
  @ll-score/local-runtime
  @ll-score/testing
  @ll-score/config
```

## 18. Current Source-of-Truth Rule

This document records the current component and access architecture.
`APP_SETUP.md` remains the broader product and runtime setup document.
Detailed game behavior remains in the schema and summary documents.
`CURRENT_DATABASE_REPLAY.md` records the current database, player-position,
and position-aware replay implementation decisions.

When implementation begins:

1. Landing calls Game Engine services.
2. Game Engine services call storage repository interfaces.
3. JSONL is the initial repository implementation.
4. PostgreSQL is a future interchangeable repository implementation.
5. Direct-library and REST access must produce equivalent authorized behavior.
6. Landing functionality is implemented in reusable, process-focused feature
   packages and composed by Landing routes.
