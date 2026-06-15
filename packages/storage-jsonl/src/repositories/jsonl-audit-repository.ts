import { join } from "node:path";
import type { ApplicationAuditEvent } from "@ll-score/contracts";
import type { AuditRepository } from "@ll-score/storage-core";
import { JsonlStream } from "../filesystem/jsonl-stream.js";
import type { WriteQueue } from "../filesystem/write-queue.js";

export class JsonlAuditRepository implements AuditRepository {
  readonly #stream: JsonlStream<ApplicationAuditEvent>;

  constructor(auditPath: string, queue: WriteQueue) {
    this.#stream = new JsonlStream(
      join(auditPath, "audit-events.jsonl"),
      "audit:application",
      queue
    );
  }

  async append(event: ApplicationAuditEvent): Promise<void> {
    const transactions = await this.#stream.read();
    await this.#stream.append(transactions.length, {
      operation: event.action,
      payload: event,
      actorId: event.actorId,
      occurredAtUtc: event.occurredAtUtc
    });
  }

  async list(resourceId?: string): Promise<ApplicationAuditEvent[]> {
    const events = (await this.#stream.read()).map((item) => item.payload);
    return resourceId
      ? events.filter((event) => event.resourceId === resourceId)
      : events;
  }

  deleteForResource(resourceId: string): Promise<number> {
    return this.#stream.removeWhere(
      (event) => event.resourceId === resourceId
    );
  }
}
