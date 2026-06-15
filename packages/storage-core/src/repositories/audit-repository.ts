import type { ApplicationAuditEvent } from "@ll-score/contracts";

export interface AuditRepository {
  append(event: ApplicationAuditEvent): Promise<void>;
  list(resourceId?: string): Promise<ApplicationAuditEvent[]>;
  deleteForResource(resourceId: string): Promise<number>;
}
