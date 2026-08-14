import { describe, expect, it } from "vitest";
import { A4_PAGE, CJNET_NORMAL_EDGE_MARGIN_POINTS, ONE_BY_ONE_POINTS, PASSPORT_EDGE_MARGIN_POINTS } from "./constants";
import { arrangeCustomerMixedShelves, arrangeMixedShelves, maximumSmallCopies, smallCopiesBesideBigRows } from "./mixed-shelf";
import { millimetersToPoints } from "./units";

const request = {
  page: A4_PAGE,
  margins: { top: PASSPORT_EDGE_MARGIN_POINTS, right: PASSPORT_EDGE_MARGIN_POINTS, bottom: PASSPORT_EDGE_MARGIN_POINTS, left: PASSPORT_EDGE_MARGIN_POINTS },
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
    expect(firstPassport).toMatchObject({ x: PASSPORT_EDGE_MARGIN_POINTS, y: PASSPORT_EDGE_MARGIN_POINTS });
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
      margins: { top: CJNET_NORMAL_EDGE_MARGIN_POINTS, right: CJNET_NORMAL_EDGE_MARGIN_POINTS, bottom: CJNET_NORMAL_EDGE_MARGIN_POINTS, left: CJNET_NORMAL_EDGE_MARGIN_POINTS },
      big: { width: 144, height: 144 },
      bigQuantity: 5,
    };
    expect(smallCopiesBesideBigRows(twoByTwoRequest)).toBe(12);
    const layout = arrangeMixedShelves({ ...twoByTwoRequest, smallQuantity: 6 });
    const fifthBig = layout.placed.filter((item) => item.sourceKey === "big")[4];
    const smallItems = layout.placed.filter((item) => item.sourceKey === "small");
    expect(smallItems).toHaveLength(6);
    expect(layout.placed[0].x).toBe(CJNET_NORMAL_EDGE_MARGIN_POINTS);
    expect(smallItems.every((item) => item.row === fifthBig.row)).toBe(true);
    expect(smallItems.every((item) => item.x >= fifthBig.x + fifthBig.width)).toBe(true);
  });

  it("keeps two customers mapped to their own large and small photo sources", () => {
    const layout = arrangeCustomerMixedShelves({
      ...request,
      customers: [
        { sourcePrefix: "customer-a", bigQuantity: 5, smallQuantity: 6 },
        { sourcePrefix: "customer-b", bigQuantity: 5, smallQuantity: 6 },
      ],
    });

    expect(layout.fits).toBe(true);
    expect(layout.placed.filter((item) => item.sourceKey === "customer-a-big")).toHaveLength(5);
    expect(layout.placed.filter((item) => item.sourceKey === "customer-b-big")).toHaveLength(5);
    expect(layout.placed.filter((item) => item.sourceKey === "customer-a-small")).toHaveLength(6);
    expect(layout.placed.filter((item) => item.sourceKey === "customer-b-small")).toHaveLength(6);
    expect(layout.placed.filter((item) => item.sourceKey.endsWith("-big")).every((item) => item.width === millimetersToPoints(35) && item.height === millimetersToPoints(45))).toBe(true);
    expect(layout.placed.filter((item) => item.sourceKey.endsWith("-small")).every((item) => item.width === ONE_BY_ONE_POINTS && item.height === ONE_BY_ONE_POINTS)).toBe(true);
  });

  it("reports overflow against the customer whose copies do not fit", () => {
    const layout = arrangeCustomerMixedShelves({
      ...request,
      customers: [
        { sourcePrefix: "customer-a", bigQuantity: 5, smallQuantity: 0 },
        { sourcePrefix: "customer-b", bigQuantity: 40, smallQuantity: 0 },
      ],
    });

    expect(layout.fits).toBe(false);
    expect(layout.overflow.length).toBeGreaterThan(0);
    expect(layout.overflow.every((item) => item.sourceKey === "customer-b-big")).toBe(true);
  });
});
