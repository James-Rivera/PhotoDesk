import type { StaffProfile } from "./staff";

export const LOCAL_AUTH_COOKIE = "cjnet-photodesk-local-session";
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

interface LocalTokenPayload {
  exp: number;
  profile: StaffProfile;
}

interface LocalAttemptBucket {
  attempts: number[];
}

const LOCAL_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOCAL_LOGIN_LIMIT = 5;
const localAttemptBuckets = new Map<string, LocalAttemptBucket>();

export function isBranchLocalMode() {
  return process.env.PHOTODESK_BRANCH_LOCAL_MODE === "true";
}

export function isBranchLocalConfigured() {
  const passwordHash = process.env.PHOTODESK_LOCAL_PASSWORD_HASH ?? "";
  return Boolean(isBranchLocalMode() && localUsername() && /^pbkdf2-sha256\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(passwordHash) && signingSecret());
}

export function getBranchLocalProfile(): StaffProfile {
  return {
    id: "branch-local-staff",
    fullName: process.env.PHOTODESK_LOCAL_STAFF_NAME?.trim() || "CJNET Branch Staff",
    username: localUsername() || "branch",
    role: process.env.PHOTODESK_LOCAL_ROLE === "admin" ? "admin" : "staff",
    active: true,
  };
}

export async function verifyBranchLocalPassword(username: string, password: string) {
  const encoded = process.env.PHOTODESK_LOCAL_PASSWORD_HASH;
  if (!isBranchLocalConfigured() || username.trim().toLowerCase() !== localUsername() || !encoded) return false;

  const [algorithm, iterationsValue, saltValue, expectedValue] = encoded.split("$");
  const iterations = Number(iterationsValue);
  if (algorithm !== "pbkdf2-sha256" || !Number.isSafeInteger(iterations) || iterations < 100_000 || !saltValue || !expectedValue) return false;

  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: decodeBase64Url(saltValue), iterations },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
    256,
  );
  return timingSafeEqual(new Uint8Array(derived), decodeBase64Url(expectedValue));
}

export function consumeBranchLocalLoginAttempt(subject: string, now = Date.now()) {
  const key = subject.trim().toLowerCase() || "unknown";
  const cutoff = now - LOCAL_LOGIN_WINDOW_MS;
  const attempts = (localAttemptBuckets.get(key)?.attempts ?? []).filter((attempt) => attempt > cutoff);
  if (attempts.length >= LOCAL_LOGIN_LIMIT) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((attempts[0] + LOCAL_LOGIN_WINDOW_MS - now) / 1000)) };
  }
  attempts.push(now);
  localAttemptBuckets.set(key, { attempts });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearBranchLocalLoginAttempts(subject: string) {
  localAttemptBuckets.delete(subject.trim().toLowerCase() || "unknown");
}

export async function hashBranchLocalPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 210_000) {
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
    256,
  );
  return `pbkdf2-sha256$${iterations}$${encodeBase64Url(salt)}$${encodeBase64Url(new Uint8Array(derived))}`;
}

export async function createBranchLocalToken() {
  const payload: LocalTokenPayload = {
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
    profile: getBranchLocalProfile(),
  };
  const body = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

export async function verifyBranchLocalToken(token: string | undefined): Promise<StaffProfile | null> {
  if (!isBranchLocalConfigured() || !token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || !timingSafeEqual(decodeBase64Url(signature), decodeBase64Url(await sign(body)))) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(body))) as LocalTokenPayload;
    if (!payload.profile?.active || payload.profile.id !== "branch-local-staff" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.profile;
  } catch {
    return null;
  }
}

export const branchLocalCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production" && !isBranchLocalMode(),
  path: "/",
  maxAge: TOKEN_LIFETIME_SECONDS,
};

function localUsername() {
  return process.env.PHOTODESK_LOCAL_USERNAME?.trim().toLowerCase() || "";
}

function signingSecret() {
  const secret = process.env.PHOTODESK_LOCAL_AUTH_SECRET ?? "";
  return secret.length >= 32 ? secret : "";
}

async function sign(body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(signingSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))));
}

function timingSafeEqual(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
