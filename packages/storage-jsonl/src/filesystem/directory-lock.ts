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
      await this.#createLock();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        if (await this.#removeStaleLock()) {
          await this.#createLock();
          return;
        }
        throw new DataDirectoryLockedError(this.#path);
      }
      throw error;
    }
  }

  async #createLock(): Promise<void> {
    this.#handle = await open(this.#path, "wx");
    await this.#handle.writeFile(
      JSON.stringify({
        processId: process.pid,
        acquiredAtUtc: new Date().toISOString()
      }),
      "utf8"
    );
    await this.#handle.sync();
  }

  async #removeStaleLock(): Promise<boolean> {
    try {
      const owner = JSON.parse(await readFile(this.#path, "utf8")) as {
        processId?: number;
      };
      if (!owner.processId || owner.processId === process.pid) return false;
      try {
        process.kill(owner.processId, 0);
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") return false;
      }
      await unlink(this.#path);
      return true;
    } catch {
      return false;
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
