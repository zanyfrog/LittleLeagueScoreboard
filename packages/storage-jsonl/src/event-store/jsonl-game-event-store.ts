import { join } from "node:path";
import type { GameEvent } from "@ll-score/contracts";
import type {
  AppendGameEventsInput,
  GameEventStore
} from "@ll-score/storage-core";
import { JsonlStream } from "../filesystem/jsonl-stream.js";
import type { WriteQueue } from "../filesystem/write-queue.js";

export class JsonlGameEventStore implements GameEventStore {
  readonly #gamesPath: string;
  readonly #queue: WriteQueue;

  constructor(gamesPath: string, queue: WriteQueue) {
    this.#gamesPath = gamesPath;
    this.#queue = queue;
  }

  async append(input: AppendGameEventsInput): Promise<number> {
    input.events.forEach((event, index) => {
      if (event.gameId !== input.gameId) {
        throw new Error("Every event must belong to the requested game");
      }
      if (event.eventOrder !== input.expectedVersion + index + 1) {
        throw new Error("Event order must be contiguous with the stream version");
      }
    });

    const transactions = await this.#stream(input.gameId).appendMany(
      input.expectedVersion,
      input.events.map((event) => ({
        operation: event.eventType,
        payload: event,
        actorId: input.actorId,
        occurredAtUtc: event.loggedAtUtc
      }))
    );
    return input.expectedVersion + transactions.length;
  }

  async read(gameId: string, afterVersion = 0): Promise<GameEvent[]> {
    return (await this.#stream(gameId).read())
      .filter((item) => item.streamVersion > afterVersion)
      .map((item) => item.payload);
  }

  async getVersion(gameId: string): Promise<number> {
    return (await this.#stream(gameId).read()).length;
  }

  #stream(gameId: string): JsonlStream<GameEvent> {
    return new JsonlStream(
      join(this.#gamesPath, gameId, "events.jsonl"),
      `game:${gameId}:events`,
      this.#queue
    );
  }
}
