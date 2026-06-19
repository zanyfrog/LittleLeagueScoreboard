import { describe, expect, it } from "vitest";
import type { Game, GameEvent } from "@ll-score/contracts";
import { projectScore } from "./index.js";

const game: Game = {
  gameId: "game-1",
  homeTeamId: "home",
  awayTeamId: "away",
  timezoneName: "America/New_York",
  status: "IN_PROGRESS",
  createdAtUtc: "2026-06-12T12:00:00.000Z"
};

function event(order: number, type: GameEvent["eventType"]): GameEvent {
  return {
    eventId: `event-${order}`,
    gameId: game.gameId,
    eventOrder: order,
    eventTimeUtc: "2026-06-12T12:00:00.000Z",
    loggedAtUtc: "2026-06-12T12:00:00.000Z",
    eventType: type,
    actorId: "scorer",
    payload: {},
    positionChanges: [],
    runnerMovements: []
  };
}

describe("projectScore", () => {
  it("removes runs from reversed movement events", () => {
    const run = {
      ...event(1, "RunnerMoved"),
      runnerMovements: [{
        runnerId: "runner-1",
        from: "THIRD" as const,
        to: "HOME" as const,
        outcome: "SAFE" as const,
        reason: "walk"
      }]
    };
    const reversal = {
      ...event(2, "EventReversed"),
      reversesEventId: run.eventId
    };
    expect(projectScore(game, [run, reversal])).toEqual({
      homeScore: 0,
      awayScore: 0,
      homeInningScores: [null, null, null, null, null, null],
      awayInningScores: [null, null, null, null, null, null]
    });
  });

  it("projects runs by inning and extends for extra innings", () => {
    const topFirstRun = {
      ...event(1, "RunnerMoved"),
      runnerMovements: [{
        runnerId: "away-runner",
        from: "THIRD" as const,
        to: "HOME" as const,
        outcome: "SAFE" as const,
        reason: "hit"
      }]
    };
    const bottomFirst = {
      ...event(2, "HalfInningStarted"),
      payload: { inning: 1, half: "BOTTOM" }
    };
    const homeRun = {
      ...event(3, "RunnerMoved"),
      runnerMovements: [{
        runnerId: "home-runner",
        from: "THIRD" as const,
        to: "HOME" as const,
        outcome: "SAFE" as const,
        reason: "hit"
      }]
    };
    const topSeventh = {
      ...event(4, "HalfInningStarted"),
      payload: { inning: 7, half: "TOP" }
    };
    const extraRun = {
      ...event(5, "RunnerMoved"),
      runnerMovements: [{
        runnerId: "away-extra",
        from: "THIRD" as const,
        to: "HOME" as const,
        outcome: "SAFE" as const,
        reason: "hit"
      }]
    };

    expect(
      projectScore(game, [
        topFirstRun,
        bottomFirst,
        homeRun,
        topSeventh,
        extraRun
      ])
    ).toMatchObject({
      awayScore: 2,
      homeScore: 1,
      awayInningScores: [1, null, null, null, null, null, 1],
      homeInningScores: [1, null, null, null, null, null, null]
    });
  });

  it("leaves a scoreless active inning blank until the half-inning ends", () => {
    const bottomFirst = {
      ...event(1, "HalfInningStarted"),
      payload: { inning: 1, half: "BOTTOM" }
    };
    const topSecond = {
      ...event(2, "HalfInningStarted"),
      payload: { inning: 2, half: "TOP" }
    };

    expect(projectScore(game, [bottomFirst])).toMatchObject({
      awayInningScores: [0, null, null, null, null, null],
      homeInningScores: [null, null, null, null, null, null]
    });
    expect(projectScore(game, [bottomFirst, topSecond])).toMatchObject({
      awayInningScores: [0, null, null, null, null, null],
      homeInningScores: [0, null, null, null, null, null]
    });
  });

  it("leaves an unplayed home half blank when the game is finalized", () => {
    const topSixth = {
      ...event(1, "HalfInningStarted"),
      payload: { inning: 6, half: "TOP" }
    };
    const bottomSixth = {
      ...event(2, "HalfInningStarted"),
      payload: { inning: 6, half: "BOTTOM" }
    };
    const final = {
      ...event(3, "GameFinalized"),
      payload: { inning: 6, half: "BOTTOM", expectedInnings: 6 }
    };

    expect(projectScore(game, [topSixth, bottomSixth, final])).toMatchObject({
      awayInningScores: [0, null, null, null, null, 0],
      homeInningScores: [null, null, null, null, null, null]
    });
  });

  it("records zero when the home team bats scorelessly before final", () => {
    const topSixth = {
      ...event(1, "HalfInningStarted"),
      payload: { inning: 6, half: "TOP" }
    };
    const bottomSixth = {
      ...event(2, "HalfInningStarted"),
      payload: { inning: 6, half: "BOTTOM" }
    };
    const homeBatter = {
      ...event(3, "PlateAppearanceStarted"),
      payload: { batterId: "home-1" }
    };
    const final = {
      ...event(4, "GameFinalized"),
      payload: { inning: 6, half: "BOTTOM", expectedInnings: 6 }
    };

    expect(projectScore(game, [topSixth, bottomSixth, homeBatter, final])).toMatchObject({
      awayInningScores: [0, null, null, null, null, 0],
      homeInningScores: [null, null, null, null, null, 0]
    });
  });
});
