BEGIN;

CREATE TABLE people (
    person_id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

CREATE TABLE player_profiles (
    player_id UUID PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES people(person_id),
    bats TEXT NOT NULL CHECK (bats IN ('LEFT', 'RIGHT', 'SWITCH', 'UNKNOWN')),
    throws TEXT NOT NULL CHECK (throws IN ('LEFT', 'RIGHT', 'UNKNOWN')),
    primary_position TEXT,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

CREATE TABLE seasons (
    season_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(organization_id),
    name TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ
);

COMMIT;
