import type { Repository } from "@ll-score/storage-core";
import { JsonlStream } from "../filesystem/jsonl-stream.js";

export class JsonlRepository<T> implements Repository<T> {
  readonly #stream: JsonlStream<T>;
  readonly #getId: (value: T) => string;

  constructor(stream: JsonlStream<T>, getId: (value: T) => string) {
    this.#stream = stream;
    this.#getId = getId;
  }

  async getById(id: string): Promise<T | null> {
    return (await this.#current()).get(id) ?? null;
  }

  async list(): Promise<T[]> {
    return [...(await this.#current()).values()];
  }

  async save(value: T, actorId: string): Promise<void> {
    const existing = await this.#stream.read();
    await this.#stream.append(existing.length, {
      operation: "UPSERT",
      payload: value,
      actorId
    });
  }

  async #current(): Promise<Map<string, T>> {
    const current = new Map<string, T>();
    for (const transaction of await this.#stream.read()) {
      current.set(this.#getId(transaction.payload), transaction.payload);
    }
    return current;
  }
}
