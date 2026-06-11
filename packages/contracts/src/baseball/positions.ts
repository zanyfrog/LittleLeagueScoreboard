import { z } from "zod";

export const playerPositionSchema = z.enum([
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "LCF",
  "RCF",
  "BENCH",
  "BULLPEN",
  "UNKNOWN"
]);
export type PlayerPosition = z.infer<typeof playerPositionSchema>;

export const fieldPositions = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "LCF",
  "RCF"
] as const satisfies readonly PlayerPosition[];

export type FieldPosition = (typeof fieldPositions)[number];

export const nonFieldPositions = [
  "BENCH",
  "BULLPEN",
  "UNKNOWN"
] as const satisfies readonly PlayerPosition[];

const fieldPositionSet = new Set<PlayerPosition>(fieldPositions);

export function isFieldPosition(
  position: PlayerPosition
): position is FieldPosition {
  return fieldPositionSet.has(position);
}

export const playerPositionLabels: Readonly<Record<PlayerPosition, string>> = {
  P: "Pitcher",
  C: "Catcher",
  "1B": "First Base",
  "2B": "Second Base",
  "3B": "Third Base",
  SS: "Shortstop",
  LF: "Left Field",
  CF: "Center Field",
  RF: "Right Field",
  LCF: "Left Center Field",
  RCF: "Right Center Field",
  BENCH: "Bench",
  BULLPEN: "Bullpen",
  UNKNOWN: "Unknown"
};
