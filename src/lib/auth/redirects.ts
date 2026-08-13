export function getSafeNextPath(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== "string") return "/app/template";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/app/template";
  try {
    const url = new URL(value, "https://cjnet.local");
    if (url.origin !== "https://cjnet.local" || !url.pathname.startsWith("/app")) return "/app/template";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/app/template";
  }
}
