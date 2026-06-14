import { describe, expect, it } from "vitest";
import { membershipSchema, playerProfileSchema } from "./catalog.js";

describe("playerProfileSchema", () => {
  it("defaults batting stance and throwing arm to right", () => {
    const profile = playerProfileSchema.parse({
      playerId: "player-1",
      personId: "person-1",
      createdAtUtc: "2026-06-12T12:00:00.000Z"
    });
    expect(profile.bats).toBe("RIGHT");
    expect(profile.throws).toBe("RIGHT");
  });
});

describe("membershipSchema", () => {
  it("allows players on the same team to share a jersey number", () => {
    const common = {
      teamId: "team-1",
      seasonId: "season-1",
      membershipType: "REGULAR" as const,
      status: "ACTIVE" as const,
      joinedOn: "2026-06-13",
      createdAtUtc: "2026-06-13T12:00:00.000Z",
      jerseyNumber: "7"
    };

    const first = membershipSchema.parse({
      ...common,
      membershipId: "membership-1",
      playerId: "player-1"
    });
    const second = membershipSchema.parse({
      ...common,
      membershipId: "membership-2",
      playerId: "player-2"
    });

    expect(first.jerseyNumber).toBe(second.jerseyNumber);
    expect(first.playerId).not.toBe(second.playerId);
  });
});
