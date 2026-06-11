# Little League Live Scoring and Replay App — Schema and Design Notes

## Purpose

This app tracks two Little League teams playing each other and stores enough detail to recreate the game as a replay.

The app should track:

- Teams and players
- Game schedule, location, weather, and field condition
- Continuous batting order
- Defensive alignment and bench time
- Every pitch
- Ball contact, foul balls, and hit locations
- Fielding involvement and attempted plays
- Baserunner movement, steals, caught stealing, fielder’s choice, and achieved bases
- Pitch count and pitching usage
- Images or videos associated with each event/action
- UTC timestamps for time-zone-safe storage
- Permission sets supplied by a separate `i-am` module/repo/container

---

## Current App Decisions

| Area | Decision |
|---|---|
| Age level | Kid-pitch Little League, ages 10–12 |
| Batting order | Continuous batting order; everyone can hit whether on bench or in field |
| Stealing | Stealing is allowed with limits, but the app does not need to enforce rules in version 1 |
| Scoring style | “What happened” tracking, not strict official scorekeeping |
| Live scorer | One person will likely score the game live |
| Replay style | Show pitch, hit ball, foul balls, fielding involvement, and runner movement as close to real time as possible |
| Hit location entry | Mouse click or touchscreen tap on a field map |
| Pitch count | Track pitch count and pitching usage |
| Pitching rule | Currently pitcher may pitch up to 2 innings; this should be configurable |
| Defense tracking | Track defensive positions and bench time |
| Media | Images/videos can be associated with each event/action and tied to capture time |
| Player display | Jersey number + first name/nickname |
| Permissions | A separate `i-am` module/repo/container provides authentication, authorization, permission levels, and permission sets |

---

# Design Principle

The app should be built around an ordered event timeline.

Do not only store final stats. Store the game as a sequence of events.

Each event should include:

- `event_order` for replay sequence
- `event_time_utc` for when the baseball action happened
- `logged_at_utc` for when the scorer entered it
- links to the pitch, batted ball, fielding play, runner movement, media, and game-state snapshot

Use UTC for all stored timestamps. Display times in the game’s local timezone.

---

# Core Table Groupings

## Core identity and baseball structure

- `teams`
- `players`
- `games`
- `game_teams`
- `game_rosters`

## Game flow

- `innings`
- `plate_appearances`
- `pitches`
- `balls_in_play`
- `fielding_plays`
- `base_runner_events`
- `steal_attempts`
- `fielders_choice_events`
- `game_events`
- `game_state_snapshots`
- `base_state_snapshots`

## Defense and pitching

- `defensive_alignment`
- `player_game_changes`
- `pitcher_usage`
- `pitching_rules`

## Replay and media

- `event_media`
- `media_player_tags`
- `player_locations`
- `field_zones`

## Security and access

- `users`
- `user_team_roles`
- `parent_player_links`
- permission integration with external `i-am` service

---

# Schema

## teams

```sql
CREATE TABLE teams (
    team_id           UUID PRIMARY KEY,
    team_name         VARCHAR(100) NOT NULL,
    league_name       VARCHAR(100),
    division          VARCHAR(50),      -- 10U, 11U, 12U, Majors, Minors
    season_year       INT NOT NULL,
    city              VARCHAR(100),
    state             VARCHAR(50),
    created_at_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc    TIMESTAMPTZ
);
```

---

## players

Stores basic player information without being overly personal.

Avoid storing full birthdate, home address, school, or medical details unless later required.

```sql
CREATE TABLE players (
    player_id         UUID PRIMARY KEY,
    team_id           UUID NOT NULL REFERENCES teams(team_id),

    first_name        VARCHAR(50) NOT NULL,
    nickname          VARCHAR(50),
    last_initial      VARCHAR(5),
    jersey_number     INT,

    bats              VARCHAR(10),      -- Left, Right, Switch, Unknown
    throws            VARCHAR(10),      -- Left, Right, Unknown
    primary_position  VARCHAR(20),
    age_group         VARCHAR(20),      -- 10U, 11U, 12U

    active            BOOLEAN DEFAULT TRUE,

    created_at_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc    TIMESTAMPTZ
);
```

Recommended player display:

```text
#12 Jackson
#7 Eli
#4 Ben
```

Use `nickname` when available, otherwise use `first_name`.

---

## games

```sql
CREATE TABLE games (
    game_id              UUID PRIMARY KEY,

    home_team_id         UUID NOT NULL REFERENCES teams(team_id),
    away_team_id         UUID NOT NULL REFERENCES teams(team_id),

    timezone_name        VARCHAR(100) NOT NULL, -- Example: America/New_York

    scheduled_start_utc  TIMESTAMPTZ,
    actual_start_utc     TIMESTAMPTZ,
    actual_end_utc       TIMESTAMPTZ,

    location_name        VARCHAR(150),
    field_name           VARCHAR(100),
    address_city         VARCHAR(100),
    address_state        VARCHAR(50),

    weather_summary      VARCHAR(100),
    temperature_f        INT,
    wind_speed_mph       INT,
    wind_direction       VARCHAR(20),
    field_condition      VARCHAR(50),

    status               VARCHAR(30), -- Scheduled, In Progress, Final, Suspended
    final_home_score     INT,
    final_away_score     INT,

    created_at_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc       TIMESTAMPTZ
);
```

---

## game_teams

```sql
CREATE TABLE game_teams (
    game_team_id      UUID PRIMARY KEY,
    game_id           UUID NOT NULL REFERENCES games(game_id),
    team_id           UUID NOT NULL REFERENCES teams(team_id),

    home_away         VARCHAR(10) NOT NULL, -- Home or Away
    dugout_side       VARCHAR(20),          -- First base, third base
    final_score       INT DEFAULT 0,

    UNIQUE(game_id, team_id)
);
```

---

## game_rosters

Players available for a specific game.

```sql
CREATE TABLE game_rosters (
    game_roster_id    UUID PRIMARY KEY,
    game_id           UUID NOT NULL REFERENCES games(game_id),
    player_id         UUID NOT NULL REFERENCES players(player_id),
    team_id           UUID NOT NULL REFERENCES teams(team_id),

    is_present        BOOLEAN DEFAULT TRUE,
    is_starter        BOOLEAN DEFAULT FALSE,
    batting_order     INT,               -- Continuous batting order
    notes             TEXT,

    UNIQUE(game_id, player_id)
);
```

---

## innings

```sql
CREATE TABLE innings (
    inning_id         UUID PRIMARY KEY,
    game_id           UUID NOT NULL REFERENCES games(game_id),

    inning_number     INT NOT NULL,
    half_inning       VARCHAR(10) NOT NULL, -- Top or Bottom

    batting_team_id   UUID NOT NULL REFERENCES teams(team_id),
    fielding_team_id  UUID NOT NULL REFERENCES teams(team_id),

    runs_scored       INT DEFAULT 0,
    outs_start        INT DEFAULT 0,
    outs_end          INT DEFAULT 0,

    started_at_utc    TIMESTAMPTZ,
    ended_at_utc      TIMESTAMPTZ,

    UNIQUE(game_id, inning_number, half_inning)
);
```

---

## plate_appearances

```sql
CREATE TABLE plate_appearances (
    plate_appearance_id UUID PRIMARY KEY,
    game_id             UUID NOT NULL REFERENCES games(game_id),
    inning_id           UUID NOT NULL REFERENCES innings(inning_id),

    event_order_start   INT NOT NULL,
    event_order_end     INT,

    batter_id           UUID NOT NULL REFERENCES players(player_id),
    pitcher_id          UUID REFERENCES players(player_id),
    catcher_id          UUID REFERENCES players(player_id),

    batting_team_id     UUID NOT NULL REFERENCES teams(team_id),
    fielding_team_id    UUID NOT NULL REFERENCES teams(team_id),

    batting_order       INT,

    balls_start         INT DEFAULT 0,
    strikes_start       INT DEFAULT 0,
    outs_start          INT DEFAULT 0,

    runner_on_first_id  UUID REFERENCES players(player_id),
    runner_on_second_id UUID REFERENCES players(player_id),
    runner_on_third_id  UUID REFERENCES players(player_id),

    result              VARCHAR(50),
    -- Single, Walk, Strikeout, Groundout, Error, Fielder's Choice, etc.

    reached_on_fielders_choice BOOLEAN DEFAULT FALSE,

    rbi_count           INT DEFAULT 0,
    runs_scored         INT DEFAULT 0,
    outs_recorded       INT DEFAULT 0,

    created_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc      TIMESTAMPTZ
);
```

---

## pitches

Stores every pitch.

```sql
CREATE TABLE pitches (
    pitch_id             UUID PRIMARY KEY,
    plate_appearance_id  UUID NOT NULL REFERENCES plate_appearances(plate_appearance_id),
    game_id              UUID NOT NULL REFERENCES games(game_id),

    pitch_number_in_pa   INT NOT NULL,
    event_order          INT NOT NULL,
    event_time_utc       TIMESTAMPTZ NOT NULL,
    logged_at_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    pitcher_id           UUID NOT NULL REFERENCES players(player_id),
    batter_id            UUID NOT NULL REFERENCES players(player_id),
    catcher_id           UUID REFERENCES players(player_id),

    balls_before         INT NOT NULL,
    strikes_before       INT NOT NULL,
    outs_before          INT NOT NULL,

    pitch_result         VARCHAR(50) NOT NULL,
    -- Ball, Called Strike, Swinging Strike, Foul, Ball In Play,
    -- Hit By Pitch, Wild Pitch, Passed Ball, Foul Tip

    pitch_type           VARCHAR(30),
    pitch_zone_x         DECIMAL(5,2),
    pitch_zone_y         DECIMAL(5,2),
    pitch_speed_mph      DECIMAL(5,2),

    is_swing             BOOLEAN DEFAULT FALSE,
    is_contact           BOOLEAN DEFAULT FALSE,
    is_foul              BOOLEAN DEFAULT FALSE,
    is_ball_in_play      BOOLEAN DEFAULT FALSE,

    balls_after          INT,
    strikes_after        INT,
    outs_after           INT,

    notes                TEXT
);
```

---

## balls_in_play

One row when the batter makes contact and the ball enters fair or foul territory.

```sql
CREATE TABLE balls_in_play (
    ball_in_play_id       UUID PRIMARY KEY,
    pitch_id              UUID NOT NULL REFERENCES pitches(pitch_id),
    plate_appearance_id   UUID NOT NULL REFERENCES plate_appearances(plate_appearance_id),
    game_id               UUID NOT NULL REFERENCES games(game_id),

    event_order           INT NOT NULL,
    event_time_utc        TIMESTAMPTZ NOT NULL,
    logged_at_utc         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    batter_id             UUID NOT NULL REFERENCES players(player_id),

    contact_type          VARCHAR(30),
    -- Ground Ball, Line Drive, Fly Ball, Pop Up, Bunt, Foul Ball

    field_zone            VARCHAR(50),
    -- Left Infield, Right Infield, Shallow CF, Deep LF, Foul 1B Side, etc.

    landing_x             DECIMAL(6,2),
    landing_y             DECIMAL(6,2),

    first_bounce_x        DECIMAL(6,2),
    first_bounce_y        DECIMAL(6,2),

    final_ball_x          DECIMAL(6,2),
    final_ball_y          DECIMAL(6,2),

    estimated_distance_ft INT,

    was_fair              BOOLEAN,
    was_foul              BOOLEAN DEFAULT FALSE,
    was_caught_in_air     BOOLEAN DEFAULT FALSE,
    landed_on_ground      BOOLEAN DEFAULT FALSE,

    primary_fielder_id    UUID REFERENCES players(player_id),
    fielded_by_id         UUID REFERENCES players(player_id),

    result                VARCHAR(50),
    -- Single, Double, Triple, HR, Groundout, Flyout, Error, Fielder's Choice, Foul

    notes                 TEXT
);
```

---

## fielding_plays

Stores any attempted defensive action.

```sql
CREATE TABLE fielding_plays (
    fielding_play_id      UUID PRIMARY KEY,
    game_id               UUID NOT NULL REFERENCES games(game_id),
    plate_appearance_id   UUID REFERENCES plate_appearances(plate_appearance_id),
    ball_in_play_id       UUID REFERENCES balls_in_play(ball_in_play_id),

    event_order           INT NOT NULL,
    event_time_utc        TIMESTAMPTZ NOT NULL,
    logged_at_utc         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    sequence_number       INT NOT NULL,

    fielder_id            UUID NOT NULL REFERENCES players(player_id),
    action_type           VARCHAR(50) NOT NULL,
    -- Fielded, Caught, Dropped, Threw, Received Throw, Tagged Runner,
    -- Missed Ball, Deflected, Backed Up, Cutoff, Attempted Play

    from_position         VARCHAR(10),
    to_position           VARCHAR(10),

    target_player_id      UUID REFERENCES players(player_id),
    target_base           VARCHAR(10),
    -- 1B, 2B, 3B, Home

    throw_quality         VARCHAR(30),
    -- Accurate, High, Low, Wide, Late, Offline, No Throw

    catch_success         BOOLEAN,
    error_charged         BOOLEAN DEFAULT FALSE,

    x_location            DECIMAL(6,2),
    y_location            DECIMAL(6,2),

    notes                 TEXT
);
```

---

## base_runner_events

Main runner movement table.

This should record steals, caught stealing, achieved bases, fielder’s choice, force outs, tag outs, and scoring.

```sql
CREATE TABLE base_runner_events (
    runner_event_id       UUID PRIMARY KEY,

    game_id               UUID NOT NULL REFERENCES games(game_id),
    inning_id             UUID REFERENCES innings(inning_id),
    plate_appearance_id   UUID REFERENCES plate_appearances(plate_appearance_id),
    pitch_id              UUID REFERENCES pitches(pitch_id),
    ball_in_play_id       UUID REFERENCES balls_in_play(ball_in_play_id),
    fielding_play_id      UUID REFERENCES fielding_plays(fielding_play_id),

    event_order           INT NOT NULL,
    sequence_number       INT NOT NULL,
    event_time_utc        TIMESTAMPTZ NOT NULL,
    logged_at_utc         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    runner_id             UUID NOT NULL REFERENCES players(player_id),

    start_base            VARCHAR(10) NOT NULL,
    -- Batter, 1B, 2B, 3B

    end_base              VARCHAR(10) NOT NULL,
    -- 1B, 2B, 3B, Home, Out

    achieved_base         VARCHAR(10),
    -- Highest base safely achieved during the play

    movement_reason       VARCHAR(50) NOT NULL,
    -- Hit, Walk, Steal, Caught Stealing, Passed Ball,
    -- Wild Pitch, Fielder's Choice, Error, Force Out,
    -- Tag Out, Pickoff, Batter Advancement, Defensive Indifference

    attempt_type          VARCHAR(50),
    -- Steal Attempt, Advance Attempt, Tag Up Attempt,
    -- Extra Base Attempt, Pickoff Return, None

    was_attempting_steal  BOOLEAN DEFAULT FALSE,
    steal_successful      BOOLEAN,
    caught_stealing       BOOLEAN DEFAULT FALSE,

    was_forced            BOOLEAN DEFAULT FALSE,
    was_out               BOOLEAN DEFAULT FALSE,

    out_type              VARCHAR(50),
    -- Force Out, Tag Out, Caught Stealing, Pickoff,
    -- Batter Out, Appeal Out, Interference

    out_base              VARCHAR(10),
    -- 1B, 2B, 3B, Home

    out_recorded_by_id    UUID REFERENCES players(player_id),
    assist_by_id          UUID REFERENCES players(player_id),

    run_scored            BOOLEAN DEFAULT FALSE,
    rbi_credit            BOOLEAN DEFAULT FALSE,

    safe_or_out_call      VARCHAR(10),
    -- Safe, Out

    notes                 TEXT
);
```

---

## steal_attempts

This is optional but recommended because stealing matters in Little League.

```sql
CREATE TABLE steal_attempts (
    steal_attempt_id     UUID PRIMARY KEY,

    game_id              UUID NOT NULL REFERENCES games(game_id),
    pitch_id             UUID REFERENCES pitches(pitch_id),
    plate_appearance_id  UUID REFERENCES plate_appearances(plate_appearance_id),
    runner_event_id      UUID NOT NULL REFERENCES base_runner_events(runner_event_id),

    event_order          INT NOT NULL,
    event_time_utc       TIMESTAMPTZ NOT NULL,
    logged_at_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    runner_id            UUID NOT NULL REFERENCES players(player_id),

    from_base            VARCHAR(10) NOT NULL,
    to_base              VARCHAR(10) NOT NULL,

    attempt_result       VARCHAR(30) NOT NULL,
    -- Successful Steal, Caught Stealing, Safe On Error,
    -- Defensive Indifference, Picked Off

    pitch_result         VARCHAR(50),

    catcher_id           UUID REFERENCES players(player_id),
    catcher_throw        BOOLEAN DEFAULT FALSE,

    throw_to_base        VARCHAR(10),
    throw_quality        VARCHAR(30),
    -- Accurate, High, Low, Wide, Late, No Throw

    receiving_fielder_id UUID REFERENCES players(player_id),
    tag_attempted        BOOLEAN DEFAULT FALSE,
    tag_made             BOOLEAN DEFAULT FALSE,

    safe_or_out_call     VARCHAR(10),
    -- Safe, Out

    error_charged_to_id  UUID REFERENCES players(player_id),

    notes                TEXT
);
```

---

## fielders_choice_events

```sql
CREATE TABLE fielders_choice_events (
    fielders_choice_id   UUID PRIMARY KEY,

    game_id              UUID NOT NULL REFERENCES games(game_id),
    plate_appearance_id  UUID NOT NULL REFERENCES plate_appearances(plate_appearance_id),
    ball_in_play_id      UUID REFERENCES balls_in_play(ball_in_play_id),
    fielding_play_id     UUID REFERENCES fielding_plays(fielding_play_id),

    event_order          INT NOT NULL,
    event_time_utc       TIMESTAMPTZ NOT NULL,
    logged_at_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    batter_id            UUID NOT NULL REFERENCES players(player_id),
    batter_end_base      VARCHAR(10) NOT NULL,

    runner_targeted_id   UUID REFERENCES players(player_id),
    runner_start_base    VARCHAR(10),
    runner_end_base      VARCHAR(10),

    out_recorded         BOOLEAN DEFAULT FALSE,
    out_base             VARCHAR(10),
    out_type             VARCHAR(50),

    fielder_making_choice_id UUID REFERENCES players(player_id),
    throw_to_base        VARCHAR(10),

    notes                TEXT
);
```

---

## game_events

Master replay timeline.

```sql
CREATE TABLE game_events (
    game_event_id      UUID PRIMARY KEY,
    game_id            UUID NOT NULL REFERENCES games(game_id),

    event_order        INT NOT NULL,
    event_time_utc     TIMESTAMPTZ NOT NULL,
    logged_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc     TIMESTAMPTZ,

    inning_number      INT NOT NULL,
    half_inning        VARCHAR(10) NOT NULL,

    event_type         VARCHAR(50) NOT NULL,
    -- Pitch, Ball In Play, Fielding Play, Runner Movement,
    -- Substitution, Position Change, Score Change, Inning Start,
    -- Inning End, Media Attached

    plate_appearance_id UUID REFERENCES plate_appearances(plate_appearance_id),
    pitch_id            UUID REFERENCES pitches(pitch_id),
    ball_in_play_id     UUID REFERENCES balls_in_play(ball_in_play_id),
    fielding_play_id    UUID REFERENCES fielding_plays(fielding_play_id),
    runner_event_id     UUID REFERENCES base_runner_events(runner_event_id),

    primary_player_id   UUID REFERENCES players(player_id),
    secondary_player_id UUID REFERENCES players(player_id),

    description         TEXT,

    home_score_after    INT,
    away_score_after    INT,
    outs_after          INT,
    balls_after         INT,
    strikes_after       INT,

    replay_start_ms     INT DEFAULT 0,
    replay_duration_ms  INT,
    replay_speed_hint   DECIMAL(4,2),

    UNIQUE(game_id, event_order)
);
```

---

## game_state_snapshots

Stores score, count, outs, and base state after an event.

```sql
CREATE TABLE game_state_snapshots (
    snapshot_id          UUID PRIMARY KEY,
    game_id              UUID NOT NULL REFERENCES games(game_id),
    event_order          INT NOT NULL,
    snapshot_time_utc    TIMESTAMPTZ NOT NULL,

    inning_number        INT NOT NULL,
    half_inning          VARCHAR(10) NOT NULL,

    balls                INT DEFAULT 0,
    strikes              INT DEFAULT 0,
    outs                 INT DEFAULT 0,

    home_score           INT DEFAULT 0,
    away_score           INT DEFAULT 0,

    batter_id            UUID REFERENCES players(player_id),
    pitcher_id           UUID REFERENCES players(player_id),

    runner_on_first_id   UUID REFERENCES players(player_id),
    runner_on_second_id  UUID REFERENCES players(player_id),
    runner_on_third_id   UUID REFERENCES players(player_id),

    created_at_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(game_id, event_order)
);
```

---

## base_state_snapshots

Focused version of base state.

```sql
CREATE TABLE base_state_snapshots (
    base_state_id        UUID PRIMARY KEY,
    game_id              UUID NOT NULL REFERENCES games(game_id),

    event_order          INT NOT NULL,
    snapshot_time_utc    TIMESTAMPTZ NOT NULL,

    inning_number        INT NOT NULL,
    half_inning          VARCHAR(10) NOT NULL,

    runner_on_first_id   UUID REFERENCES players(player_id),
    runner_on_second_id  UUID REFERENCES players(player_id),
    runner_on_third_id   UUID REFERENCES players(player_id),

    outs                 INT NOT NULL DEFAULT 0,
    runs_home            INT NOT NULL DEFAULT 0,
    runs_away            INT NOT NULL DEFAULT 0,

    created_at_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(game_id, event_order)
);
```

---

## defensive_alignment

Tracks who was playing each defensive position at any point.

```sql
CREATE TABLE defensive_alignment (
    alignment_id          UUID PRIMARY KEY,
    game_id               UUID NOT NULL REFERENCES games(game_id),
    team_id               UUID NOT NULL REFERENCES teams(team_id),

    inning_number         INT NOT NULL,
    half_inning           VARCHAR(10) NOT NULL,

    position              VARCHAR(10) NOT NULL,
    -- P, C, 1B, 2B, SS, 3B, LF, CF, RF, Bench

    player_id             UUID NOT NULL REFERENCES players(player_id),

    start_event_order     INT NOT NULL,
    end_event_order       INT,

    effective_start_time_utc TIMESTAMPTZ NOT NULL,
    effective_end_time_utc   TIMESTAMPTZ,

    UNIQUE(game_id, inning_number, half_inning, position, start_event_order)
);
```

Use position `Bench` or a separate bench tracking table to calculate bench time.

---

## player_game_changes

Tracks substitutions, defensive changes, pitcher changes, and bench changes.

```sql
CREATE TABLE player_game_changes (
    change_id          UUID PRIMARY KEY,
    game_id            UUID NOT NULL REFERENCES games(game_id),

    event_order        INT NOT NULL,
    event_time_utc     TIMESTAMPTZ NOT NULL,
    logged_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    inning_number      INT NOT NULL,
    half_inning        VARCHAR(10) NOT NULL,

    change_type        VARCHAR(50) NOT NULL,
    -- Defensive Position Change, Bench Change, Pitcher Change, Courtesy Runner, Injury Removal

    team_id            UUID NOT NULL REFERENCES teams(team_id),
    player_out_id      UUID REFERENCES players(player_id),
    player_in_id       UUID REFERENCES players(player_id),

    old_position       VARCHAR(10),
    new_position       VARCHAR(10),

    notes              TEXT
);
```

---

## pitching_rules

Pitching rules should be configurable because the rule may change.

```sql
CREATE TABLE pitching_rules (
    pitching_rule_id   UUID PRIMARY KEY,

    league_name        VARCHAR(100),
    division           VARCHAR(50),
    season_year        INT,

    max_innings_game   DECIMAL(4,1), -- Current rule: 2 innings
    max_pitches_day    INT,

    warning_at_pitches INT,
    warning_at_innings DECIMAL(4,1),

    rules_notes        TEXT,

    effective_start_date DATE,
    effective_end_date   DATE,

    created_at_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc     TIMESTAMPTZ
);
```

---

## pitcher_usage

```sql
CREATE TABLE pitcher_usage (
    pitcher_usage_id       UUID PRIMARY KEY,
    game_id                UUID NOT NULL REFERENCES games(game_id),
    player_id              UUID NOT NULL REFERENCES players(player_id),
    team_id                UUID NOT NULL REFERENCES teams(team_id),

    innings_pitched        DECIMAL(4,1) DEFAULT 0,
    pitches_thrown         INT DEFAULT 0,
    balls_thrown           INT DEFAULT 0,
    strikes_thrown         INT DEFAULT 0,
    batters_faced          INT DEFAULT 0,

    first_pitch_event_order INT,
    last_pitch_event_order  INT,

    first_pitch_time_utc   TIMESTAMPTZ,
    last_pitch_time_utc    TIMESTAMPTZ,

    created_at_utc         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc         TIMESTAMPTZ,

    UNIQUE(game_id, player_id)
);
```

---

## event_media

Allows an image or video to be associated with each event/action.

```sql
CREATE TABLE event_media (
    media_id              UUID PRIMARY KEY,

    game_id               UUID NOT NULL REFERENCES games(game_id),
    game_event_id         UUID REFERENCES game_events(game_event_id),
    inning_id             UUID REFERENCES innings(inning_id),
    plate_appearance_id   UUID REFERENCES plate_appearances(plate_appearance_id),
    pitch_id              UUID REFERENCES pitches(pitch_id),
    ball_in_play_id       UUID REFERENCES balls_in_play(ball_in_play_id),
    fielding_play_id      UUID REFERENCES fielding_plays(fielding_play_id),
    runner_event_id       UUID REFERENCES base_runner_events(runner_event_id),

    uploaded_by_user_id   UUID REFERENCES users(user_id),

    media_type            VARCHAR(20) NOT NULL,
    -- Image, Video, Thumbnail, Clip

    media_url             TEXT NOT NULL,
    thumbnail_url         TEXT,

    file_name             VARCHAR(255),
    file_size_bytes       BIGINT,
    mime_type             VARCHAR(100),

    captured_at_utc       TIMESTAMPTZ,
    uploaded_at_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    replay_offset_ms      INT,
    duration_ms           INT,

    visibility_level      VARCHAR(30) DEFAULT 'team',
    -- public, parents, team, coaches, admins

    caption               TEXT,
    notes                 TEXT
);
```

---

## media_player_tags

Tags players appearing in or associated with media.

```sql
CREATE TABLE media_player_tags (
    media_player_tag_id UUID PRIMARY KEY,
    media_id            UUID NOT NULL REFERENCES event_media(media_id),
    player_id           UUID NOT NULL REFERENCES players(player_id),

    tag_type            VARCHAR(30),
    -- visible, batter, pitcher, runner, fielder

    approved_for_public BOOLEAN DEFAULT FALSE,

    created_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## player_locations

Optional but useful for higher-quality replay.

```sql
CREATE TABLE player_locations (
    player_location_id UUID PRIMARY KEY,
    game_id            UUID NOT NULL REFERENCES games(game_id),
    event_order        INT NOT NULL,
    event_time_utc     TIMESTAMPTZ NOT NULL,

    player_id          UUID NOT NULL REFERENCES players(player_id),

    location_type      VARCHAR(30),
    -- Defensive Position, Base, Running Path, Fielding Location

    x_location         DECIMAL(6,2),
    y_location         DECIMAL(6,2),

    movement_phase     VARCHAR(30),
    -- Start, During, End

    notes              TEXT
);
```

---

## field_zones

Useful for tap/touch hit-location entry.

```sql
CREATE TABLE field_zones (
    field_zone_id      UUID PRIMARY KEY,
    zone_name          VARCHAR(50) NOT NULL,
    zone_category      VARCHAR(50),
    -- Infield, Outfield, Foul Territory, Catcher Area

    min_x              DECIMAL(6,2),
    max_x              DECIMAL(6,2),
    min_y              DECIMAL(6,2),
    max_y              DECIMAL(6,2)
);
```

Example zones:

```text
Pitcher Area
Left Infield
Right Infield
Shortstop Area
Second Base Area
Shallow Left Field
Deep Left Field
Shallow Center
Deep Center
Shallow Right Field
Deep Right Field
Foul First Base Side
Foul Third Base Side
```

---

# Users and Permissions

The app will use a separate `i-am` module/repo/container to provide authentication, authorization, permission levels, and permission sets.

The local app may still need lightweight references to users and roles for ownership, uploads, scoring, and auditing.

## users

```sql
CREATE TABLE users (
    user_id        UUID PRIMARY KEY,
    external_iam_user_id VARCHAR(255) UNIQUE,

    email         VARCHAR(255),
    display_name  VARCHAR(100),

    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc TIMESTAMPTZ
);
```

---

## user_team_roles

```sql
CREATE TABLE user_team_roles (
    user_team_role_id UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES users(user_id),
    team_id           UUID NOT NULL REFERENCES teams(team_id),

    external_permission_set_id VARCHAR(255),

    role_name         VARCHAR(30) NOT NULL,
    -- Public, Parent, Scorer, Coach, Admin

    approved          BOOLEAN DEFAULT FALSE,
    created_at_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc    TIMESTAMPTZ
);
```

---

## parent_player_links

Optional, only needed if parents should get special access to their own child.

```sql
CREATE TABLE parent_player_links (
    parent_player_link_id UUID PRIMARY KEY,
    user_id               UUID NOT NULL REFERENCES users(user_id),
    player_id             UUID NOT NULL REFERENCES players(player_id),

    relationship_type     VARCHAR(30),
    -- Parent, Guardian, Approved Adult

    approved              BOOLEAN DEFAULT FALSE,

    created_at_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc        TIMESTAMPTZ
);
```

---

# Event Media Design

Media can be attached to:

- Whole game
- Inning
- Plate appearance
- Pitch
- Ball in play
- Fielding play
- Runner event
- Generic game event

Each media record should include:

- Capture time in UTC
- Upload time in UTC
- Visibility level
- Optional replay offset in milliseconds
- Optional player tags
- Thumbnail for video/image preview

Example use cases:

```text
Video clip attached to Pitch 4 of an at-bat
Photo attached to a slide into second
Video attached to a fielder’s choice play
Image attached to a final score event
```

---

# Replay Requirements

The replay system should be able to reconstruct:

- Batter
- Pitcher
- Catcher
- Defensive alignment
- Bench players
- Pitch result
- Ball contact
- Foul ball location
- Fair hit location
- First bounce
- Final ball location
- Fielder involvement
- Throw path
- Runner starts and ends
- Score change
- Outs change
- Count change
- Media attachments

Recommended replay levels:

## Version 1

Show:

- Pitch
- Swing/contact
- Foul or fair result
- Hit location
- Primary fielder
- Basic throw or catch
- Runner movement
- Score/count/outs update
- Attached media when available

## Later Version

Add:

- More precise timing
- Player movement paths
- Throw velocity/arc
- Fielding routes
- Multi-camera video or clips
- Rule enforcement for stealing/pitching

---

# Example Play Storage

## Example: Stolen base

Runner on first steals second safely.

`base_runner_events`:

```text
runner_id: Player 12
start_base: 1B
end_base: 2B
achieved_base: 2B
movement_reason: Steal
attempt_type: Steal Attempt
was_attempting_steal: true
steal_successful: true
caught_stealing: false
was_out: false
safe_or_out_call: Safe
```

`steal_attempts`:

```text
from_base: 1B
to_base: 2B
attempt_result: Successful Steal
catcher_throw: true
throw_to_base: 2B
safe_or_out_call: Safe
```

`game_state_snapshots`:

```text
Before:
1B = Player 12
2B = null
3B = null

After:
1B = null
2B = Player 12
3B = null
```

---

## Example: Caught stealing

Runner on first attempts to steal second and is thrown out.

```text
runner_id: Player 12
start_base: 1B
end_base: Out
achieved_base: Out
movement_reason: Caught Stealing
attempt_type: Steal Attempt
was_attempting_steal: true
steal_successful: false
caught_stealing: true
was_out: true
out_type: Caught Stealing
out_base: 2B
safe_or_out_call: Out
```

---

## Example: Fielder’s choice

Runner on first. Batter hits ground ball to shortstop. Shortstop throws to second. Runner from first is out. Batter reaches first.

Runner event for runner from first:

```text
start_base: 1B
end_base: Out
achieved_base: Out
movement_reason: Fielder's Choice
attempt_type: Force Play
was_forced: true
was_out: true
out_type: Force Out
out_base: 2B
safe_or_out_call: Out
```

Runner event for batter:

```text
start_base: Batter
end_base: 1B
achieved_base: 1B
movement_reason: Fielder's Choice
attempt_type: Batter Advancement
was_out: false
safe_or_out_call: Safe
```

---

# Recommended Lookup Values

## pitch_result

```text
Ball
Called Strike
Swinging Strike
Foul
Foul Tip
Ball In Play
Hit By Pitch
Wild Pitch
Passed Ball
```

## contact_type

```text
Ground Ball
Line Drive
Fly Ball
Pop Up
Bunt
Foul Ball
```

## movement_reason

```text
Hit
Walk
Hit By Pitch
Steal
Caught Stealing
Defensive Indifference
Passed Ball
Wild Pitch
Error
Fielder's Choice
Force Out
Tag Out
Pickoff
Pickoff Attempt
Tag Up
Sacrifice Fly
Batter Advancement
Runner Advancement
Runner Held
Interference
Obstruction
Appeal Play
```

## out_type

```text
Strikeout
Groundout
Flyout
Lineout
Popout
Force Out
Tag Out
Caught Stealing
Picked Off
Double Play
Triple Play
Appeal Out
Interference
Runner Passed Another Runner
```

## fielding_action_type

```text
Fielded
Caught
Dropped
Threw
Received Throw
Tagged Runner
Missed Ball
Deflected
Backed Up
Cutoff
Attempted Play
No Play
```

---

# Clarifications Still Worth Answering

These are not blockers, but they would help finalize version 1.

## 1. What exact fields should public users see?

For example:

- Schedule only?
- Final score?
- Team names?
- Player jersey numbers?
- Player first names?
- Replay?
- Photos/videos?

## 2. Should parents see all players on the team or only their child?

This affects `parent_player_links`, stat visibility, and media visibility.

## 3. Who is allowed to upload media?

Options:

- Coaches/admins only
- Scorer only
- Parents can upload pending approval
- Anyone with team access can upload

## 4. Should media require approval before parents or the public can see it?

Strongly recommended because players are children.

## 5. Should the scorer be able to undo/edit/reorder events?

Strongly recommended for live scoring.

## 6. Should the app support multiple games on the same day or tournament mode?

This affects scheduling, pitcher usage, and team dashboards.

## 7. Should the app track only one team’s players in detail, or both teams equally?

For example, your team may have full roster data, while the opponent may only be “Opponent #8.”

## 8. Should the app calculate stats automatically?

Examples:

- Batting average
- On-base percentage
- Pitch count
- Strike percentage
- Stolen bases
- Caught stealing
- Fielding chances
- Defensive innings
- Bench innings

## 9. Should pitch-count limits be warning-only or enforced?

Current decision: track pitch count and innings pitched. Rule enforcement can come later.

## 10. Should weather be entered manually or fetched automatically?

Weather can be manually entered in version 1 and automated later.

---

# Recommended Version 1 Scope

Build version 1 around:

- Teams
- Players
- Games
- Rosters
- Continuous batting order
- Innings
- Plate appearances
- Pitches
- Ball-in-play events
- Hit location tap/touch
- Fielding involvement
- Runner movement
- Steals and caught stealing
- Fielder’s choice
- Base state snapshots
- Game state snapshots
- Defensive alignment
- Bench time
- Pitcher usage
- Event media
- UTC timestamps
- External `i-am` permission integration

Leave these for later:

- Stealing rule enforcement
- Official scorekeeping edge cases
- Realistic player movement paths
- Automated video sync
- Automated weather
- Advanced stat calculations
- Multi-scorer conflict resolution

---

---

---

# Live Scoring Screen, Lineups, Four Outfielders, and Manual Corrections

## Current lineup display

The scoring screen should show the current lineup/players for each team.

Recommended layout:

```text
Left side or top panel:
- Away team lineup
- Current batter highlighted
- Current pitcher highlighted when away team is fielding

Right side or top panel:
- Home team lineup
- Current batter highlighted
- Current pitcher highlighted when home team is fielding

Main scoring panel:
- Batter
- Pitcher
- Count: balls / strikes / outs
- Runners on base
- Score
- Pitch result buttons
- Field map for hit location
```

The scorer should always be able to see:

```text
Current batter
Current pitcher
Current catcher if tracked
Current inning
Top/bottom
Ball count
Strike count
Outs
Score
Runners on base
Defensive alignment
```

This helps keep the app synchronized with the real game.

---

## Position dropdowns

Each team lineup should allow a position dropdown.

Example position values:

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
Bench
Unknown
```

At this level, teams are allowed four outfielders. The schema should support this directly.

Recommended outfield positions:

```text
LF   = Left Field
LCF  = Left Center Field
RCF  = Right Center Field
RF   = Right Field
```

Alternative generic approach:

```text
OF1
OF2
OF3
OF4
```

Preferred approach for replay:

```text
LF
LCF
RCF
RF
```

because it is easier to place players on the field map.

---

## Update positions lookup

The `positions` lookup table should include four-outfielder support.

```sql
INSERT INTO positions (position_code, position_name) VALUES
('P', 'Pitcher'),
('C', 'Catcher'),
('1B', 'First Base'),
('2B', 'Second Base'),
('3B', 'Third Base'),
('SS', 'Shortstop'),
('LF', 'Left Field'),
('LCF', 'Left Center Field'),
('RCF', 'Right Center Field'),
('RF', 'Right Field'),
('BENCH', 'Bench'),
('UNKNOWN', 'Unknown');
```

---

## Defensive alignment changes from dropdowns

When a scorer changes a player position from a dropdown, the app should create a `player_game_changes` record and update `defensive_alignment`.

Example:

```text
Player #12 changes from Bench to RF
Player #8 changes from RF to Bench
Event type: Defensive Position Change
```

This should also appear in the replay timeline as a substitution/position change event.

---

## Current batter and current pitcher

The game state snapshot should clearly identify the current batter and pitcher.

Already included:

```sql
batter_id  UUID REFERENCES players(player_id),
pitcher_id UUID REFERENCES players(player_id)
```

Recommended addition:

```sql
ALTER TABLE game_state_snapshots
ADD COLUMN batting_team_id UUID REFERENCES teams(team_id);

ALTER TABLE game_state_snapshots
ADD COLUMN fielding_team_id UUID REFERENCES teams(team_id);

ALTER TABLE game_state_snapshots
ADD COLUMN catcher_id UUID REFERENCES players(player_id);
```

The scoring UI should show:

```text
Batter: #12 Jackson
Pitcher: #7 Eli
Count: 2 balls, 1 strike, 1 out
```

---

## Manual count and out correction

Because the scorer may be sidetracked during a pitch or batter, the app needs a manual way to adjust:

```text
Balls
Strikes
Outs
Score
Runner on first
Runner on second
Runner on third
Current batter
Current pitcher
Current inning/top-bottom
```

Manual corrections should not silently overwrite the game.

They should be stored as replay/audit events.

---

## manual_game_corrections

```sql
CREATE TABLE manual_game_corrections (
    correction_id       UUID PRIMARY KEY,

    game_id             UUID NOT NULL REFERENCES games(game_id),
    game_event_id       UUID REFERENCES game_events(game_event_id),

    event_order         INT NOT NULL,
    event_time_utc      TIMESTAMPTZ NOT NULL,
    logged_at_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    corrected_by_user_id UUID REFERENCES users(user_id),

    correction_type     VARCHAR(50) NOT NULL,
    -- Count Correction, Out Correction, Score Correction,
    -- Base State Correction, Batter Correction, Pitcher Correction,
    -- Inning Correction, General Correction

    old_value_json      JSONB,
    new_value_json      JSONB,

    reason              TEXT,
    -- Example: "Scorer missed a pitch while talking to coach"

    show_in_replay      BOOLEAN DEFAULT TRUE
);
```

A correction should also create a `game_events` row.

Example:

```text
Event 122:
Type: Manual Correction
Description: Count corrected from 1-1 to 2-1
Replay note: Scorer adjusted count
```

---

## Recommended correction event type

Add to `game_events.event_type`:

```text
Manual Correction
Count Correction
Out Correction
Base State Correction
Score Correction
Pitcher Correction
Batter Correction
Defensive Alignment Correction
```

---

## Replay behavior for corrections

A replay should be able to show correction notes in a small overlay.

Example:

```text
Correction: Count changed from 1-1 to 2-1
Reason: Missed pitch entry
```

Or, if the viewer does not need this detail, the replay can simply continue from the corrected state.

Recommended setting:

```text
Show corrections in replay: on/off
```

Coaches/admins may see all corrections. Public users probably should not see correction details.

---

## UI sync safeguards

The scoring screen should include sync checks:

```text
Current batter is highlighted in the lineup
Current pitcher is highlighted in the defensive lineup
Current base runners are shown on base diagram
Count and outs are large and easy to see
Undo last event button
Manual correction button
Pitcher change button
Position change dropdowns
Bench/field status display
```

Recommended buttons:

```text
Undo Last
Correct Count
Correct Outs
Correct Bases
Change Pitcher
Change Batter
Swap Positions
End Half Inning
```

---

## Version 1 UI recommendation

For version 1, include:

```text
Lineup panel for user's team
Lineup panel for opponent
Position dropdown for each player
Support for LF, LCF, RCF, RF
Large current batter display
Large current pitcher display
Manual count/out correction
Undo last action
Correction events stored in replay timeline
```

This will make live scoring much easier and reduce mistakes.


---

---

# Pitch Location, Unknown Pitches, Hit By Pitch, and Fast Scoring Controls

## Version 1 pitch-entry principle

The pitch screen should separate two things:

```text
Pitch location = where the pitch appeared to go
Pitch result   = what the umpire/play result was
```

These should not be treated as the same value.

Example:

```text
Location: Low Outside
Result: Called Strike
```

or

```text
Location: Middle Middle
Result: Ball
```

or

```text
Location: Unknown
Result: Ball
```

The scorekeeper should not be forced to enter exact location to keep the game moving.

---

## Low outside should not automatically become a ball

A low outside pitch should not automatically add a ball.

The umpire's call controls the count.

Recommended workflow:

```text
1. Scorekeeper taps/clicks pitch location if known.
2. Scorekeeper taps Ball / Called Strike / Swinging Strike / Foul / In Play / HBP.
3. App updates the count based on the result, not just the location.
```

Reason:

```text
Youth umpires may call a borderline pitch a strike.
The scorer may tap the wrong zone.
The scorer may not know the exact location.
Some pitches are swung at, fouled, or put in play regardless of location.
```

Optional helper:

```text
If location is far outside/high/low, the UI may suggest Ball.
But the scorekeeper should confirm the actual result.
```

---

## Fast scoring option

To keep scoring fast, the app should allow result-only entry.

Examples:

```text
Ball, location unknown
Strike, location unknown
Foul, location unknown
Ball in play, location unknown
Hit by pitch
```

This supports situations where the scorer is sidetracked or cannot see the pitch clearly.

---

## 3x3 strike zone

Use a 3x3 strike zone for common pitch placement:

```text
High Inside     High Middle     High Outside

Middle Inside   Middle Middle   Middle Outside

Low Inside      Low Middle      Low Outside
```

Inside/outside should be based on the batter's handedness.

For a right-handed batter:

```text
Inside = third-base side of the plate from the catcher's view
Outside = first-base side of the plate from the catcher's view
```

For a left-handed batter, inside/outside flips.

If batter handedness is unknown, the app can display:

```text
Left Side
Middle
Right Side
```

instead of inside/outside.

---

## Special pitch-location areas

Because pitches may be very wide, high, in the dirt, or wild, the pitch UI should include areas outside the 3x3 strike zone.

Recommended location labels:

```text
High Inside
High Middle
High Outside
Middle Inside
Middle Middle
Middle Outside
Low Inside
Low Middle
Low Outside
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

The UI can show this as:

```text
A central 3x3 zone
A top area for Very High / Over Batter
Side areas for Far Inside / Far Outside / Behind Batter
A bottom area for Dirt / Bounced In / Wild Low
```

---

## Hit by pitch

Hit by pitch needs to be tracked as a pitch result and, optionally, with body-location detail.

Recommended additions:

```sql
ALTER TABLE pitches
ADD COLUMN hit_batter BOOLEAN DEFAULT FALSE;

ALTER TABLE pitches
ADD COLUMN hit_batter_body_area VARCHAR(50);
-- Hand, Arm, Elbow, Shoulder, Back, Leg, Foot, Helmet, Unknown

ALTER TABLE pitches
ADD COLUMN batter_awarded_first BOOLEAN DEFAULT FALSE;
```

Typical HBP event behavior:

```text
Pitch result: Hit By Pitch
Batter movement: Batter -> 1B
Count resets because plate appearance ends
Runners may advance if forced
```

The batter's runner movement should be stored in `base_runner_events`.

Example:

```text
runner_id: Batter
start_base: Batter
end_base: 1B
movement_reason: Hit By Pitch
achieved_base: 1B
was_out: false
```

---

## Batter handedness

Yes, batter handedness matters and should be tracked.

It helps with:

```text
Inside/outside pitch labeling
Spray charts
Pitch charts
Matchup review
Replay realism
Coaching feedback
```

The player table already supports this:

```sql
bats VARCHAR(10)
```

Recommended values:

```text
Left
Right
Switch
Unknown
```

At the pitch level, store the actual stance for that pitch because switch hitters may change.

```sql
ALTER TABLE pitches
ADD COLUMN batter_stance VARCHAR(10);
-- Left, Right, Switch, Unknown
```

---

## Recommended pitch table additions

```sql
ALTER TABLE pitches
ADD COLUMN pitch_height_zone VARCHAR(20);
-- Very High, High, Middle, Low, Dirt, Wild Low, Unknown

ALTER TABLE pitches
ADD COLUMN pitch_side_zone VARCHAR(20);
-- Far Inside, Inside, Middle, Outside, Far Outside, Behind Batter, Unknown

ALTER TABLE pitches
ADD COLUMN pitch_location_label VARCHAR(50);
-- Low Outside, High Inside, Dirt, Wild High, Unknown, etc.

ALTER TABLE pitches
ADD COLUMN pitch_location_known BOOLEAN DEFAULT TRUE;

ALTER TABLE pitches
ADD COLUMN pitch_call_known BOOLEAN DEFAULT TRUE;

ALTER TABLE pitches
ADD COLUMN unknown_pitch_reason VARCHAR(100);
-- Sidetracked, Blocked View, Entered Later, Other

ALTER TABLE pitches
ADD COLUMN hit_batter BOOLEAN DEFAULT FALSE;

ALTER TABLE pitches
ADD COLUMN hit_batter_body_area VARCHAR(50);

ALTER TABLE pitches
ADD COLUMN batter_awarded_first BOOLEAN DEFAULT FALSE;

ALTER TABLE pitches
ADD COLUMN catcher_block_attempt BOOLEAN DEFAULT FALSE;

ALTER TABLE pitches
ADD COLUMN catcher_block_success BOOLEAN;

ALTER TABLE pitches
ADD COLUMN ball_got_past_catcher BOOLEAN DEFAULT FALSE;

ALTER TABLE pitches
ADD COLUMN runner_advance_possible BOOLEAN DEFAULT FALSE;
```

---

## Recommended pitch-result buttons

Version 1 should use simple large buttons:

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

`Unknown Ball` means:

```text
The scorer knows the umpire called ball, but does not know location.
```

`Unknown Strike` means:

```text
The scorer knows the umpire called strike, but does not know location.
```

`Missed Pitch` means:

```text
The scorer missed the pitch and may need to correct the count manually.
```

---

## Wide/high/wild pitch behavior

Special pitch locations should not automatically change the count unless the scorekeeper selects a result.

Recommended behavior:

```text
Tap Very High + Ball = count adds one ball
Tap Dirt + Ball = count adds one ball
Tap Wild Outside + Wild Pitch = count adds one ball and prompts for runner movement
Tap Behind Batter + Hit By Pitch = batter awarded first, if applicable
Tap Unknown + Called Strike = count adds one strike
```

For wild pitches and passed balls:

```text
Prompt: Did any runners advance?
Prompt: Did the batter reach base?
Prompt: Did the catcher block the ball?
```

---

## Suggested UI flow

Fast path:

```text
Tap Ball
Tap Strike Looking
Tap Strike Swinging
Tap Foul
Tap In Play
Tap HBP
```

Detailed path:

```text
Tap location on 3x3 zone or outside area
Tap result
If ball gets away, choose Wild Pitch / Passed Ball / Blocked
If runners advance, update runners
```

Correction path:

```text
Tap Unknown Ball or Unknown Strike
or
Tap Missed Pitch
Then correct count/out/base state if needed
```

---

## Bench time and mid-inning changes

Bench time usually correlates with inning, but pitching changes or defensive changes may happen mid-inning.

The app should track defensive alignment and bench status by:

```text
inning
half-inning
event_order
effective_start_time_utc
effective_end_time_utc
```

This allows both simple inning-based reports and more accurate event/time-based tracking.

Recommended approach:

```text
Default display: by inning
Stored data: by event/time
```

Example:

```text
Player #7 starts inning on Bench.
In middle of inning, Player #7 enters as Pitcher.
Bench time ends at pitcher-change event.
Pitching time starts at pitcher-change event.
```

This supports both ease of use and accuracy.


# Full Team Defensive Tracking, Undo/Change Workflow, and Transparent Corrections

## Track all player positions for both teams

The app should track player positions for both teams, not just the user's team.

Even if the user's team receives more detailed stats, it is useful to know the defensive alignment for both teams because it supports:

```text
Replay accuracy
Pitcher changes
Fielding involvement
Bench time
Player participation
Game review
Who made or attempted a play
```

Recommended rule:

```text
User team: full roster, full batting, full defense, full bench, full replay detail
Opponent: as much lineup/position detail as available, with placeholders allowed
```

Opponent examples:

```text
Opponent #8 at SS
Opponent #12 pitching
Opponent #4 moved from RF to RCF
Opponent #2 on bench
```

The `defensive_alignment` table should be used for both teams.

Position dropdowns should appear for both teams.

Supported positions:

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

Because this Little League level allows four outfielders, `LCF` and `RCF` should be treated as normal defensive positions, not special notes.

---

## Undo and change behavior

The app should support both:

```text
Undo Last Action
Change/Correct Existing Action
```

These should be different actions.

## Undo Last Action

Use when the scorer immediately entered the wrong thing.

Example:

```text
Scorer accidentally tapped Ball instead of Strike.
Scorer presses Undo Last.
Then enters Strike.
```

Recommended behavior:

```text
Do not hard-delete the event.
Mark the previous event as undone/reversed.
Create a new event showing that an undo occurred.
Update the current game state.
```

This preserves transparency.

## Change/Correct Existing Action

Use when the scorer notices a problem later.

Example:

```text
Count was 1-1, but should have been 2-1.
Runner was placed on 2B, but he actually stayed on 1B.
Pitcher was wrong for three pitches.
```

Recommended behavior:

```text
Create a manual correction record.
Create a game_events row of type Manual Correction.
Store old value and new value.
Store who made the correction.
Store the reason when provided.
Recalculate state after that event if needed.
```

---

## Add event status fields

Add these fields to `game_events`:

```sql
ALTER TABLE game_events
ADD COLUMN event_status VARCHAR(30) DEFAULT 'active';
-- active, undone, corrected, superseded

ALTER TABLE game_events
ADD COLUMN superseded_by_event_id UUID REFERENCES game_events(game_event_id);

ALTER TABLE game_events
ADD COLUMN correction_note TEXT;
```

This allows the app to preserve the original timeline while showing that something changed.

---

## event_reversals

Use this table for undo actions.

```sql
CREATE TABLE event_reversals (
    reversal_id          UUID PRIMARY KEY,

    game_id              UUID NOT NULL REFERENCES games(game_id),
    original_event_id    UUID NOT NULL REFERENCES game_events(game_event_id),
    reversal_event_id    UUID NOT NULL REFERENCES game_events(game_event_id),

    reversed_by_user_id  UUID REFERENCES users(user_id),

    reversed_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    reversal_type        VARCHAR(30) NOT NULL,
    -- Undo Last, Admin Reversal, Correction Reversal

    reason               TEXT,

    visible_to_public    BOOLEAN DEFAULT TRUE
);
```

---

## Transparent correction policy

Manual corrections should be visible and transparent to all viewers.

Recommended rule:

```text
Everyone can see that a correction happened.
Coaches/admins can see full correction details.
Parents can see normal correction details.
Public users can see simple correction notes unless the correction exposes private player information.
```

Examples visible to all:

```text
Correction: Count changed from 1-1 to 2-1.
Correction: Outs changed from 1 to 2.
Correction: Batter corrected.
Correction: Pitcher changed.
Correction: Runner placement corrected.
Undo: Previous pitch entry was undone.
```

Examples that may need permission filtering:

```text
Correction involving a private player note
Correction involving media approval
Correction involving hidden player identity
```

Since the user's intent is transparency, the default should be:

```text
show_in_replay = true
visible_to_public = true
```

unless a permission set from `i-am` says otherwise.

---

## Update manual_game_corrections

The correction table should explicitly support transparent visibility.

```sql
ALTER TABLE manual_game_corrections
ADD COLUMN visible_to_public BOOLEAN DEFAULT TRUE;

ALTER TABLE manual_game_corrections
ADD COLUMN visible_to_parents BOOLEAN DEFAULT TRUE;

ALTER TABLE manual_game_corrections
ADD COLUMN visible_to_team BOOLEAN DEFAULT TRUE;

ALTER TABLE manual_game_corrections
ADD COLUMN visible_to_coaches BOOLEAN DEFAULT TRUE;

ALTER TABLE manual_game_corrections
ADD COLUMN visible_to_admins BOOLEAN DEFAULT TRUE;
```

---

## Replay treatment for undo/correction

The replay should show corrections as timeline notes.

Examples:

```text
Replay note: Pitch entry undone.
Replay note: Count corrected from 1-1 to 2-1.
Replay note: Runner on 2B corrected to runner on 1B.
```

Recommended replay display:

```text
Small overlay
Timestamped note
Correction icon in event timeline
Option to hide/show correction notes
```

Because transparency is desired, correction notes should default to visible.

---

## UI requirements

The live scoring screen should include:

```text
Position dropdowns for both teams
Four-outfielder support for both teams
Current pitcher shown clearly
Current batter shown clearly
Undo Last Action button
Change/Correct button
Correction reason field
Correction visible in timeline
Correction visible in replay
```

Recommended correction buttons:

```text
Undo Last
Correct Count
Correct Outs
Correct Score
Correct Bases
Correct Batter
Correct Pitcher
Correct Defense
Correct Previous Play
```

---

## Version 1 recommendation

For version 1, implement:

```text
Full position tracking for both teams
Opponent placeholders when player names are unknown
Undo last action
Manual correction records
Transparent correction timeline
Visible correction notes in replay
Event status: active, undone, corrected, superseded
```

This gives the scorer practical tools without hiding mistakes or losing the integrity of the game record.


# Asymmetric Opponent Tracking

The app will mostly focus on the user's team and players, but it should still track enough opponent information to replay the game and keep the score accurate.

## Tracking model

Use a team-level tracking depth setting.

```sql
ALTER TABLE game_teams
ADD COLUMN tracking_depth VARCHAR(30) DEFAULT 'full';
```

Recommended values:

```text
full        = full roster, batting, pitching, defense, pitch count, replay, stats
limited     = opponent tracked enough for score, pitcher changes, batter results, major plays
anonymous   = opponent tracked mostly by jersey number or batting slot
```

For most games:

```text
User team: full
Opponent: limited
```

## Opponent player records

Opponent players may be entered with less detail.

```sql
ALTER TABLE players
ADD COLUMN is_opponent_placeholder BOOLEAN DEFAULT FALSE;

ALTER TABLE players
ADD COLUMN display_label VARCHAR(100);
```

Examples:

```text
Opponent #8
Opponent Pitcher #12
Blue Team Batter 4
```

This allows the app to track opponent actions without requiring full personal details.

## Information to track for both teams

Even with limited opponent tracking, the app should track these for both teams:

```text
Pitcher changes
Pitch count if possible
Batting order slot
Batter result
Runs scored
Outs made
Runner movement
Steals and caught stealing
Major fielding involvement
Errors or missed plays when relevant
Defensive position changes when they affect the play
```

## Pitcher changes for both teams

Pitcher changes should be tracked for both teams because they affect:

```text
Replay
Pitch count
Batting matchup
Game story
Coaching review
Player safety
```

`player_game_changes` should be used for both teams.

Example:

```text
change_type: Pitcher Change
team_id: Opponent Team
player_out_id: Opponent #12
player_in_id: Opponent #7
old_position: P
new_position: P
event_order: 187
event_time_utc: 2026-06-07T19:42:10Z
```

## Recommended version 1 approach

For the user's team:

```text
Full player roster
Full batting details
Full pitch tracking
Full defensive alignment
Full bench tracking
Full media tagging
Full replay detail
```

For the opponent:

```text
Team name
Jersey number if known
Batting order slot
Current pitcher
Pitcher changes
Basic pitch count when they are pitching
Batter result
Runner movement
Scoring
Important fielding plays
```

This keeps live scoring manageable while still preserving enough data for replay and score accuracy.

## Optional table: game_player_aliases

This table helps track opponents when their real names are unknown.

```sql
CREATE TABLE game_player_aliases (
    game_player_alias_id UUID PRIMARY KEY,
    game_id              UUID NOT NULL REFERENCES games(game_id),
    team_id              UUID NOT NULL REFERENCES teams(team_id),
    player_id            UUID REFERENCES players(player_id),

    batting_order        INT,
    jersey_number        INT,
    display_label        VARCHAR(100) NOT NULL,
    -- Example: Opponent #8, Opponent Batter 3, Blue Team Pitcher

    is_real_player_known BOOLEAN DEFAULT FALSE,

    created_at_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc       TIMESTAMPTZ
);
```

This lets the scorer start quickly and fill in more detail later if needed.


# Suggested Repository/Container Split

## Reusable landing feature libraries

The landing experience should not be implemented as one large page-specific
component library. Separate each reusable scoring or display process:

```text
@ll-score/scoreboard       score, inning, game status, count, and outs display
@ll-score/rosters          rosters, lineups, positions, bench, batter, pitcher
@ll-score/base-runners     occupied bases, movements, corrections, replay state
@ll-score/count-controls   balls, strikes, outs, fast entry, correction intents
@ll-score/pitch-location   3x3 zone and special pitch-location areas
@ll-score/hit-location     field-map hit location and normalized coordinates
@ll-score/field-diagram    shared field geometry and rendering primitives
```

Each package should expose pure models/selectors separately from React
components. It receives typed service results and emits typed callbacks or
command intents. It must not access the filesystem, JSONL, PostgreSQL, or
internal repositories.

The packages are reused by the live scoring and replay screens. For example,
`@ll-score/base-runners` renders current `base_state_snapshots` during live
scoring and `baseStateBefore`/`baseStateAfter` during replay. The Game Engine
remains authoritative for applying events and corrections.

Pitch location and hit location must remain separate packages. Pitch location
does not determine the umpire's call, and hit location does not determine the
official scoring result. Shared coordinate behavior belongs in
`@ll-score/field-diagram`.

Do not create one container per feature package. The feature packages run in
the Landing container and use the Game Engine library/API for reads and writes.

## `ll-replay-landing`

Frontend user interface.

Responsibilities:

- Game scoring screen
- Tap/touch field map
- Replay viewer
- Team/player dashboards
- Media upload/view
- Public/parent/coach views

## `ll-replay-orm`

Database schema, migrations, and data access.

Responsibilities:

- Tables
- SQL migrations
- Query layer
- Replay event retrieval
- Stats queries

## `ll-replay-i-am`

Identity, authentication, authorization, and permission sets.

Responsibilities:

- Login
- Permission sets
- User roles
- Public/parent/coach/admin access
- Field-level and action-level permissions

## `ll-replay-media`

Optional future service for images and videos.

Responsibilities:

- Uploads
- Storage
- Thumbnails
- Video clips
- Media visibility
- Player tags

## `ll-replay-lib`

Original shared components/utilities proposal. The current architecture
supersedes this single broad library with the reusable feature packages listed
above plus `@ll-score/ui`.

Responsibilities:

- Baseball rules helpers
- Replay event models
- Permission helper functions
- Common UI components
- Coordinate mapping utilities

---

# Final Recommendation

The most important foundation is this:

```text
game_events              = exact replay timeline
event_order              = sequence for animation
event_time_utc           = real-world action time
logged_at_utc            = scorer entry time
game_state_snapshots     = score/count/outs/bases after event
base_runner_events       = what every runner did
defensive_alignment      = who was playing where
pitches                  = every pitch
balls_in_play            = where the ball went
fielding_plays           = what the defense did
event_media              = images/videos attached to events/actions
pitcher_usage            = pitch count and innings pitched
```

That structure supports live scoring now and animated replay later.
