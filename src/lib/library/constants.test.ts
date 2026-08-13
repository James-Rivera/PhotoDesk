import { describe, expect, it } from "vitest";
import { safeStorageFilename } from "./constants";

describe("private storage filenames", () => {
  it("removes path and shell-sensitive characters", () => {
    expect(safeStorageFilename("../Juan dela Cruz (final).PNG")).toBe("Juan-dela-Cruz-final.png");
  });

  it("provides a safe base for punctuation-only names", () => {
    expect(safeStorageFilename("!!.jpg")).toBe("photo.jpg");
  });
});
