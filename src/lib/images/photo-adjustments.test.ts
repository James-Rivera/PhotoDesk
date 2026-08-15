import { describe, expect, it } from "vitest";
import { applyPhotoAdjustmentsPixels, computeAutoLevels, computePhotoHistogram, DEFAULT_PHOTO_ADJUSTMENTS } from "./photo-adjustments";

describe("photo adjustments", () => {
  it("leaves pixels unchanged at neutral settings", () => {
    const pixels = new Uint8ClampedArray([12, 90, 220, 255, 40, 50, 60, 0]);
    applyPhotoAdjustmentsPixels(pixels, 2, 1, DEFAULT_PHOTO_ADJUSTMENTS);
    expect([...pixels]).toEqual([12, 90, 220, 255, 40, 50, 60, 0]);
  });

  it("changes RGB without changing alpha", () => {
    const pixels = new Uint8ClampedArray([80, 100, 120, 140]);
    applyPhotoAdjustmentsPixels(pixels, 1, 1, { ...DEFAULT_PHOTO_ADJUSTMENTS, exposure: 1 });
    expect(pixels[0]).toBeGreaterThan(80);
    expect(pixels[1]).toBeGreaterThan(100);
    expect(pixels[2]).toBeGreaterThan(120);
    expect(pixels[3]).toBe(140);
  });

  it("maps configured black and white points to the full range", () => {
    const pixels = new Uint8ClampedArray([20, 120, 220, 255]);
    applyPhotoAdjustmentsPixels(pixels, 1, 1, { ...DEFAULT_PHOTO_ADJUSTMENTS, blackPoint: 20, whitePoint: 220 });
    expect([...pixels]).toEqual([0, 128, 255, 255]);
  });

  it("compresses tones into configured output levels", () => {
    const pixels = new Uint8ClampedArray([0, 128, 255, 255]);
    applyPhotoAdjustmentsPixels(pixels, 1, 1, { ...DEFAULT_PHOTO_ADJUSTMENTS, outputBlack: 20, outputWhite: 220 });
    expect([...pixels]).toEqual([20, 120, 220, 255]);
  });

  it("rejects mismatched pixel buffers", () => {
    expect(() => applyPhotoAdjustmentsPixels(new Uint8ClampedArray(3), 1, 1, DEFAULT_PHOTO_ADJUSTMENTS)).toThrow(/dimensions/);
  });

  it("builds RGB and luminance histograms while ignoring transparent pixels", () => {
    const histogram = computePhotoHistogram(new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 0,
    ]), 3, 1);

    expect(histogram.pixelCount).toBe(2);
    expect(histogram.red[255]).toBe(1);
    expect(histogram.red[0]).toBe(1);
    expect(histogram.green[255]).toBe(1);
    expect(histogram.blue[255]).toBe(0);
    expect(histogram.luminance[54]).toBe(1);
    expect(histogram.luminance[182]).toBe(1);
  });

  it("rejects mismatched histogram pixel buffers", () => {
    expect(() => computePhotoHistogram(new Uint8ClampedArray(7), 2, 1)).toThrow(/dimensions/);
  });

  it("computes conservative automatic levels from visible luminance", () => {
    const pixels = new Uint8ClampedArray(200 * 4);
    for (let index = 0; index < 200; index += 1) {
      const value = index < 2 ? 5 : index > 197 ? 250 : 30 + Math.round(((index - 2) / 195) * 190);
      pixels.set([value, value, value, 255], index * 4);
    }
    const levels = computeAutoLevels(computePhotoHistogram(pixels, 200, 1));
    expect(levels.blackPoint).toBeLessThanOrEqual(40);
    expect(levels.whitePoint).toBeGreaterThanOrEqual(215);
    expect(levels.midtone).toBeGreaterThanOrEqual(0.8);
    expect(levels.midtone).toBeLessThanOrEqual(1.25);
    expect(levels.outputBlack).toBe(0);
    expect(levels.outputWhite).toBe(255);
  });

  it("keeps automatic levels neutral when no visible pixels exist", () => {
    const histogram = computePhotoHistogram(new Uint8ClampedArray([80, 90, 100, 0]), 1, 1);
    expect(computeAutoLevels(histogram)).toEqual({
      blackPoint: 0,
      midtone: 1,
      whitePoint: 255,
      outputBlack: 0,
      outputWhite: 255,
    });
  });
});
