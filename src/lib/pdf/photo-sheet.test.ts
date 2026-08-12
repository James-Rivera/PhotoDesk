import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS, arrangeOnPage, createCjnetNormalRequest } from "@/lib/layout";
import { collectCutGuideSegments, createExactA4Document } from "./photo-sheet";

describe("photo sheet PDF", () => {
  it("creates an exact A4 page", async () => {
    const document = await createExactA4Document();
    const bytes = await document.save();
    const loaded = await PDFDocument.load(bytes);
    const page = loaded.getPage(0);
    expect(page.getWidth()).toBeCloseTo(A4_WIDTH_POINTS, 5);
    expect(page.getHeight()).toBeCloseTo(A4_HEIGHT_POINTS, 5);
  });

  it("merges shared and partially overlapping cut guides", () => {
    const layout = arrangeOnPage(createCjnetNormalRequest());
    const segments = collectCutGuideSegments(layout);
    expect(segments.length).toBeLessThan(layout.placed.length * 4);
    const duplicates = segments.filter((segment, index) => segments.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(segment)) !== index);
    expect(duplicates).toHaveLength(0);
  });
});
