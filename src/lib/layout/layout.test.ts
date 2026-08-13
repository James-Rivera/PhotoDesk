import { describe, expect, it } from "vitest";
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS, CJNET_NORMAL_EDGE_MARGIN_POINTS, ONE_BY_ONE_POINTS, TWO_BY_TWO_POINTS } from "./constants";
import { arrangeOnPage } from "./engine";
import { createCjnetNormalRequest, createCustomRequest, createFixedSquareRequest, createPassportRequest } from "./presets";
import { inchesToPoints, millimetersToPoints } from "./units";

describe("physical unit conversion", () => {
  it("converts inches to PDF points", () => expect(inchesToPoints(1)).toBe(72));
  it("converts millimeters to PDF points", () => expect(millimetersToPoints(25.4)).toBeCloseTo(72, 10));
  it("uses exact required A4 dimensions", () => {
    expect(A4_WIDTH_POINTS).toBe(595.28);
    expect(A4_HEIGHT_POINTS).toBe(841.89);
  });
  it("uses exact 2x2 and 1x1 dimensions", () => {
    expect(TWO_BY_TWO_POINTS).toBe(144);
    expect(ONE_BY_ONE_POINTS).toBe(72);
  });
});

describe("layout engine", () => {
  it("places CJNET Normal as four 2x2 above six 1x1", () => {
    const result = arrangeOnPage(createCjnetNormalRequest());
    expect(result.fits).toBe(true);
    expect(result.placed).toHaveLength(10);
    expect(result.placed.slice(0, 4).map((item) => item.row)).toEqual([0, 0, 0, 0]);
    expect(result.placed.slice(4).map((item) => item.row)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(result.placed[4].y).toBeGreaterThan(result.placed[0].y);
    expect(result.placed[0]).toMatchObject({ x: CJNET_NORMAL_EDGE_MARGIN_POINTS, y: CJNET_NORMAL_EDGE_MARGIN_POINTS });
    expect(result.placed[3].x + result.placed[3].width + CJNET_NORMAL_EDGE_MARGIN_POINTS).toBeCloseTo(A4_WIDTH_POINTS, 10);
    expect(CJNET_NORMAL_EDGE_MARGIN_POINTS).toBeCloseTo(millimetersToPoints(3.4), 1);
  });

  it("reports copies that overflow rather than shrinking them", () => {
    const result = arrangeOnPage(createFixedSquareRequest("2x2", 30));
    expect(result.fits).toBe(false);
    expect(result.overflow.length).toBeGreaterThan(0);
    expect(result.placed.every((item) => item.width === 144 && item.height === 144)).toBe(true);
  });

  it("honors margins and spacing", () => {
    const request = createCustomRequest({ width: 1, height: 1, unit: "in", quantity: 2, spacing: 0.25, margin: 0.5 });
    const result = arrangeOnPage(request);
    expect(result.placed[0]).toMatchObject({ x: 36, y: 36 });
    expect(result.placed[1].x).toBe(36 + 72 + 18);
    expect(result.content.width).toBeCloseTo(A4_WIDTH_POINTS - 72, 10);
  });

  it("uses the CJNET printer-safe margin for Passport cutting guides", () => {
    const request = createPassportRequest(35, 45, 5);
    const result = arrangeOnPage(request);
    const safeMargin = CJNET_NORMAL_EDGE_MARGIN_POINTS;
    expect(request.margins).toEqual({ top: safeMargin, right: safeMargin, bottom: safeMargin, left: safeMargin });
    expect(result.placed[0]).toMatchObject({ x: safeMargin, y: safeMargin });
    expect(result.placed.every((item) => item.x >= safeMargin && item.y >= safeMargin)).toBe(true);
  });
});
