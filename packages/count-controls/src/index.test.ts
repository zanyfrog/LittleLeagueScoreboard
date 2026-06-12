import { describe, expect, it } from "vitest";
import type { GameEvent } from "@ll-score/contracts";
import { projectGameFlow, projectPlateAppearance } from "./index.js";

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
});
