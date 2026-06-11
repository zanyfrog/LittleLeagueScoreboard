import type { GameEvent } from "@ll-score/contracts";

export interface AppendGameEventsInput {
  gameId: string;
  expectedVersion: number;
  actorId: string;
  events: GameEvent[];
}

export interface GameEventStore {
  append(input: AppendGameEventsInput): Promise<number>;
  read(gameId: string, afterVersion?: number): Promise<GameEvent[]>;
  getVersion(gameId: string): Promise<number>;
}
