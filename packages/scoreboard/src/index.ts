import type { Game, GameEvent } from "@ll-score/contracts";
import { activeGameEvents } from "@ll-score/count-controls";

export interface ScoreboardView {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeInningScores: Array<number | null>;
  awayInningScores: Array<number | null>;
  inning: number;
  half: "TOP" | "BOTTOM";
  balls: number;
  strikes: number;
  outs: number;
  status: string;
}

export function createEmptyScoreboard(
  homeTeam: string,
  awayTeam: string,
  status: string
): ScoreboardView {
  return {
    homeTeam,
    awayTeam,
    homeScore: 0,
    awayScore: 0,
    homeInningScores: [null, null, null, null, null, null],
    awayInningScores: [null, null, null, null, null, null],
    inning: 1,
    half: "TOP",
    balls: 0,
    strikes: 0,
    outs: 0,
    status
  };
}

export function projectScore(
  game: Game,
  events: GameEvent[]
): {
  homeScore: number;
  awayScore: number;
  homeInningScores: Array<number | null>;
  awayInningScores: Array<number | null>;
} {
  let homeScore = 0;
  let awayScore = 0;
  let inning = 1;
  let half: "TOP" | "BOTTOM" = "TOP";
  let currentHalfHadBattingActivity = false;
  const homeInningScores: Array<number | null> = [
    null, null, null, null, null, null
  ];
  const awayInningScores: Array<number | null> = [
    null, null, null, null, null, null
  ];
  for (const event of activeGameEvents(events).sort(
    (left, right) => left.eventOrder - right.eventOrder
  )) {
    if (event.eventType === "HalfInningStarted") {
      const nextInning = Number(event.payload.inning ?? inning);
      const nextHalf = event.payload.half === "BOTTOM" ? "BOTTOM" : "TOP";
      if (nextInning !== inning || nextHalf !== half) {
        const completedScores =
          half === "TOP" ? awayInningScores : homeInningScores;
        completedScores[inning - 1] ??= 0;
      }
      inning = nextInning;
      half = nextHalf;
      currentHalfHadBattingActivity = false;
    }
    if (
      event.eventType === "PlateAppearanceStarted" ||
      event.eventType === "PitchRecorded" ||
      event.eventType === "FieldingActionRecorded" ||
      event.eventType === "BallPutInPlay" ||
      event.eventType === "RunnerMoved" ||
      event.eventType === "RunnerOut" ||
      event.eventType === "RunScored"
    ) {
      currentHalfHadBattingActivity = true;
    }
    const runs = event.runnerMovements.filter(
      (movement) => movement.to === "HOME" && movement.outcome === "SAFE"
    ).length;
    while (homeInningScores.length < inning) homeInningScores.push(null);
    while (awayInningScores.length < inning) awayInningScores.push(null);
    if (half === "TOP" && runs > 0) {
      awayScore += runs;
      awayInningScores[inning - 1] =
        (awayInningScores[inning - 1] ?? 0) + runs;
    } else if (half === "BOTTOM" && runs > 0) {
      homeScore += runs;
      homeInningScores[inning - 1] =
        (homeInningScores[inning - 1] ?? 0) + runs;
    }
    if (event.eventType === "GameFinalized") {
      const completedScores =
        half === "TOP" ? awayInningScores : homeInningScores;
      if (half === "TOP" || currentHalfHadBattingActivity) {
        completedScores[inning - 1] ??= 0;
      }
    }
  }
  return {
    homeScore,
    awayScore,
    homeInningScores,
    awayInningScores
  };
}
