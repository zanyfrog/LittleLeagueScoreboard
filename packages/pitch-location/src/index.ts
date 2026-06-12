export interface PitchLocation {
  x: number;
  y: number;
  zone: string;
  isInStrikeZone: boolean;
}

export function describePitchLocation(x: number, y: number): PitchLocation {
  const normalizedX = Math.max(0, Math.min(1, x));
  const normalizedY = Math.max(0, Math.min(1, y));
  const inZone =
    normalizedX >= 0.25 &&
    normalizedX <= 0.75 &&
    normalizedY >= 0.2 &&
    normalizedY <= 0.8;
  const horizontal =
    normalizedX < 0.25 ? "Inside" : normalizedX > 0.75 ? "Outside" : "Middle";
  const vertical =
    normalizedY < 0.2 ? "High" : normalizedY > 0.8 ? "Low" : "";
  return {
    x: normalizedX,
    y: normalizedY,
    zone: [vertical, horizontal].filter(Boolean).join(" ") || "Middle",
    isInStrikeZone: inZone
  };
}
