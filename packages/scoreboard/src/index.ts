export interface ScoreboardView {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
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
): { homeScore: number; awayScore: number } {
  let homeScore = 0;
  let awayScore = 0;
  let half: "TOP" | "BOTTOM" = "TOP";
  for (const event of [...events].sort(
    (left, right) => left.eventOrder - right.eventOrder
  )) {
    if (event.eventType === "HalfInningStarted") {
      half = event.payload.half === "BOTTOM" ? "BOTTOM" : "TOP";
    }
    const runs = event.runnerMovements.filter(
      (movement) => movement.to === "HOME" && movement.outcome === "SAFE"
    ).length;
    if (half === "TOP") awayScore += runs;
    else homeScore += runs;
  }
  return { homeScore, awayScore };
}
import type { Game, GameEvent } from "@ll-score/contracts";
