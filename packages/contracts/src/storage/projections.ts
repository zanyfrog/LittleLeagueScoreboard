import { z } from "zod";
import {
  baseStateSchema,
  defensiveAlignmentSchema,
  replayFrameSchema
} from "../baseball/index.js";

export const gameProjectionsSchema = z.object({
  gameId: z.string().min(1),
  eventVersion: z.number().int().nonnegative(),
  baseState: baseStateSchema,
  alignments: z.array(defensiveAlignmentSchema),
  replayFrames: z.array(replayFrameSchema),
  updatedAtUtc: z.string().datetime()
});
export type GameProjections = z.infer<typeof gameProjectionsSchema>;

export const emptyBaseState = {
  first: null,
  second: null,
  third: null
} as const;
