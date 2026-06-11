import { join } from "node:path";
import type {
  RelationshipRecord,
  RelationshipRepository
} from "@ll-score/storage-core";
import { JsonlStream } from "../filesystem/jsonl-stream.js";
import type { WriteQueue } from "../filesystem/write-queue.js";
import { JsonlRepository } from "./jsonl-repository.js";

export class JsonlRelationshipRepository implements RelationshipRepository {
  readonly #repository: JsonlRepository<RelationshipRecord>;

  constructor(catalogPath: string, queue: WriteQueue) {
    this.#repository = new JsonlRepository(
      new JsonlStream(
        join(catalogPath, "relationships.jsonl"),
        "catalog:relationships",
        queue
      ),
      (value) => value.relationshipId
    );
  }

  getById(id: string): Promise<RelationshipRecord | null> {
    return this.#repository.getById(id);
  }

  async listForPerson(personId: string): Promise<RelationshipRecord[]> {
    return (await this.#repository.list()).filter(
      (item) =>
        item.fromPersonId === personId || item.toPersonId === personId
    );
  }

  save(value: RelationshipRecord, actorId: string): Promise<void> {
    return this.#repository.save(value, actorId);
  }
}
