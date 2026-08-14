import { describe, expect, it } from "vitest";
import { A4_PAGE, CJNET_NORMAL_EDGE_MARGIN_POINTS } from "./constants";
import { arrangePhotoPrints } from "./photo-print-packer";
import { inchesToPoints } from "./units";

const margins = {
  top: CJNET_NORMAL_EDGE_MARGIN_POINTS,
  right: CJNET_NORMAL_EDGE_MARGIN_POINTS,
  bottom: CJNET_NORMAL_EDGE_MARGIN_POINTS,
  left: CJNET_NORMAL_EDGE_MARGIN_POINTS,
};

function copies(sourceKey: string, width: number, height: number, quantity: number) {
  return Array.from({ length: quantity }, (_, index) => ({
    id: `${sourceKey}-${index}`,
    sourceKey,
    width: inchesToPoints(width),
    height: inchesToPoints(height),
  }));
}

describe("mixed photo print packing", () => {
  it("fits four 3R photos on one printer-safe A4 sheet", () => {
    const result = arrangePhotoPrints({ page: A4_PAGE, margins, horizontalSpacing: 0, verticalSpacing: 0, items: copies("3r", 3.5, 5, 4) });
    expect(result.fits).toBe(true);
    expect(result.placed).toHaveLength(4);
    expect(result.placed.map((item) => item.row)).toEqual([0, 0, 1, 1]);
  });

  it("fits two portrait 4R photos exactly across the safe content width", () => {
    const result = arrangePhotoPrints({ page: A4_PAGE, margins, horizontalSpacing: 0, verticalSpacing: 0, items: copies("4r", 4, 6, 2) });
    expect(result.fits).toBe(true);
    expect(result.placed[1].x + result.placed[1].width + margins.right).toBeCloseTo(A4_PAGE.width, 10);
  });

  it("reports 5R overflow without shrinking any photo", () => {
    const result = arrangePhotoPrints({ page: A4_PAGE, margins, horizontalSpacing: 0, verticalSpacing: 0, items: copies("5r", 5, 7, 2) });
    expect(result.fits).toBe(false);
    expect(result.placed).toHaveLength(1);
    expect(result.overflow).toHaveLength(1);
    expect(result.placed[0]).toMatchObject({ width: 360, height: 504 });
  });

  it("sorts larger photos first while keeping stable source order for ties", () => {
    const items = [
      ...copies("small-a", 1, 1, 1),
      ...copies("large", 5, 7, 1),
      ...copies("small-b", 1, 1, 1),
    ];
    const result = arrangePhotoPrints({ page: A4_PAGE, margins, horizontalSpacing: 0, verticalSpacing: 0, items });
    expect(result.placed.map((item) => item.sourceKey)).toEqual(["large", "small-a", "small-b"]);
    expect(result.placed.every((item) => item.width === items.find((source) => source.sourceKey === item.sourceKey)?.width)).toBe(true);
  });
});
