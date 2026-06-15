import { randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname } from "node:path";
import type { StorageTransaction } from "@ll-score/contracts";
import {
  DataCorruptionError,
  StreamVersionConflictError
} from "@ll-score/storage-core";
import { calculateChecksum } from "./checksum.js";
import type { WriteQueue } from "./write-queue.js";

interface ChecksumInput<T> {
  transactionId: string;
  streamId: string;
  streamVersion: number;
  schemaVersion: number;
  occurredAtUtc: string;
  actorId: string;
  operation: string;
  payload: T;
  previousChecksum: string | null;
}

export interface AppendRecord<T> {
  operation: string;
  payload: T;
  actorId: string;
  occurredAtUtc?: string;
}

export class JsonlStream<T> {
  readonly #path: string;
  readonly #streamId: string;
  readonly #queue: WriteQueue;

  constructor(path: string, streamId: string, queue: WriteQueue) {
    this.#path = path;
    this.#streamId = streamId;
    this.#queue = queue;
  }

  read(): Promise<StorageTransaction<T>[]> {
    return readVerifiedTransactions<T>(this.#path, this.#streamId);
  }

  append(
    expectedVersion: number,
    record: AppendRecord<T>
  ): Promise<StorageTransaction<T>> {
    return this.appendMany(expectedVersion, [record]).then(
      (transactions) => transactions[0]!
    );
  }

  appendMany(
    expectedVersion: number,
    records: AppendRecord<T>[]
  ): Promise<StorageTransaction<T>[]> {
    return this.#queue.enqueue(async () => {
      const existing = await this.read();
      if (existing.length !== expectedVersion) {
        throw new StreamVersionConflictError(
          this.#streamId,
          expectedVersion,
          existing.length
        );
      }

      let previousChecksum = existing.at(-1)?.checksum ?? null;
      const transactions = records.map((record, index) => {
        const checksumInput: ChecksumInput<T> = {
          transactionId: randomUUID(),
          streamId: this.#streamId,
          streamVersion: expectedVersion + index + 1,
          schemaVersion: 1,
          occurredAtUtc: record.occurredAtUtc ?? new Date().toISOString(),
          actorId: record.actorId,
          operation: record.operation,
          payload: record.payload,
          previousChecksum
        };
        const transaction: StorageTransaction<T> = {
          ...checksumInput,
          checksum: calculateChecksum(checksumInput)
        };
        previousChecksum = transaction.checksum;
        return transaction;
      });

      if (transactions.length > 0) {
        await mkdir(dirname(this.#path), { recursive: true });
        await appendFile(
          this.#path,
          transactions.map((item) => JSON.stringify(item)).join("\n") + "\n",
          { encoding: "utf8", flush: true }
        );
      }
      return transactions;
    });
  }

  removeWhere(predicate: (payload: T) => boolean): Promise<number> {
    return this.#queue.enqueue(async () => {
      const existing = await this.read();
      const retained = existing.filter(
        (transaction) => !predicate(transaction.payload)
      );
      const removed = existing.length - retained.length;
      if (removed === 0) return 0;

      let previousChecksum: string | null = null;
      const transactions = retained.map((transaction, index) => {
        const { checksum: _checksum, ...existingInput } = transaction;
        const checksumInput: ChecksumInput<T> = {
          ...existingInput,
          streamVersion: index + 1,
          previousChecksum
        };
        const rewritten: StorageTransaction<T> = {
          ...checksumInput,
          checksum: calculateChecksum(checksumInput)
        };
        previousChecksum = rewritten.checksum;
        return rewritten;
      });

      await mkdir(dirname(this.#path), { recursive: true });
      const temporaryPath = `${this.#path}.${randomUUID()}.tmp`;
      await writeFile(
        temporaryPath,
        transactions.length
          ? `${transactions.map((item) => JSON.stringify(item)).join("\n")}\n`
          : "",
        { encoding: "utf8", flush: true }
      );
      await rm(this.#path, { force: true });
      await rename(temporaryPath, this.#path);
      return removed;
    });
  }
}

export async function readVerifiedTransactions<T>(
  path: string,
  expectedStreamId?: string
): Promise<StorageTransaction<T>[]> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const transactions: StorageTransaction<T>[] = [];
  let previousChecksum: string | null = null;
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let transaction: StorageTransaction<T>;
    try {
      transaction = JSON.parse(line) as StorageTransaction<T>;
    } catch {
      throw new DataCorruptionError(path, `invalid JSON on line ${index + 1}`);
    }
    if (expectedStreamId && transaction.streamId !== expectedStreamId) {
      throw new DataCorruptionError(path, `unexpected stream on line ${index + 1}`);
    }
    if (transaction.streamVersion !== transactions.length + 1) {
      throw new DataCorruptionError(path, `invalid version on line ${index + 1}`);
    }
    if (transaction.previousChecksum !== previousChecksum) {
      throw new DataCorruptionError(path, `broken checksum chain on line ${index + 1}`);
    }
    const { checksum, ...checksumInput } = transaction;
    if (calculateChecksum(checksumInput) !== checksum) {
      throw new DataCorruptionError(path, `checksum mismatch on line ${index + 1}`);
    }
    transactions.push(transaction);
    previousChecksum = checksum;
  }
  return transactions;
}
