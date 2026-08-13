const HELPER_ORIGIN = "http://127.0.0.1:17421";
const TOKEN_KEY = "cjnet-print-helper-token";

export interface PrintHelperHealth {
  available: boolean;
  paired: boolean;
  version?: string;
}

export async function getPrintHelperHealth(): Promise<PrintHelperHealth> {
  try {
    const response = await fetch(`${HELPER_ORIGIN}/health`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return { available: false, paired: false };
    const result = await response.json() as { paired?: boolean; version?: string };
    return { available: true, paired: Boolean(result.paired && getStoredToken()), version: result.version };
  } catch {
    return { available: false, paired: false };
  }
}

export async function pairPrintHelper(code: string) {
  const response = await fetch(`${HELPER_ORIGIN}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim() }),
  });
  const result = await readResult(response) as { token?: string };
  if (!result.token) throw new Error("The print helper did not return a pairing token.");
  window.localStorage.setItem(TOKEN_KEY, result.token);
}

export async function openNativePrintDialog(pdfBytes: Uint8Array) {
  const token = getStoredToken();
  if (!token) throw new PrintHelperPairingError("Pair this computer with CJNET Print Helper first.");
  const response = await fetch(`${HELPER_ORIGIN}/print-dialog`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf", "X-CJNET-Print-Token": token },
    body: new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" }),
  });
  await readResult(response);
}

async function readResult(response: Response) {
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    if (response.status === 401) {
      window.localStorage.removeItem(TOKEN_KEY);
      throw new PrintHelperPairingError(result.error ?? "Pairing expired. Pair this computer again.");
    }
    throw new Error(result.error ?? "CJNET Print Helper could not complete the request.");
  }
  return result;
}

function getStoredToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

export class PrintHelperPairingError extends Error {}
