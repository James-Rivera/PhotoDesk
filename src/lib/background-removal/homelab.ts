import { createClient } from "@/lib/supabase/client";
import type { BackgroundRemovalHealth, BackgroundRemovalProgress, BackgroundRemovalProvider } from "./types";

const SERVICE_URL = process.env.NEXT_PUBLIC_BACKGROUND_REMOVAL_API_URL?.trim().replace(/\/$/, "") ?? "";

export function isHomelabBackgroundRemovalConfigured() {
  return Boolean(SERVICE_URL);
}

export async function checkHomelabBackgroundRemovalHealth(signal?: AbortSignal): Promise<BackgroundRemovalHealth> {
  if (!SERVICE_URL) return { status: "unconfigured" };
  try {
    const response = await fetch(`${SERVICE_URL}/v1/health`, { cache: "no-store", signal });
    if (!response.ok) return { status: "offline" };
    const body = await response.json() as { status?: unknown; model?: unknown; serviceVersion?: unknown };
    return {
      status: body.status === "ready" ? "ready" : "starting",
      model: typeof body.model === "string" ? body.model : undefined,
      serviceVersion: typeof body.serviceVersion === "string" ? body.serviceVersion : undefined,
    };
  } catch {
    return { status: "offline" };
  }
}

export const homelabBackgroundRemovalProvider: BackgroundRemovalProvider = {
  id: "cjnet-homelab-rembg",
  name: "CJNET background remover",
  async remove(file, onProgress, options) {
    if (!SERVICE_URL) throw new Error("The background-removal service is not configured.");
    onProgress(progress("connecting", 4, "Verifying the staff session…"));
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken) throw new Error("Your session expired. Sign in again.");
    return uploadImage(file, accessToken, onProgress, options?.signal);
  },
};

function uploadImage(file: File, accessToken: string, onProgress: (value: BackgroundRemovalProgress) => void, signal?: AbortSignal) {
  return new Promise<Blob>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${SERVICE_URL}/v1/remove`);
    request.responseType = "blob";
    request.timeout = 135_000;
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    const abort = () => request.abort();
    signal?.addEventListener("abort", abort, { once: true });
    request.upload.onprogress = (event) => {
      const ratio = event.lengthComputable ? event.loaded / event.total : 0.5;
      onProgress(progress("uploading", 10 + Math.round(ratio * 35), event.lengthComputable ? `Uploading securely… ${Math.round(ratio * 100)}%` : "Uploading securely…"));
    };
    request.upload.onload = () => onProgress(progress("processing", 50, "Removing the original background…"));
    request.onload = () => {
      signal?.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300 && request.response?.type === "image/png") {
        onProgress(progress("finishing", 96, "Preparing the transparent result…"));
        resolve(request.response);
        return;
      }
      void readError(request.response, request.status).then(reject);
    };
    request.onerror = () => { signal?.removeEventListener("abort", abort); reject(new Error("The background-removal server could not be reached.")); };
    request.ontimeout = () => { signal?.removeEventListener("abort", abort); reject(new Error("Background removal took too long. Try again.")); };
    request.onabort = () => { signal?.removeEventListener("abort", abort); reject(new DOMException("Background removal was cancelled.", "AbortError")); };

    const form = new FormData();
    form.append("file", file, file.name);
    request.send(form);
  });
}

async function readError(blob: Blob | null, status: number) {
  let detail = "";
  try {
    const body = blob ? JSON.parse(await blob.text()) as { detail?: unknown } : null;
    detail = typeof body?.detail === "string" ? body.detail : "";
  } catch { /* The service may be unavailable before it can return JSON. */ }
  if (status === 401 || status === 403) return new Error(detail || "Your staff session is not authorized for background removal.");
  if (status === 413 || status === 415) return new Error(detail || "The selected photo cannot be processed.");
  if (status === 429) return new Error("Too many background-removal requests. Wait a moment, then try again.");
  if (status === 503) return new Error("The background-removal model is still starting. Try again shortly.");
  if (status === 504) return new Error("Background removal timed out. Try a smaller photo.");
  return new Error(detail || "The background-removal server could not finish this photo.");
}

function progress(stage: BackgroundRemovalProgress["stage"], percent: number, message: string): BackgroundRemovalProgress {
  return { stage, percent, message };
}
