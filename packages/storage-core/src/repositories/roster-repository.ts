import type { GameRosterEntry } from "@ll-score/contracts";

export interface RosterRepository {
  getGameRoster(gameId: string): Promise<GameRosterEntry[]>;
  replaceGameRoster(
    gameId: string,
    entries: GameRosterEntry[],
    actorId: string
  ): Promise<void>;
}
