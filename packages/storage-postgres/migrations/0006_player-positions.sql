BEGIN;

CREATE TABLE player_positions (
    position_code TEXT PRIMARY KEY,
    position_name TEXT NOT NULL,
    is_field_position BOOLEAN NOT NULL,
    allows_multiple BOOLEAN NOT NULL
);

INSERT INTO player_positions
    (position_code, position_name, is_field_position, allows_multiple)
VALUES
    ('P', 'Pitcher', TRUE, FALSE),
    ('C', 'Catcher', TRUE, FALSE),
    ('1B', 'First Base', TRUE, FALSE),
    ('2B', 'Second Base', TRUE, FALSE),
    ('3B', 'Third Base', TRUE, FALSE),
    ('SS', 'Shortstop', TRUE, FALSE),
    ('LF', 'Left Field', TRUE, FALSE),
    ('CF', 'Center Field', TRUE, FALSE),
    ('RF', 'Right Field', TRUE, FALSE),
    ('LCF', 'Left Center Field', TRUE, FALSE),
    ('RCF', 'Right Center Field', TRUE, FALSE),
    ('BENCH', 'Bench', FALSE, TRUE),
    ('BULLPEN', 'Bullpen', FALSE, TRUE),
    ('UNKNOWN', 'Unknown', FALSE, TRUE);

ALTER TABLE player_profiles
    ADD CONSTRAINT player_profiles_primary_position_fk
    FOREIGN KEY (primary_position) REFERENCES player_positions(position_code);

ALTER TABLE memberships
    ADD CONSTRAINT memberships_primary_position_fk
    FOREIGN KEY (primary_position) REFERENCES player_positions(position_code);

ALTER TABLE game_rosters
    ADD CONSTRAINT game_rosters_initial_position_fk
    FOREIGN KEY (initial_position) REFERENCES player_positions(position_code);

COMMIT;
