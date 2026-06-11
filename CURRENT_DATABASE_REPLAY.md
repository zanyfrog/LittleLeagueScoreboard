# Little League Scoreboard Database and Replay

## 1. Current Decision

Version 1 uses append-only JSONL files as the working database. PostgreSQL is
the future production database and implements the same repository interfaces.

```text
Landing
  -> Game Engine
      -> @ll-score/storage-core
          -> @ll-score/storage-jsonl now
          -> @ll-score/storage-postgres later
```

Landing and reusable feature packages never read JSONL or SQL directly.

## 2. Authoritative and Derived Data

Catalog records and ordered game events are authoritative. Current game state,
base state, lineups, defensive alignment, statistics, and replay frames are
derived projections that can be rebuilt.

Every JSONL record uses a transaction envelope containing:

```text
transactionId
streamId
streamVersion
schemaVersion
occurredAtUtc
actorId
operation
payload
previousChecksum
checksum
```

Writes are serialized, version checked, flushed before success is returned,
and protected by an exclusive data-directory lock. Undo and correction append
new events instead of deleting or rewriting history.

## 3. Player Positions

The shared position choices are:

```text
P        Pitcher
C        Catcher
1B       First Base
2B       Second Base
3B       Third Base
SS       Shortstop
LF       Left Field
CF       Center Field
RF       Right Field
LCF      Left Center Field
RCF      Right Center Field
BENCH    Bench
BULLPEN  Bullpen
UNKNOWN  Unknown
```

Standard three-outfielder and Little League four-outfielder alignments are
both supported. A team may normally assign only one player to each field
position. `BENCH`, `BULLPEN`, and `UNKNOWN` accept multiple players.

Batting order and defensive assignment are independent. A player on the bench
or in the bullpen remains in the continuous batting order.

## 4. Position Changes in Replay

Position changes are part of the ordered replay. Changing a lineup dropdown
appends a `DefensivePositionChanged` event containing the player, team, old
position, new position, event order, time, and optional reason.

Each replay frame contains:

- Base state before and after the event.
- Defensive alignment before and after the event.
- Runner movements.
- Defensive position changes.

The replay interface displays fielders at their field locations, bench players
in a labeled bench area, and bullpen players in a separate labeled bullpen
area. Replay updates those locations at the event where the change occurred.

Private and authorized team replay retains the full event history. Public
replay uses sanitized player labels and may omit correction details.

## 5. Source Packages

```text
packages/contracts
  Shared baseball, event, projection, and storage-envelope contracts

packages/storage-core
  Repository ports, event-store port, transaction manager, errors, and
  storage conformance contracts

packages/storage-jsonl
  Data-directory management, locking, serialized writes, checksums,
  repositories, event store, projections, recovery, backup, and restore

packages/storage-postgres
  PostgreSQL configuration and ordered SQL migration scaffold

apps/storage-api
  Future thin HTTP wrapper over the selected storage implementation
```

## 6. Runtime Data Directory

```text
%LOCALAPPDATA%\LittleLeagueScoreboard\data\
  manifest.json
  catalog\
    people.jsonl
    player-profiles.jsonl
    adult-profiles.jsonl
    organizations.jsonl
    seasons.jsonl
    teams.jsonl
    team-seasons.jsonl
    memberships.jsonl
    relationships.jsonl
    games.jsonl
  games\
    {game-id}\
      roster.jsonl
      events.jsonl
      corrections.jsonl
      snapshots\
        current-game-state.json
        current-base-state.json
        current-lineups.json
        defensive-alignment.json
        replay-frames.json
        statistics.json
  audit\
    audit-events.jsonl
  imports\
  exports\
  backups\
  recovery\
```

I-AM continues to own credentials, sessions, permission sets, assignments,
restrictions, and security audit data in its separate store.

## 7. PostgreSQL Path

PostgreSQL migrations establish catalog, membership, game, roster, event,
projection, audit, and position structures. Stable IDs and event order are
preserved when importing JSONL archives. PostgreSQL is not enabled in version
1; attempting to create its adapter returns a clear not-configured error.

## 8. Required Verification

- Append and read records without losing order.
- Reject stale stream versions.
- Reject duplicate active field assignments.
- Allow multiple bench and bullpen assignments.
- Rebuild alignment and replay frames from events.
- Preserve mid-inning position changes.
- Detect checksum corruption and interrupted writes.
- Back up and restore a data directory.
- Keep JSONL and future PostgreSQL behavior behind identical interfaces.
