export const POINTS_PER_INCH = 72;
export const MILLIMETERS_PER_INCH = 25.4;

export type PhysicalUnit = "in" | "mm" | "cm";

export function inchesToPoints(inches: number): number {
  return inches * POINTS_PER_INCH;
}

export function millimetersToPoints(millimeters: number): number {
  return (millimeters * POINTS_PER_INCH) / MILLIMETERS_PER_INCH;
}

export function centimetersToPoints(centimeters: number): number {
  return millimetersToPoints(centimeters * 10);
}

export function toPoints(value: number, unit: PhysicalUnit): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Physical measurements must be finite and non-negative.");
  }

  switch (unit) {
    case "in":
      return inchesToPoints(value);
    case "mm":
      return millimetersToPoints(value);
    case "cm":
      return centimetersToPoints(value);
  }
}
