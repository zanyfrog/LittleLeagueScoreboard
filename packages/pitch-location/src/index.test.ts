import { describe, expect, it } from "vitest";
import { describePitchLocation } from "./index.js";

describe("describePitchLocation", () => {
  it("identifies a pitch in the strike zone", () => {
    expect(describePitchLocation(0.5, 0.5)).toMatchObject({
      zone: "Middle",
      isInStrikeZone: true
    });
  });

  it("labels a high outside pitch", () => {
    expect(describePitchLocation(0.9, 0.1)).toMatchObject({
      zone: "High Outside",
      isInStrikeZone: false
    });
  });
});
