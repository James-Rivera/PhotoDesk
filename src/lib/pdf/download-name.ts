interface PdfDownloadNameOptions {
  jobName?: string;
  presetName: string;
  now?: Date;
}

export function buildPdfDownloadName({ jobName, presetName, now = new Date() }: PdfDownloadNameOptions) {
  const timestamp = [
    String(now.getFullYear()).slice(-2),
    twoDigits(now.getMonth() + 1),
    twoDigits(now.getDate()),
  ].join("") + `-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`;

  const customer = jobName?.trim() ? safeFilenamePart(jobName) : "CJNET";
  const preset = safeFilenamePart(shortPresetName(presetName));
  return `${customer}_${preset}_${timestamp}.pdf`;
}

function safeFilenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "Unnamed";
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function shortPresetName(value: string) {
  return value.replace(/^CJNET\s+/i, "").trim() || "Custom";
}
