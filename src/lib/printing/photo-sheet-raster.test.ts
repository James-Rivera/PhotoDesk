import { describe, expect, it } from "vitest";
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS, centimetersToPoints, millimetersToPoints } from "@/lib/layout";
import {
  NATIVE_PRINT_HEIGHT_PIXELS,
  NATIVE_PRINT_WIDTH_PIXELS,
  pointRectangleToRaster,
  pointsToPixels,
} from "@/lib/printing/photo-sheet-raster";

describe("native print raster math", () => {
  it("creates the standard 300 DPI A4 raster", () => {
    expect(pointsToPixels(A4_WIDTH_POINTS)).toBe(2480);
    expect(pointsToPixels(A4_HEIGHT_POINTS)).toBe(3508);
    expect(NATIVE_PRINT_WIDTH_PIXELS).toBe(2480);
    expect(NATIVE_PRINT_HEIGHT_PIXELS).toBe(3508);
  });

  it("keeps inch-based photos exact at 300 DPI", () => {
    expect(pointsToPixels(72)).toBe(300);
    expect(pointsToPixels(144)).toBe(600);
    expect(pointRectangleToRaster({ x: 0, y: 0, width: 144, height: 144 })).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 600,
    });
  });

  it("rounds rectangle edges together instead of independently rounding size", () => {
    const first = pointRectangleToRaster({ x: millimetersToPoints(3.4), y: 0, width: centimetersToPoints(5), height: centimetersToPoints(5) });
    const second = pointRectangleToRaster({ x: millimetersToPoints(53.4), y: 0, width: centimetersToPoints(5), height: centimetersToPoints(5) });
    expect(first.x + first.width).toBe(second.x);
  });
});
