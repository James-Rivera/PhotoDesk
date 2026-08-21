import { afterEach, describe, expect, it } from "vitest";
import { clearBranchLocalLoginAttempts, consumeBranchLocalLoginAttempt, createBranchLocalToken, hashBranchLocalPassword, verifyBranchLocalPassword, verifyBranchLocalToken } from "./local";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("branch-local authentication", () => {
  it("accepts only the configured username and password hash", async () => {
    process.env.PHOTODESK_BRANCH_LOCAL_MODE = "true";
    process.env.PHOTODESK_LOCAL_USERNAME = "Branch-One";
    process.env.PHOTODESK_LOCAL_AUTH_SECRET = "a-secure-local-secret-that-is-long-enough";
    process.env.PHOTODESK_LOCAL_PASSWORD_HASH = await hashBranchLocalPassword("correct horse battery staple", new TextEncoder().encode("test-salt"), 100_000);

    expect(await verifyBranchLocalPassword("branch-one", "correct horse battery staple")).toBe(true);
    expect(await verifyBranchLocalPassword("branch-one", "wrong")).toBe(false);
    expect(await verifyBranchLocalPassword("other", "correct horse battery staple")).toBe(false);
  });

  it("signs and verifies a bounded local staff session", async () => {
    process.env.PHOTODESK_BRANCH_LOCAL_MODE = "true";
    process.env.PHOTODESK_LOCAL_USERNAME = "branch-one";
    process.env.PHOTODESK_LOCAL_AUTH_SECRET = "a-secure-local-secret-that-is-long-enough";
    process.env.PHOTODESK_LOCAL_PASSWORD_HASH = await hashBranchLocalPassword("unused password", new TextEncoder().encode("token-test-salt"), 100_000);
    process.env.PHOTODESK_LOCAL_STAFF_NAME = "Branch One Staff";

    const token = await createBranchLocalToken();
    await expect(verifyBranchLocalToken(token)).resolves.toMatchObject({ fullName: "Branch One Staff", active: true });
    await expect(verifyBranchLocalToken(`${token}tampered`)).resolves.toBeNull();
  });

  it("throttles repeated branch-network login attempts", () => {
    const subject = "address:192.168.1.25";
    clearBranchLocalLoginAttempts(subject);
    for (let attempt = 0; attempt < 5; attempt += 1) expect(consumeBranchLocalLoginAttempt(subject, 1_000)).toMatchObject({ allowed: true });
    expect(consumeBranchLocalLoginAttempt(subject, 1_000)).toMatchObject({ allowed: false, retryAfterSeconds: 900 });
    expect(consumeBranchLocalLoginAttempt(subject, 901_001)).toMatchObject({ allowed: true });
    clearBranchLocalLoginAttempts(subject);
  });
});
