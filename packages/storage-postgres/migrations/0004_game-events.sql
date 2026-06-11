BEGIN;

CREATE TABLE game_events (
    event_id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(game_id),
    event_order INTEGER NOT NULL,
    event_time_utc TIMESTAMPTZ NOT NULL,
    logged_at_utc TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    position_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
    runner_movements JSONB NOT NULL DEFAULT '[]'::jsonb,
    reverses_event_id UUID REFERENCES game_events(event_id),
    corrects_event_id UUID REFERENCES game_events(event_id),
    correction_note TEXT,
    UNIQUE (game_id, event_order)
);

CREATE INDEX game_events_replay_idx
    ON game_events(game_id, event_order);

COMMIT;
