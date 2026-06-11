import { open, readFile, unlink, type FileHandle } from "node:fs/promises";
import { DataDirectoryLockedError } from "@ll-score/storage-core";

export class DataDirectoryLock {
  readonly #path: string;
  #handle: FileHandle | null = null;

  constructor(path: string) {
    this.#path = path;
  }

  async acquire(): Promise<void> {
    try {
      this.#handle = await open(this.#path, "wx");
      await this.#handle.writeFile(
        JSON.stringify({
          processId: process.pid,
          acquiredAtUtc: new Date().toISOString()
        }),
        "utf8"
      );
      await this.#handle.sync();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new DataDirectoryLockedError(this.#path);
      }
      throw error;
    }
  }

  async describeOwner(): Promise<string | null> {
    try {
      return await readFile(this.#path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async release(): Promise<void> {
    await this.#handle?.close();
    this.#handle = null;
    try {
      await unlink(this.#path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
