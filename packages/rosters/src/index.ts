import type { PlayerPosition } from "@ll-score/contracts";
import type { GameLineup } from "@ll-score/game-engine";

export const selectablePositions: PlayerPosition[] = [
  "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "LCF", "RCF", "RF",
  "BENCH", "BULLPEN", "UNKNOWN"
];

export function groupLineup(lineup: GameLineup) {
  return {
    field: lineup.players.filter(
      (player) => !["BENCH", "BULLPEN", "UNKNOWN"].includes(player.position)
    ),
    bench: lineup.players.filter((player) => player.position === "BENCH"),
    bullpen: lineup.players.filter((player) => player.position === "BULLPEN"),
    unknown: lineup.players.filter((player) => player.position === "UNKNOWN")
  };
}
