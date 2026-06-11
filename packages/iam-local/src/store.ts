import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEvent, LocalIamState, StoreRecord } from "./model.js";

const emptyState = (): LocalIamState => ({
  users: new Map(),
  usersByName: new Map(),
  permissionSets: new Map(),
  assignments: [],
  restrictions: [],
  sessions: new Map(),
  policyVersion: 0
});

export class JsonlIamStore {
  readonly #recordsPath: string;
  readonly #auditPath: string;
  #writeChain: Promise<void> = Promise.resolve();

  constructor(recordsPath: string, auditPath: string) {
    this.#recordsPath = recordsPath;
    this.#auditPath = auditPath;
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(dirname(this.#recordsPath), { recursive: true }),
      mkdir(dirname(this.#auditPath), { recursive: true })
    ]);
  }

  async load(): Promise<LocalIamState> {
    await this.initialize();
    const state = emptyState();
    let contents = "";
    try {
      contents = await readFile(this.#recordsPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      this.#apply(state, JSON.parse(line) as StoreRecord);
    }
    return state;
  }

  append(record: StoreRecord): Promise<void> {
    return this.#enqueue(this.#recordsPath, record);
  }

  appendAudit(event: AuditEvent): Promise<void> {
    return this.#enqueue(this.#auditPath, event);
  }

  #enqueue(path: string, value: unknown): Promise<void> {
    const write = async () => {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(value)}\n`, {
        encoding: "utf8",
        flush: true
      });
    };
    this.#writeChain = this.#writeChain.then(write, write);
    return this.#writeChain;
  }

  #apply(state: LocalIamState, record: StoreRecord): void {
    switch (record.type) {
      case "user":
        state.users.set(record.value.actorId, record.value);
        state.usersByName.set(record.value.username.toLowerCase(), record.value);
        break;
      case "permission-set":
        state.permissionSets.set(record.value.key, record.value);
        break;
      case "assignment":
        state.assignments.push(record.value);
        break;
      case "restriction":
        state.restrictions.push(record.value);
        break;
      case "session":
        state.sessions.set(record.value.tokenHash, record.value);
        break;
      case "policy-version":
        state.policyVersion = record.value;
        break;
    }
  }
}
