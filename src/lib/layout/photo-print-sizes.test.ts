import { describe, expect, it } from "vitest";
import { millimetersToPoints } from "./units";
import { getPhotoPrintSize, photoPrintSizeToPoints } from "./photo-print-sizes";

describe("usual photo print sizes", () => {
  it("keeps CR80 at its exact ID-1 dimensions", () => {
    const landscape = photoPrintSizeToPoints("cr80", "landscape");
    expect(landscape.width).toBeCloseTo(millimetersToPoints(85.6), 10);
    expect(landscape.height).toBeCloseTo(millimetersToPoints(53.98), 10);
  });

  it("defines the common A4-compatible R sizes exactly in inches", () => {
    expect(photoPrintSizeToPoints("2r", "portrait")).toEqual({ width: 180, height: 252 });
    expect(photoPrintSizeToPoints("6r", "portrait")).toEqual({ width: 432, height: 576 });
    expect(photoPrintSizeToPoints("8r", "portrait")).toEqual({ width: 576, height: 720 });
  });

  it("uses the shop names while keeping wallet ID, cute, and 2R distinct", () => {
    expect(getPhotoPrintSize("cr80")).toMatchObject({ label: "CR80 / Wallet ID", width: 53.98, height: 85.6, unit: "mm" });
    expect(getPhotoPrintSize("cute")).toMatchObject({ label: "Cute Size", width: 2, height: 3, unit: "in" });
    expect(getPhotoPrintSize("2r")).toMatchObject({ label: "2R Photo", width: 2.5, height: 3.5, unit: "in" });
  });
});
