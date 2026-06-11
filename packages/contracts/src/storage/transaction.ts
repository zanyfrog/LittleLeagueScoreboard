import { z } from "zod";

export const storageTransactionBaseSchema = z.object({
  transactionId: z.string().uuid(),
  streamId: z.string().min(1),
  streamVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  occurredAtUtc: z.string().datetime(),
  actorId: z.string().min(1),
  operation: z.string().min(1),
  previousChecksum: z.string().nullable(),
  checksum: z.string().min(1)
});

export interface StorageTransaction<T> {
  transactionId: string;
  streamId: string;
  streamVersion: number;
  schemaVersion: number;
  occurredAtUtc: string;
  actorId: string;
  operation: string;
  payload: T;
  previousChecksum: string | null;
  checksum: string;
}

export function storageTransactionSchema<T extends z.ZodTypeAny>(
  payloadSchema: T
) {
  return storageTransactionBaseSchema.extend({
    payload: payloadSchema
  });
}
