import { describe, expect, it } from "vitest";
import {
  defensiveAlignmentSchema,
  isFieldPosition,
  playerPositionSchema
} from "./index.js";

describe("player positions", () => {
  it("includes bench and bullpen as non-field assignments", () => {
    expect(playerPositionSchema.parse("BENCH")).toBe("BENCH");
    expect(playerPositionSchema.parse("BULLPEN")).toBe("BULLPEN");
    expect(isFieldPosition("BENCH")).toBe(false);
    expect(isFieldPosition("BULLPEN")).toBe(false);
  });

  it("allows multiple bench and bullpen players", () => {
    expect(() =>
      defensiveAlignmentSchema.parse({
        teamId: "team-a",
        assignments: [
          {
            teamId: "team-a",
            playerId: "p1",
            displayLabel: "#1 Alex",
            position: "BENCH"
          },
          {
            teamId: "team-a",
            playerId: "p2",
            displayLabel: "#2 Sam",
            position: "BENCH"
          },
          {
            teamId: "team-a",
            playerId: "p3",
            displayLabel: "#3 Lee",
            position: "BULLPEN"
          },
          {
            teamId: "team-a",
            playerId: "p4",
            displayLabel: "#4 Drew",
            position: "BULLPEN"
          }
        ]
      })
    ).not.toThrow();
  });

  it("rejects duplicate field assignments", () => {
    expect(() =>
      defensiveAlignmentSchema.parse({
        teamId: "team-a",
        assignments: [
          {
            teamId: "team-a",
            playerId: "p1",
            displayLabel: "#1 Alex",
            position: "P"
          },
          {
            teamId: "team-a",
            playerId: "p2",
            displayLabel: "#2 Sam",
            position: "P"
          }
        ]
      })
    ).toThrow();
  });
});
