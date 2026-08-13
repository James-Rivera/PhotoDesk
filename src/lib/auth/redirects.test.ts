import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "./redirects";

describe("post-login redirect validation", () => {
  it("allows internal app routes", () => expect(getSafeNextPath("/app/library?query=rivera")).toBe("/app/library?query=rivera"));
  it.each([null, "", "https://evil.example/app", "//evil.example/app", "/login", "/app\\evil"])("rejects unsafe redirect %s", (value) => {
    expect(getSafeNextPath(value)).toBe("/app/template");
  });
});
