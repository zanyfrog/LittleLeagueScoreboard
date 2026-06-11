# Little League Replay App — Summary

## Goal

Create a live scoring and replay app for kid-pitch Little League games, currently ages 10–12.

The app should track the game as a sequence of events so it can later replay the game in an animated way.

---

## Current Decisions

| Area | Decision |
|---|---|
| Age group | 10–12 kid-pitch Little League |
| Batting | Continuous batting order; everyone hits even if on the bench |
| Stealing | Stealing is allowed but limited; app does not need to enforce rules in version 1 |
| Scoring style | Track “what happened,” not full official scoring rules |
| Live scorer | One person will likely score live |
| Replay | Show pitch, hitting, fouls, fielding involvement, runner movement, and score changes |
| Hit location | Mouse click or touchscreen tap on a field map |
| Pitch count | Track pitch count and innings pitched |
| Pitching rule | Current rule: pitcher can pitch up to 2 innings; should be configurable |
| Defense | Track defensive position and bench time |
| Media | Images/videos can be attached to each event/action |
| Time | Store all event times in UTC |
| Player display | Jersey number + first name/nickname |
| Permissions | External `i-am` module handles authentication, authorization, and permission sets |

---

## Core Design

Use a master event timeline.

Every important action should have:

- `event_order`
- `event_time_utc`
- `logged_at_utc`
- inning
- top/bottom
- related player(s)
- related pitch, hit, fielding play, runner movement, or media item
- score/count/outs after the event

`event_order` controls replay sequence.  
`event_time_utc` records when the baseball action happened.  
`logged_at_utc` records when the scorer entered the action.

---

## Most Important Tables

```text
teams
players
games
game_teams
game_rosters
innings
plate_appearances
pitches
balls_in_play
fielding_plays
base_runner_events
steal_attempts
fielders_choice_events
game_events
game_state_snapshots
base_state_snapshots
defensive_alignment
player_game_changes
pitching_rules
pitcher_usage
event_media
media_player_tags
player_locations
field_zones
users
user_team_roles
parent_player_links
```

---

## Replay Foundation

The following tables are most important for animated replay:

```text
game_events
game_state_snapshots
base_state_snapshots
pitches
balls_in_play
fielding_plays
base_runner_events
defensive_alignment
event_media
```

These allow the app to know:

- Who was batting
- Who was pitching
- Who was on base
- Who was playing each defensive position
- What pitch happened
- Whether there was swing/contact/foul
- Where the ball was hit
- Who fielded the ball
- Whether there was a throw, catch, tag, or missed play
- Which runners advanced
- Who was safe or out
- What the count, outs, and score became
- Whether images or videos are attached to the event

---

## Media Design

Images/videos should be attachable to:

- Game
- Inning
- Plate appearance
- Pitch
- Ball in play
- Fielding play
- Runner event
- Generic game event

Each media record should store:

```text
media type
media URL
thumbnail URL
file name
file size
MIME type
captured_at_utc
uploaded_at_utc
replay_offset_ms
duration_ms
visibility level
caption
notes
```

Recommended visibility levels:

```text
public
parents
team
coaches
admins
```

Because the players are children, media should support approval and restricted visibility.

---

## Pitching

Track:

- Pitch count
- Balls thrown
- Strikes thrown
- Batters faced
- Innings pitched
- First pitch time
- Last pitch time

Pitching rules should be configurable because the current 2-inning rule may change.

---

## Defense and Bench Time

Track defensive alignment by inning, half-inning, event order, and time.

This allows the app to calculate:

- Who played each position
- When a player changed positions
- Who was on the bench
- How much bench time each player had
- Pitcher/catcher usage

---

## Baserunner Tracking

Every runner movement should be stored as a separate event.

Track:

- Runner
- Start base
- End base
- Highest base achieved
- Reason for movement
- Steal attempt
- Caught stealing
- Force out
- Tag out
- Fielder’s choice
- Run scored
- RBI credit
- Safe/out call

This is needed to replay the game correctly and update the score/base state.

---

---

---

## Live Scoring Screen Update

The app should show the current lineups/players for each team during scoring.

The scorer should always be able to see:

```text
Current batter
Current pitcher
Current inning
Top/bottom
Balls
Strikes
Outs
Score
Runners on base
Defensive alignment
```

Each player should have a position dropdown so the scorer can quickly move players between positions.

Because this level allows four outfielders, the app should support:

```text
LF
LCF
RCF
RF
```

The app should also support:

```text
Bench
Unknown
```

## Manual Corrections

The app needs a way to manually adjust:

```text
Balls
Strikes
Outs
Score
Base runners
Current batter
Current pitcher
Inning/top-bottom
```

This is needed because the scorer may get sidetracked during a pitch or batter.

Manual corrections should be stored as timeline events and audit records, not silent changes.

Recommended correction examples:

```text
Count corrected from 1-1 to 2-1
Outs corrected from 1 to 2
Runner on second corrected to #12 Jackson
Pitcher corrected to Opponent #8
```

Corrections can optionally be shown during replay as notes.


---

---

## Pitch Location and Fast Scoring Update

Pitch location and pitch result should be separate.

A low outside pitch should not automatically become a ball. The umpire's call/result should update the count.

Recommended workflow:

```text
Optional: tap pitch location
Required: tap result, such as Ball / Called Strike / Swinging Strike / Foul / In Play / HBP
```

The app should support a 3x3 strike zone:

```text
High Inside     High Middle     High Outside
Middle Inside   Middle Middle   Middle Outside
Low Inside      Low Middle      Low Outside
```

It should also support special areas:

```text
Far Inside
Far Outside
Very High
Dirt
Bounced In
Behind Batter
Over Batter
Wild Inside
Wild Outside
Wild High
Wild Low
Unknown
```

The app should support quick result buttons:

```text
Ball
Called Strike
Swinging Strike
Foul
In Play
Hit By Pitch
Unknown Ball
Unknown Strike
Missed Pitch
Wild Pitch
Passed Ball
```

Batter handedness should be tracked because it controls inside/outside labeling.

Store:

```text
Player bats: Left / Right / Switch / Unknown
Pitch batter stance: Left / Right / Switch / Unknown
```

Hit by pitch should be tracked as a pitch result and should create a runner movement event from Batter to 1B.

Bench time should be displayed simply by inning, but stored by event/time so mid-inning pitching or defensive changes are still accurate.


## Updated Decisions: Both Teams, Undo, and Transparent Corrections

The app should track defensive/player positions for both teams.

Even though the user's team will receive more detailed tracking, opponent positions are useful for:

```text
Replay accuracy
Pitcher changes
Fielding plays
Bench tracking
Who attempted or made a play
```

The position dropdowns should be available for both teams and should support:

```text
P
C
1B
2B
3B
SS
LF
LCF
RCF
RF
BENCH
UNKNOWN
```

The app should support:

```text
Undo Last Action
Change/Correct Existing Action
```

Corrections should be transparent.

Recommended rule:

```text
Everyone can see that a correction happened.
Correction notes should appear in the replay/timeline by default.
Coaches/admins may see more detail if permission sets require filtering.
```

Examples:

```text
Undo: Previous pitch entry was undone.
Correction: Count changed from 1-1 to 2-1.
Correction: Outs changed from 1 to 2.
Correction: Pitcher corrected.
Correction: Runner placement corrected.
```

Do not silently overwrite game history. Preserve the original event and mark it as undone, corrected, or superseded.


## Opponent Tracking Decision

The app will mostly focus on the user's team and players.

The opponent should still be tracked enough to keep the game accurate and replayable.

Recommended model:

```text
User team: full tracking
Opponent: limited tracking
```

Track the following for both teams:

```text
Pitcher changes
Current pitcher
Pitch count if possible
Batting order slot
Batter result
Runs
Outs
Runner movement
Steals/caught stealing
Important fielding involvement
Scoring plays
```

Opponent players can be stored as lightweight placeholders such as:

```text
Opponent #8
Opponent Pitcher #12
Blue Team Batter 4
```

This avoids needing too much personal information for the other team while still supporting scoring, replay, and pitcher-change tracking.


## Suggested Version 1 Scope

Build first:

- Team and player setup
- Game creation
- Continuous batting order
- Live scoring screen
- Pitch tracking
- Hit/foul location by tap
- Ball-in-play tracking
- Fielding involvement
- Runner movement
- Steals and caught stealing
- Fielder’s choice
- Base state snapshots
- Game state snapshots
- Defensive alignment
- Bench tracking
- Pitch count and innings pitched
- Event media upload
- UTC timestamps
- Permission integration with `i-am`

Save for later:

- Stealing rule enforcement
- Official scoring edge cases
- Advanced stats
- Realistic movement paths
- Automated weather
- Multi-scorer conflict resolution
- Automated video sync

---

## Original Repo/Container Split

This was the original coarse-grained proposal. The current architecture uses
the monorepo and reusable feature-package model documented below and in
`CURRENT_ARCHITECTURE.md`.

```text
ll-replay-landing  = frontend UI
ll-replay-orm      = database schema, migrations, queries
ll-replay-i-am     = users, roles, permission sets
ll-replay-media    = optional media processing/storage
ll-replay-lib      = original shared components/helpers proposal
```

## Reusable Landing Feature Libraries

Landing functionality should be modularized into one reusable library per
scoring or display process:

```text
@ll-score/scoreboard
@ll-score/rosters
@ll-score/base-runners
@ll-score/count-controls
@ll-score/pitch-location
@ll-score/hit-location
@ll-score/field-diagram
```

The same libraries should be composed into live scoring, replay, public
viewing, and team/game review screens. They receive typed state and emit typed
user intents. They do not read JSONL, query PostgreSQL, or bypass Game Engine
services.

`pitch-location` and `hit-location` remain separate because they represent
different observations:

```text
Pitch location = where the pitch crossed or traveled near the plate
Hit location   = where the batted ball traveled or landed on the field
```

`field-diagram` contains shared coordinate and rendering primitives so the two
location libraries and replay do not duplicate field geometry.

These are libraries inside Landing, not independently deployed containers.
Container boundaries remain at Landing, Game API, Storage API, Media API, and
I-AM.

---

## Remaining Clarifications

The app can move forward now, but these would still help:

1. What exactly can public users see?
2. Should parents see all team players or only their own child?
3. Who can upload media?
4. Should uploaded media require approval?
5. Should the scorer be able to undo/edit/reorder events?
6. Should the app track both teams equally or one team in more detail?
7. Should stats be calculated automatically in version 1?
8. Should pitch-count limits warn only or block action?
9. Should weather be manual or automatic?
10. Should there be tournament/multiple-games-per-day support?

---

## Final Recommendation

The core app should be event-driven.

The most important data objects are:

```text
game_events
event_order
event_time_utc
logged_at_utc
game_state_snapshots
base_state_snapshots
pitches
balls_in_play
fielding_plays
base_runner_events
defensive_alignment
pitcher_usage
event_media
```

This structure supports live scoring first and animated replay later.
