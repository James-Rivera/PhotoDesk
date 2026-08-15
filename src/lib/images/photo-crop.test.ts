import { describe, expect, it } from "vitest";
import { centeredPhotoCropForAspect, DEFAULT_PHOTO_CROP, isPhotoCropped, normalizePhotoCrop, photoCropToPixels } from "./photo-crop";

describe("photo crop", () => {
  it("normalizes a crop inside the source image", () => {
    expect(normalizePhotoCrop({ x: 0.9, y: -0.2, width: 0.4, height: 1.4 })).toEqual({ x: 0.6, y: 0, width: 0.4, height: 1 });
  });

  it("converts normalized crop values to bounded source pixels", () => {
    expect(photoCropToPixels({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 }, 1200, 800)).toEqual({ x: 300, y: 80, width: 600, height: 640 });
  });

  it("centres square and portrait crops without stretching", () => {
    const square = centeredPhotoCropForAspect(1200, 800, 1);
    expect(square.x).toBeCloseTo(1 / 6);
    expect(square).toMatchObject({ y: 0, width: 2 / 3, height: 1 });
    const passport = centeredPhotoCropForAspect(800, 1200, 35 / 45);
    expect(passport.y).toBeCloseTo(1 / 14);
    expect(passport).toMatchObject({ x: 0, width: 1, height: 6 / 7 });
  });

  it("recognizes the unchanged full-image crop", () => {
    expect(isPhotoCropped(DEFAULT_PHOTO_CROP)).toBe(false);
    expect(isPhotoCropped({ x: 0, y: 0, width: 0.9, height: 1 })).toBe(true);
  });
});
