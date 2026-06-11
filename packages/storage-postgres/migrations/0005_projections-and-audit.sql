BEGIN;

CREATE TABLE game_projection_snapshots (
    game_id UUID PRIMARY KEY REFERENCES games(game_id),
    event_version INTEGER NOT NULL,
    base_state JSONB NOT NULL,
    defensive_alignments JSONB NOT NULL,
    replay_frames JSONB NOT NULL,
    statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at_utc TIMESTAMPTZ NOT NULL
);

CREATE TABLE audit_events (
    audit_event_id UUID PRIMARY KEY,
    occurred_at_utc TIMESTAMPTZ NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    outcome TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;
