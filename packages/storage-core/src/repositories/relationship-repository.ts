export interface RelationshipRecord {
  relationshipId: string;
  fromPersonId: string;
  toPersonId: string;
  relationshipType: string;
  createdAtUtc: string;
}

export interface RelationshipRepository {
  getById(id: string): Promise<RelationshipRecord | null>;
  listForPerson(personId: string): Promise<RelationshipRecord[]>;
  save(value: RelationshipRecord, actorId: string): Promise<void>;
}
