BEGIN;

CREATE TABLE games (
    game_id UUID PRIMARY KEY,
    home_team_id UUID NOT NULL REFERENCES teams(team_id),
    away_team_id UUID NOT NULL REFERENCES teams(team_id),
    timezone_name TEXT NOT NULL,
    scheduled_start_utc TIMESTAMPTZ,
    status TEXT NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

CREATE TABLE game_rosters (
    game_id UUID NOT NULL REFERENCES games(game_id),
    team_id UUID NOT NULL REFERENCES teams(team_id),
    player_id UUID NOT NULL REFERENCES player_profiles(player_id),
    membership_id UUID REFERENCES memberships(membership_id),
    display_name_snapshot TEXT NOT NULL,
    jersey_number_snapshot TEXT,
    team_name_snapshot TEXT NOT NULL,
    batting_order INTEGER,
    initial_position TEXT NOT NULL,
    is_present BOOLEAN NOT NULL,
    PRIMARY KEY (game_id, player_id)
);

COMMIT;
