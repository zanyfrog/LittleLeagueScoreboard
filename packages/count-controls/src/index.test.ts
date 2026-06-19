import { describe, expect, it } from "vitest";
import type { GameEvent } from "@ll-score/contracts";
import {
  activeGameEvents,
  projectGameFlow,
  projectPlateAppearance
} from "./index.js";

function event(
  eventOrder: number,
  eventType: GameEvent["eventType"],
  payload: Record<string, unknown> = {}
): GameEvent {
  return {
    eventId: `event-${eventOrder}`,
    gameId: "game-1",
    eventOrder,
    eventTimeUtc: "2026-06-12T00:00:00.000Z",
    loggedAtUtc: "2026-06-12T00:00:00.000Z",
    eventType,
    actorId: "scorer",
    payload,
    positionChanges: [],
    runnerMovements: []
  };
}

describe("activeGameEvents", () => {
  it("uses a corrected replacement and suppresses the original event", () => {
    const original = event(1, "ScorekeeperCommentRecorded", {
      comment: "Original"
    });
    const correction = {
      ...event(2, "RunScored", { reason: "Corrected action" }),
      correctsEventId: original.eventId,
      correctionNote: "Changed action"
    };

    expect(activeGameEvents([original, correction])).toEqual([correction]);
  });
});

describe("projectPlateAppearance", () => {
  it("tracks the count and closes the appearance on strike three", () => {
    const state = projectPlateAppearance([
      event(1, "PlateAppearanceStarted", {
        batterId: "batter",
        batterLabel: "#1 Batter",
        pitcherId: "pitcher",
        pitcherLabel: "#9 Pitcher"
      }),
      event(2, "PitchRecorded", { call: "BALL" }),
      event(3, "PitchRecorded", { call: "CALLED_STRIKE" }),
      event(4, "PitchRecorded", { call: "FOUL" }),
      event(5, "PitchRecorded", { call: "SWINGING_STRIKE" })
    ]);

    expect(state).toMatchObject({
      balls: 1,
      strikes: 3,
      pitchNumber: 4,
      active: false,
      batterId: "batter"
    });
  });

  it("does not add a third strike for a foul", () => {
    const state = projectPlateAppearance([
      event(1, "PlateAppearanceStarted"),
      event(2, "PitchRecorded", { call: "CALLED_STRIKE" }),
      event(3, "PitchRecorded", { call: "SWINGING_STRIKE" }),
      event(4, "PitchRecorded", { call: "FOUL" })
    ]);

    expect(state.strikes).toBe(2);
    expect(state.active).toBe(true);
  });

  it("removes a reversed pitch from the count", () => {
    const pitch = event(2, "PitchRecorded", { call: "BALL" });
    const reversal = {
      ...event(3, "EventReversed"),
      reversesEventId: pitch.eventId
    };
    const state = projectPlateAppearance([
      event(1, "PlateAppearanceStarted"),
      pitch,
      reversal
    ]);
    expect(state.balls).toBe(0);
    expect(state.pitchNumber).toBe(0);
  });

  it("uses the recorded result rather than location for the count", () => {
    const state = projectPlateAppearance([
      event(1, "PlateAppearanceStarted"),
      event(2, "PitchRecorded", {
        actionId: "pitch-1",
        source: "location",
        locationZone: 5
      }),
      event(3, "FieldingActionRecorded", {
        actionId: "pitch-1",
        source: "pitch-result",
        countsTowardPitch: true,
        result: "BALL"
      })
    ]);

    expect(state).toMatchObject({
      balls: 1,
      strikes: 0,
      pitchNumber: 1,
      active: true
    });
  });

  it("replaces a changed pending location without adding another pitch", () => {
    const original = event(2, "PitchRecorded", {
      actionId: "pitch-1",
      source: "location",
      locationZone: 8
    });
    const replacement = {
      ...event(3, "PitchRecorded", {
        actionId: "pitch-1",
        source: "location",
        locationZone: 3
      }),
      correctsEventId: original.eventId,
      correctionNote: "Pitch location changed"
    };
    const state = projectPlateAppearance([
      event(1, "PlateAppearanceStarted"),
      original,
      replacement
    ]);

    expect(state.pitchNumber).toBe(1);
    expect(activeGameEvents([original, replacement])).toEqual([replacement]);
  });

  it("switches sides and resets outs when a half-inning ends early", () => {
    const state = projectPlateAppearance([
      event(1, "HalfInningStarted", { inning: 2, half: "TOP" }),
      event(2, "RunnerOut"),
      event(3, "HalfInningStarted", {
        inning: 2,
        half: "BOTTOM",
        reason: "mercy rule"
      })
    ]);

    expect(state).toMatchObject({
      inning: 2,
      half: "BOTTOM",
      outs: 0,
      active: false
    });
  });

  it("closes the appearance when result-driven consequences are recorded", () => {
    const walk = projectPlateAppearance([
      event(1, "PlateAppearanceStarted"),
      event(2, "FieldingActionRecorded", {
        countsTowardPitch: true,
        result: "BALL"
      }),
      event(3, "RunnerMoved", { reason: "walk" })
    ]);
    const strikeout = projectPlateAppearance([
      event(1, "PlateAppearanceStarted"),
      event(2, "FieldingActionRecorded", {
        countsTowardPitch: true,
        result: "SWINGING_STRIKE"
      }),
      event(3, "RunnerOut", { reason: "strikeout" })
    ]);

    expect(walk.active).toBe(false);
    expect(strikeout.active).toBe(false);
  });

  it("keeps separate batting-order cursors across half innings", () => {
    const game = {
      gameId: "game-1",
      homeTeamId: "home",
      awayTeamId: "away",
      timezoneName: "America/New_York",
      status: "IN_PROGRESS" as const,
      createdAtUtc: "2026-06-12T00:00:00.000Z"
    };
    const roster = [
      {
        gameId: "game-1", teamId: "away", playerId: "a1",
        displayNameSnapshot: "Away One", teamNameSnapshot: "Away",
        battingOrder: 1, initialPosition: "P" as const, isPresent: true
      },
      {
        gameId: "game-1", teamId: "away", playerId: "a2",
        displayNameSnapshot: "Away Two", teamNameSnapshot: "Away",
        battingOrder: 2, initialPosition: "C" as const, isPresent: true
      },
      {
        gameId: "game-1", teamId: "home", playerId: "h1",
        displayNameSnapshot: "Home One", teamNameSnapshot: "Home",
        battingOrder: 1, initialPosition: "P" as const, isPresent: true
      }
    ];
    const events = [
      event(1, "PlateAppearanceStarted", { battingTeamId: "away" }),
      event(2, "RunnerMoved", { reason: "walk" }),
      event(3, "HalfInningStarted", { inning: 1, half: "BOTTOM" }),
      event(4, "PlateAppearanceStarted", { battingTeamId: "home" }),
      event(5, "RunnerOut"),
      event(6, "HalfInningStarted", { inning: 2, half: "TOP" })
    ];
    expect(projectGameFlow(game, roster, events).nextBatterId).toBe("a2");
  });

  it("does not advance the batter for a post-play runner out", () => {
    const game = {
      gameId: "game-1",
      homeTeamId: "home",
      awayTeamId: "away",
      timezoneName: "America/New_York",
      status: "IN_PROGRESS" as const,
      createdAtUtc: "2026-06-12T00:00:00.000Z"
    };
    const roster = [
      {
        gameId: "game-1", teamId: "away", playerId: "a1",
        displayNameSnapshot: "Away One", teamNameSnapshot: "Away",
        battingOrder: 1, initialPosition: "P" as const, isPresent: true
      },
      {
        gameId: "game-1", teamId: "away", playerId: "a2",
        displayNameSnapshot: "Away Two", teamNameSnapshot: "Away",
        battingOrder: 2, initialPosition: "C" as const, isPresent: true
      }
    ];
    const events = [
      event(1, "PlateAppearanceStarted", {
        battingTeamId: "away",
        batterId: "a1"
      }),
      event(2, "RunnerOut", {
        reason: "pickoff",
        completesPlateAppearance: false
      })
    ];

    const flow = projectGameFlow(game, roster, events);
    expect(flow.outs).toBe(1);
    expect(flow.nextBatterId).toBe("a1");
    expect(flow.active).toBe(true);
  });

  it("counts both outs on a double play while advancing the batting order once", () => {
    const game = {
      gameId: "game-1",
      homeTeamId: "home",
      awayTeamId: "away",
      timezoneName: "America/New_York",
      status: "IN_PROGRESS" as const,
      createdAtUtc: "2026-06-12T00:00:00.000Z"
    };
    const roster = [
      {
        gameId: "game-1", teamId: "away", playerId: "a1",
        displayNameSnapshot: "Away One", teamNameSnapshot: "Away",
        battingOrder: 1, initialPosition: "P" as const, isPresent: true
      },
      {
        gameId: "game-1", teamId: "away", playerId: "a2",
        displayNameSnapshot: "Away Two", teamNameSnapshot: "Away",
        battingOrder: 2, initialPosition: "C" as const, isPresent: true
      }
    ];
    const events = [
      event(1, "PlateAppearanceStarted", {
        battingTeamId: "away",
        batterId: "a1"
      }),
      event(2, "RunnerOut", {
        reason: "double play",
        runnerId: "runner-on-first",
        completesPlateAppearance: false
      }),
      event(3, "RunnerOut", {
        reason: "double play",
        batterId: "a1"
      })
    ];

    const flow = projectGameFlow(game, roster, events);
    expect(flow.outs).toBe(2);
    expect(flow.nextBatterId).toBe("a2");
    expect(flow.active).toBe(false);
  });

  it("uses an explicit out-count adjustment for scorer corrections", () => {
    const state = projectPlateAppearance([
      event(1, "RunnerOut"),
      event(2, "RunnerOut"),
      event(3, "OutCountAdjusted", {
        outs: 1,
        reason: "scorekeeper correction"
      })
    ]);

    expect(state.outs).toBe(1);
  });
});
