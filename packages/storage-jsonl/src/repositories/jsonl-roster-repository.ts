import { join } from "node:path";
import type { GameRosterEntry } from "@ll-score/contracts";
import type { RosterRepository } from "@ll-score/storage-core";
import { JsonlStream } from "../filesystem/jsonl-stream.js";
import type { WriteQueue } from "../filesystem/write-queue.js";

export class JsonlRosterRepository implements RosterRepository {
  readonly #gamesPath: string;
  readonly #queue: WriteQueue;

  constructor(gamesPath: string, queue: WriteQueue) {
    this.#gamesPath = gamesPath;
    this.#queue = queue;
  }

  async getGameRoster(gameId: string): Promise<GameRosterEntry[]> {
    const transactions = await this.#stream(gameId).read();
    return transactions.at(-1)?.payload ?? [];
  }

  async replaceGameRoster(
    gameId: string,
    entries: GameRosterEntry[],
    actorId: string
  ): Promise<void> {
    if (entries.some((entry) => entry.gameId !== gameId)) {
      throw new Error("Every roster entry must belong to the requested game");
    }
    const stream = this.#stream(gameId);
    const existing = await stream.read();
    await stream.append(existing.length, {
      operation: "REPLACE_GAME_ROSTER",
      payload: entries,
      actorId
    });
  }

  #stream(gameId: string): JsonlStream<GameRosterEntry[]> {
    return new JsonlStream(
      join(this.#gamesPath, gameId, "roster.jsonl"),
      `game:${gameId}:roster`,
      this.#queue
    );
  }
}
