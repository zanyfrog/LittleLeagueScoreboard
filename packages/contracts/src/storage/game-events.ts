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
  "ScorekeeperCommentRecorded",
  "BallPutInPlay",
  "FieldingActionRecorded",
  "RunnerMoved",
  "RunnerOut",
  "OutCountAdjusted",
  "RunScored",
  "DefensivePositionChanged",
  "PitcherChanged",
  "EventReversed",
  "EventCorrected",
  "GameFinalized"
]);
export type GameEventType = z.infer<typeof gameEventTypeSchema>;

export const replayMediaAttachmentSchema = z.object({
  mediaId: z.string().min(1),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  url: z.string().min(1),
  capturedAtUtc: z.string().datetime(),
  uploadedAtUtc: z.string().datetime(),
  caption: z.string().optional()
});
export type ReplayMediaAttachment = z.infer<
  typeof replayMediaAttachmentSchema
>;

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
  mediaAttachments: z.array(replayMediaAttachmentSchema).optional(),
  reversesEventId: z.string().min(1).optional(),
  correctsEventId: z.string().min(1).optional(),
  correctionNote: z.string().min(1).optional()
});
export type GameEvent = z.infer<typeof gameEventSchema>;
