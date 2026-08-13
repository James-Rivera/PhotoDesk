import { describe, expect, it } from "vitest";
import { buildPdfDownloadName } from "./download-name";

describe("PDF download names", () => {
  it("puts the optional customer first and keeps the timestamp short", () => {
    const now = new Date(2026, 7, 13, 17, 45, 9, 27);
    expect(buildPdfDownloadName({ jobName: "James Carlo Rivera", presetName: "CJNET Normal", now }))
      .toBe("James-Carlo-Rivera_Normal_260813-174509.pdf");
  });

  it("removes characters that are unsafe in Windows filenames", () => {
    const now = new Date(2026, 0, 2, 3, 4, 5, 6);
    expect(buildPdfDownloadName({ jobName: "Juan: Dela/Cruz?", presetName: "2×2 Only", now }))
      .toBe("Juan-Dela-Cruz_2-2-Only_260102-030405.pdf");
  });

  it("uses CJNET when staff leave the customer name blank", () => {
    const now = new Date(2026, 7, 13, 17, 45, 9);
    expect(buildPdfDownloadName({ presetName: "CJNET Normal", now }))
      .toBe("CJNET_Normal_260813-174509.pdf");
  });
});
