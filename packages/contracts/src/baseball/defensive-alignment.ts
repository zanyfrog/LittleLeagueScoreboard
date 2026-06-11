import { z } from "zod";
import {
  isFieldPosition,
  playerPositionSchema,
  type PlayerPosition
} from "./positions.js";

export const playerAssignmentSchema = z.object({
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  displayLabel: z.string().min(1),
  position: playerPositionSchema
});
export type PlayerAssignment = z.infer<typeof playerAssignmentSchema>;

export const defensiveAlignmentSchema = z
  .object({
    teamId: z.string().min(1),
    assignments: z.array(playerAssignmentSchema)
  })
  .superRefine((alignment, context) => {
    const occupied = new Map<PlayerPosition, string>();
    const assignedPlayers = new Set<string>();

    for (const assignment of alignment.assignments) {
      if (assignment.teamId !== alignment.teamId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Every assignment must belong to the alignment team"
        });
      }
      if (assignedPlayers.has(assignment.playerId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Player ${assignment.playerId} has more than one assignment`
        });
      }
      assignedPlayers.add(assignment.playerId);

      if (!isFieldPosition(assignment.position)) continue;
      const existingPlayer = occupied.get(assignment.position);
      if (existingPlayer) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${assignment.position} is assigned to both ${existingPlayer} and ${assignment.playerId}`
        });
      }
      occupied.set(assignment.position, assignment.playerId);
    }
  });
export type DefensiveAlignment = z.infer<typeof defensiveAlignmentSchema>;

export function assignPlayerPosition(
  alignment: DefensiveAlignment,
  assignment: PlayerAssignment
): DefensiveAlignment {
  const assignments = alignment.assignments.filter(
    (item) => item.playerId !== assignment.playerId
  );
  assignments.push(assignment);
  return defensiveAlignmentSchema.parse({
    teamId: alignment.teamId,
    assignments
  });
}
