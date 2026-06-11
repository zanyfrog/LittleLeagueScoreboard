BEGIN;

CREATE TABLE teams (
    team_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(organization_id),
    name TEXT NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

CREATE TABLE memberships (
    membership_id UUID PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES player_profiles(player_id),
    team_id UUID NOT NULL REFERENCES teams(team_id),
    season_id UUID NOT NULL REFERENCES seasons(season_id),
    membership_type TEXT NOT NULL,
    status TEXT NOT NULL,
    jersey_number TEXT,
    primary_position TEXT,
    joined_on DATE NOT NULL,
    left_on DATE,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

CREATE INDEX memberships_player_idx ON memberships(player_id);
CREATE INDEX memberships_team_season_idx ON memberships(team_id, season_id);

COMMIT;
