export interface HitLocation {
  x: number;
  y: number;
  area: string;
}

export function describeHitLocation(x: number, y: number): HitLocation {
  const normalizedX = Math.max(0, Math.min(1, x));
  const normalizedY = Math.max(0, Math.min(1, y));
  const depth =
    normalizedY < 0.35
      ? "Deep"
      : normalizedY < 0.68
        ? "Outfield"
        : "Infield";
  const side =
    normalizedX < 0.34 ? "Left" : normalizedX > 0.66 ? "Right" : "Center";
  return {
    x: normalizedX,
    y: normalizedY,
    area: `${depth} ${side}`
  };
}
