import { A4_PAGE, CJNET_NORMAL_EDGE_MARGIN_POINTS, ONE_BY_ONE_POINTS, PASSPORT_EDGE_MARGIN_POINTS, TWO_BY_TWO_POINTS } from "./constants";
import type { LayoutItem, LayoutRequest } from "./types";
import { millimetersToPoints, toPoints, type PhysicalUnit } from "./units";

export type PresetId = "cjnet-normal" | "2x2-pair" | "2x2-only" | "1x1-only" | "passport" | "custom";

export interface PresetDefinition {
  id: PresetId;
  name: string;
  description: string;
  defaultBorder: boolean;
}

export const PRESETS: PresetDefinition[] = [
  { id: "cjnet-normal", name: "CJNET Normal", description: "4 copies of 2×2, then 6 copies of 1×1", defaultBorder: true },
  { id: "2x2-pair", name: "2×2 Pair", description: "2 copies of 2×2", defaultBorder: true },
  { id: "2x2-only", name: "2×2 Only", description: "Adjustable 2×2 quantity", defaultBorder: true },
  { id: "1x1-only", name: "1×1 Only", description: "Adjustable 1×1 quantity", defaultBorder: true },
  { id: "passport", name: "Passport", description: "Configurable width and height in millimeters", defaultBorder: true },
  { id: "custom", name: "Custom", description: "Custom size, quantity, spacing, and margins", defaultBorder: true },
];

const repeat = (count: number, size: number, sourceKey = "primary", rowBreakAtStart = false): LayoutItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${sourceKey}-${size}-${index}`,
    sourceKey,
    width: size,
    height: size,
    rowBreakBefore: rowBreakAtStart && index === 0,
  }));

const baseRequest = (items: LayoutItem[], spacing = 0, margin = millimetersToPoints(2)): LayoutRequest => ({
  page: A4_PAGE,
  margins: { top: margin, right: margin, bottom: margin, left: margin },
  horizontalSpacing: spacing,
  verticalSpacing: spacing,
  items,
});

export function createCjnetNormalRequest(): LayoutRequest {
  return createMixedSquareRequest(4, 6);
}

export function createMixedSquareRequest(bigQuantity: number, smallQuantity: number): LayoutRequest {
  return baseRequest(
    [
      ...repeat(bigQuantity, TWO_BY_TWO_POINTS, "big"),
      ...repeat(smallQuantity, ONE_BY_ONE_POINTS, "small", true),
    ],
    0,
    CJNET_NORMAL_EDGE_MARGIN_POINTS,
  );
}

export function createFixedSquareRequest(size: "1x1" | "2x2", quantity: number): LayoutRequest {
  const points = size === "1x1" ? ONE_BY_ONE_POINTS : TWO_BY_TWO_POINTS;
  return baseRequest(repeat(quantity, points, size === "1x1" ? "small" : "big"));
}

export function createPassportRequest(widthMm: number, heightMm: number, quantity: number): LayoutRequest {
  const width = millimetersToPoints(widthMm);
  const height = millimetersToPoints(heightMm);
  return baseRequest(
    Array.from({ length: quantity }, (_, index) => ({ id: `passport-${index}`, sourceKey: "big", width, height })),
    millimetersToPoints(2),
    PASSPORT_EDGE_MARGIN_POINTS,
  );
}

export interface CustomPresetInput {
  width: number;
  height: number;
  unit: PhysicalUnit;
  quantity: number;
  spacing: number;
  margin: number;
}

export function createCustomRequest(input: CustomPresetInput): LayoutRequest {
  const width = toPoints(input.width, input.unit);
  const height = toPoints(input.height, input.unit);
  const spacing = toPoints(input.spacing, input.unit);
  const margin = toPoints(input.margin, input.unit);
  const items = Array.from({ length: input.quantity }, (_, index) => ({
    id: `custom-${index}`,
    sourceKey: "primary",
    width,
    height,
  }));
  return baseRequest(items, spacing, margin);
}
