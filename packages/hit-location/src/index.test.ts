import { describe, expect, it } from "vitest";
import { describeHitLocation } from "./index.js";

describe("describeHitLocation", () => {
  it("labels deep center field", () => {
    expect(describeHitLocation(0.5, 0.15).area).toBe("Deep Center");
  });
});
