import { z } from "zod";

export const applicationAuditEventSchema = z.object({
  auditEventId: z.string().min(1),
  occurredAtUtc: z.string().datetime(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1).optional(),
  outcome: z.enum(["ALLOWED", "DENIED", "ERROR"]),
  metadata: z.record(z.unknown()).default({})
});
export type ApplicationAuditEvent = z.infer<
  typeof applicationAuditEventSchema
>;
