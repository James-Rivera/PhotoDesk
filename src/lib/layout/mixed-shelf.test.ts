import { describe, expect, it } from "vitest";
import { A4_PAGE, ONE_BY_ONE_POINTS } from "./constants";
import { arrangeMixedShelves, maximumSmallCopies, smallCopiesBesideBigRows } from "./mixed-shelf";
import { millimetersToPoints } from "./units";

const request = {
  page: A4_PAGE,
  margins: { top: millimetersToPoints(2), right: millimetersToPoints(2), bottom: millimetersToPoints(2), left: millimetersToPoints(2) },
  big: { width: millimetersToPoints(35), height: millimetersToPoints(45) },
  small: { width: ONE_BY_ONE_POINTS, height: ONE_BY_ONE_POINTS },
  bigQuantity: 5,
};

describe("mixed Passport and 1x1 shelf packing", () => {
  it("fills the unused width beside a partial Passport row first", () => {
    const layout = arrangeMixedShelves({ ...request, smallQuantity: 4 });
    const firstSmall = layout.placed.find((item) => item.sourceKey === "small");
    const firstPassport = layout.placed.find((item) => item.sourceKey === "big");
    expect(layout.fits).toBe(true);
    expect(firstSmall?.row).toBe(firstPassport?.row);
    expect(firstSmall?.y).toBe(firstPassport?.y);
    expect(firstSmall?.x).toBeGreaterThan(firstPassport?.x ?? 0);
  });

  it("calculates the maximum usable 1x1 capacity", () => {
    const maximum = maximumSmallCopies(request);
    expect(maximum).toBeGreaterThan(20);
    expect(arrangeMixedShelves({ ...request, smallQuantity: maximum }).fits).toBe(true);
    expect(arrangeMixedShelves({ ...request, smallQuantity: maximum + 1 }).fits).toBe(false);
  });

  it("calculates 1x1 capacity beside a fifth 2x2 photo", () => {
    const twoByTwoRequest = {
      ...request,
      big: { width: 144, height: 144 },
      bigQuantity: 5,
    };
    expect(smallCopiesBesideBigRows(twoByTwoRequest)).toBe(12);
    const layout = arrangeMixedShelves({ ...twoByTwoRequest, smallQuantity: 6 });
    const fifthBig = layout.placed.filter((item) => item.sourceKey === "big")[4];
    const smallItems = layout.placed.filter((item) => item.sourceKey === "small");
    expect(smallItems).toHaveLength(6);
    expect(smallItems.every((item) => item.row === fifthBig.row)).toBe(true);
    expect(smallItems.every((item) => item.x >= fifthBig.x + fifthBig.width)).toBe(true);
  });
});
