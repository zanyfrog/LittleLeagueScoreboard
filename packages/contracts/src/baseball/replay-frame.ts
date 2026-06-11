import { z } from "zod";
import {
  defensiveAlignmentSchema,
  type DefensiveAlignment
} from "./defensive-alignment.js";
import { playerPositionSchema } from "./positions.js";

export const baseLocationSchema = z.enum([
  "BATTER",
  "FIRST",
  "SECOND",
  "THIRD",
  "HOME",
  "OUT"
]);
export type BaseLocation = z.infer<typeof baseLocationSchema>;

export const runnerOnBaseSchema = z.object({
  runnerId: z.string().min(1),
  displayLabel: z.string().min(1)
});
export type RunnerOnBase = z.infer<typeof runnerOnBaseSchema>;

export const baseStateSchema = z.object({
  first: runnerOnBaseSchema.nullable(),
  second: runnerOnBaseSchema.nullable(),
  third: runnerOnBaseSchema.nullable()
});
export type BaseState = z.infer<typeof baseStateSchema>;

export const runnerMovementSchema = z.object({
  runnerId: z.string().min(1),
  from: baseLocationSchema,
  to: baseLocationSchema,
  outcome: z.enum(["SAFE", "OUT"]),
  reason: z.string().min(1)
});
export type RunnerMovement = z.infer<typeof runnerMovementSchema>;

export const defensivePositionChangeSchema = z.object({
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  displayLabel: z.string().min(1),
  fromPosition: playerPositionSchema,
  toPosition: playerPositionSchema,
  reason: z.string().min(1).optional()
});
export type DefensivePositionChange = z.infer<
  typeof defensivePositionChangeSchema
>;

export const replayFrameSchema = z.object({
  eventId: z.string().min(1),
  eventOrder: z.number().int().nonnegative(),
  baseStateBefore: baseStateSchema,
  baseStateAfter: baseStateSchema,
  alignmentsBefore: z.array(defensiveAlignmentSchema),
  alignmentsAfter: z.array(defensiveAlignmentSchema),
  positionChanges: z.array(defensivePositionChangeSchema),
  movements: z.array(runnerMovementSchema)
});
export type ReplayFrame = z.infer<typeof replayFrameSchema>;

export type AlignmentByTeam = ReadonlyMap<string, DefensiveAlignment>;
