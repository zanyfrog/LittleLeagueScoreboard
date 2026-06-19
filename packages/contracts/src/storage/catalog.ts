import { z } from "zod";
import { playerPositionSchema } from "../baseball/positions.js";

const utcAuditFields = {
  createdAtUtc: z.string().datetime(),
  updatedAtUtc: z.string().datetime().optional()
};

export const personSchema = z.object({
  personId: z.string().min(1),
  displayName: z.string().min(1),
  ...utcAuditFields
});
export type Person = z.infer<typeof personSchema>;

export const playerProfileSchema = z.object({
  playerId: z.string().min(1),
  personId: z.string().min(1),
  bats: z.enum(["LEFT", "RIGHT", "SWITCH", "UNKNOWN"]).default("RIGHT"),
  throws: z.enum(["LEFT", "RIGHT", "UNKNOWN"]).default("RIGHT"),
  primaryPosition: playerPositionSchema.optional(),
  ...utcAuditFields
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const organizationSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  ...utcAuditFields
});
export type Organization = z.infer<typeof organizationSchema>;

export const seasonSchema = z.object({
  seasonId: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  ...utcAuditFields
});
export type Season = z.infer<typeof seasonSchema>;

export const teamSchema = z.object({
  teamId: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  ...utcAuditFields
});
export type Team = z.infer<typeof teamSchema>;

export const membershipSchema = z.object({
  membershipId: z.string().min(1),
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  seasonId: z.string().min(1),
  membershipType: z.enum(["REGULAR", "GUEST", "TOURNAMENT", "TEMPORARY"]),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  jerseyNumber: z.string().min(1).optional(),
  primaryPosition: playerPositionSchema.optional(),
  joinedOn: z.string().date(),
  leftOn: z.string().date().optional(),
  ...utcAuditFields
});
export type Membership = z.infer<typeof membershipSchema>;

export const gameSchema = z.object({
  gameId: z.string().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  timezoneName: z.string().min(1),
  scheduledStartUtc: z.string().datetime().optional(),
  locationName: z.string().min(1).optional(),
  expectedInnings: z.number().int().positive().default(6),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "SUSPENDED", "FINAL"]),
  ...utcAuditFields
});
export type Game = z.infer<typeof gameSchema>;

export const gameRosterEntrySchema = z.object({
  gameId: z.string().min(1),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  membershipId: z.string().min(1).optional(),
  displayNameSnapshot: z.string().min(1),
  jerseyNumberSnapshot: z.string().min(1).optional(),
  teamNameSnapshot: z.string().min(1),
  battingOrder: z.number().int().positive().optional(),
  initialPosition: playerPositionSchema.default("UNKNOWN"),
  isPresent: z.boolean().default(true)
});
export type GameRosterEntry = z.infer<typeof gameRosterEntrySchema>;
