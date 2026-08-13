export const CUSTOMER_PHOTO_BUCKET = "customer-photos";
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function safeStorageFilename(filename: string) {
  const dot = filename.lastIndexOf(".");
  const extension = dot >= 0 ? filename.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = (dot >= 0 ? filename.slice(0, dot) : filename).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "photo";
  return `${base}${extension}`;
}
