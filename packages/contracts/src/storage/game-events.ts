import { z } from "zod";
import {
  defensivePositionChangeSchema,
  runnerMovementSchema
} from "../baseball/replay-frame.js";

export const gameEventTypeSchema = z.enum([
  "GameStarted",
  "HalfInningStarted",
  "PlateAppearanceStarted",
  "PitchRecorded",
  "BallPutInPlay",
  "FieldingActionRecorded",
  "RunnerMoved",
  "RunnerOut",
  "RunScored",
  "DefensivePositionChanged",
  "PitcherChanged",
  "EventReversed",
  "EventCorrected",
  "GameFinalized"
]);
export type GameEventType = z.infer<typeof gameEventTypeSchema>;

export const gameEventSchema = z.object({
  eventId: z.string().min(1),
  gameId: z.string().min(1),
  eventOrder: z.number().int().positive(),
  eventTimeUtc: z.string().datetime(),
  loggedAtUtc: z.string().datetime(),
  eventType: gameEventTypeSchema,
  actorId: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  positionChanges: z.array(defensivePositionChangeSchema).default([]),
  runnerMovements: z.array(runnerMovementSchema).default([]),
  reversesEventId: z.string().min(1).optional(),
  correctsEventId: z.string().min(1).optional(),
  correctionNote: z.string().min(1).optional()
});
export type GameEvent = z.infer<typeof gameEventSchema>;
