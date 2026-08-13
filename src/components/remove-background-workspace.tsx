"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs intentionally bypass image optimization */

import { useEffect, useRef, useState } from "react";
import { Check, Download, ImageMinus, Library, LoaderCircle, RotateCcw, Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { mediaPipeBackgroundRemovalProvider } from "@/lib/background-removal/mediapipe";
import type { BackgroundRemovalProgress } from "@/lib/background-removal/types";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/library/constants";
import { useWorkingPhoto } from "./working-photo-context";
import { SavePhotoToLibraryDialog } from "./save-photo-to-library-dialog";
import { useFeedback } from "./feedback-provider";

interface SourcePhoto { file: File; url: string }
type BackgroundChoice = "transparent" | "white" | "blue" | "gray" | "custom";

export function RemoveBackgroundWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { sendToTemplate } = useWorkingPhoto();
  const { confirm, toast } = useFeedback();
  const [source, setSource] = useState<SourcePhoto | null>(null);
  const [result, setResult] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundChoice>("transparent");
  const [customBackground, setCustomBackground] = useState("#dbeafe");
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState(false);
  const replacementColor = background === "transparent" ? null : background === "white" ? "#ffffff" : background === "blue" ? "#dbeafe" : background === "gray" ? "#d1d5db" : customBackground;

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => { if (error) toast(error, { tone: "error" }); }, [error, toast]);
  useEffect(() => { if (notice) toast(notice, { tone: "success" }); }, [notice, toast]);

  function selectFile(file: File) {
    setError(null); setNotice(null);
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError("The image must be 20 MB or smaller."); return; }
    setSource({ file, url: URL.createObjectURL(file) });
    setResult(null); setResultUrl(null); setProgress(null);
  }

  async function removeBackground() {
    if (!source) return;
    setProcessing(true); setError(null); setNotice(null);
    try {
      const blob = await mediaPipeBackgroundRemovalProvider.remove(source.file, setProgress);
      const name = `${source.file.name.replace(/\.[^.]+$/, "")}-background-removed.png`;
      const file = new File([blob], name, { type: "image/png" });
      setResult(file); setResultUrl(URL.createObjectURL(blob));
      setProgress({ stage: "finishing", percent: 100, message: "Background removed." });
      setNotice("Background removed locally. Check hair and shoulders before using it.");
    } catch (cause) {
      setError(backgroundRemovalError(cause));
    } finally { setProcessing(false); }
  }

  async function outputFile() {
    if (!result) throw new Error("Remove the background first.");
    if (!replacementColor) return result;
    const composited = await compositeBackground(result, replacementColor);
    return new File([composited], result.name.replace(/\.png$/i, "-background.png"), { type: "image/png" });
  }

  async function sendToTemplateBuilder() {
    try { sendToTemplate(await outputFile()); router.push("/app/template"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the photo."); }
  }

  async function download() {
    try {
      const file = await outputFile();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
      setNotice("PNG downloaded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download the PNG."); }
  }

  function clearWorkspace() {
    setSource(null); setResult(null); setResultUrl(null); setBackground("transparent"); setCustomBackground("#dbeafe"); setProgress(null); setError(null); setNotice(null); setSaveDialog(false);
  }

  async function requestReset() {
    const approved = await confirm({ title: "Reset background removal?", body: "The uploaded photo and processed result will be cleared from this workspace.", cancelLabel: "Keep working", confirmLabel: "Reset", destructive: true });
    if (approved) clearWorkspace();
  }

  return <div className="flex min-h-[calc(100vh-56px)] flex-col">
    <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--border-soft)] bg-white p-5 lg:border-r lg:border-b-0">
        <p className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--ink-3)]">Local image tool</p>
        <h1 className="mt-2 text-[22px] font-bold">Remove Background</h1>
        <p className="mt-2 text-[12.5px] leading-5 text-[var(--ink-2)]">Best for one person facing the camera. The customer photo stays on this computer.</p>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectFile(file); event.target.value = ""; }} />

        {source ? <div className="mt-5 rounded-xl border border-[var(--border-soft)] p-3">
          <img src={source.url} alt="Original upload" className="h-36 w-full rounded-lg bg-[var(--ground)] object-contain" />
          <p className="mt-2 truncate font-bold">{source.file.name}</p>
          <button type="button" disabled={processing} onClick={() => inputRef.current?.click()} className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] font-semibold">Choose another photo</button>
        </div> : <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) selectFile(file); }} className={`mt-5 grid min-h-48 w-full place-items-center rounded-xl border-[1.5px] border-dashed p-5 text-center ${dragging ? "border-[#d5c56f] bg-[var(--brand-tint)]" : "border-[#d5cdb6] bg-[var(--surface-warm)]"}`}>
          <span><Upload className="mx-auto" size={22} /><strong className="mt-3 block">Drag an image here</strong><span className="mt-1 block text-[12px] text-[var(--ink-2)]">or click to browse</span><span className="measurement mt-2 block text-[10.5px] text-[var(--ink-3)]">JPG · PNG · WEBP · 20 MB max</span></span>
        </button>}

        <button type="button" disabled={!source || processing} onClick={() => void removeBackground()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] font-bold disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]">{processing ? <LoaderCircle className="animate-spin" size={17} /> : <ImageMinus size={17} />} {processing ? "Removing background…" : result ? "Remove again" : "Remove background"}</button>
        {progress && <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-[var(--divider)]"><div className="h-full bg-[var(--brand)] transition-[width]" style={{ width: `${progress.percent}%` }} /></div><p className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">{progress.message}</p></div>}

        {result && <div className="mt-5">
          <p className="font-bold">Replacement background</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <BackgroundChoiceButton label="Transparent" selected={background === "transparent"} checkerboard onClick={() => setBackground("transparent")} />
            <BackgroundChoiceButton label="Pure white" color="#ffffff" selected={background === "white"} onClick={() => setBackground("white")} />
            <BackgroundChoiceButton label="Light blue" color="#dbeafe" selected={background === "blue"} onClick={() => setBackground("blue")} />
            <BackgroundChoiceButton label="Soft gray" color="#d1d5db" selected={background === "gray"} onClick={() => setBackground("gray")} />
          </div>
          <label className={`mt-2 flex h-11 items-center gap-3 rounded-lg border px-3 ${background === "custom" ? "border-[var(--ink)] bg-[var(--brand-tint)]" : "border-[var(--border)]"}`}>
            <input type="color" value={customBackground} onChange={(event) => { setCustomBackground(event.target.value); setBackground("custom"); }} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Custom replacement background color" />
            <button type="button" onClick={() => setBackground("custom")} className="flex flex-1 items-center justify-between font-semibold"><span>Custom color</span><span className="measurement text-[10.5px] uppercase text-[var(--ink-3)]">{customBackground}</span></button>
          </label>
        </div>}

        <div className="mt-5 rounded-lg border border-[#f0e3bc] bg-[#fffaed] p-3 text-[11.5px] leading-4 text-[var(--ink-2)]"><strong className="block text-[var(--ink)]">First use requires internet</strong>The MediaPipe model downloads once and is cached by the browser. Image pixels are processed locally and are not uploaded to an AI service.</div>
      </aside>

      <main className="grid min-h-[540px] place-items-center bg-[var(--ground)] p-6">
        {resultUrl ? <div className="w-full max-w-[620px]"><div className={`grid min-h-[480px] place-items-center overflow-hidden rounded-xl border border-[var(--border-soft)] ${replacementColor ? "" : "checkerboard"}`} style={replacementColor ? { backgroundColor: replacementColor } : undefined}><img src={resultUrl} alt="Background removed result" className="max-h-[620px] max-w-full object-contain" /></div><p className="mt-3 text-center text-[11.5px] text-[var(--ink-3)]">Check hair, ears, and shoulders before using the processed photo.</p></div>
          : <div className="text-center text-[var(--ink-3)]"><ImageMinus className="mx-auto" size={34} /><p className="mt-3 font-bold text-[var(--ink-2)]">The processed photo will appear here</p><p className="mt-1 text-[12px]">Upload a clear portrait, then choose Remove background.</p></div>}
      </main>
    </div>

    <footer className="flex min-h-[72px] flex-wrap items-center justify-end gap-2 border-t border-[var(--border-soft)] bg-white px-5 py-3">
      <button type="button" disabled={!source || processing} onClick={() => void requestReset()} className="flex h-10 items-center gap-2 rounded-lg px-3 font-semibold disabled:opacity-45"><RotateCcw size={15} /> Reset</button>
      <button type="button" disabled={!result || processing} onClick={() => setSaveDialog(true)} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold disabled:opacity-45"><Library size={15} /> Save to Library</button>
      <button type="button" disabled={!result || processing} onClick={() => void download()} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold disabled:opacity-45"><Download size={15} /> Download PNG</button>
      <button type="button" disabled={!result || processing} onClick={() => void sendToTemplateBuilder()} className="flex h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 font-bold disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]"><Send size={16} /> Use in Template</button>
    </footer>
    {saveDialog && result && <ProcessedSaveDialog fileFactory={outputFile} onClose={() => setSaveDialog(false)} onSaved={(name) => { setSaveDialog(false); setNotice(`Processed photo saved privately for ${name}.`); }} />}
  </div>;
}

function BackgroundChoiceButton({ label, color, selected, checkerboard = false, onClick }: { label: string; color?: string; selected: boolean; checkerboard?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex h-10 items-center gap-2 rounded-lg border px-2.5 text-left font-semibold ${selected ? "border-[var(--ink)] bg-[var(--brand-tint)]" : "border-[var(--border)] bg-white"}`}><span className={`relative grid size-5 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] ${checkerboard ? "checkerboard" : ""}`} style={color ? { backgroundColor: color } : undefined}>{selected && <Check size={12} className="drop-shadow-[0_1px_1px_white]" />}</span><span>{label}</span></button>;
}

function ProcessedSaveDialog({ fileFactory, onClose, onSaved }: { fileFactory: () => Promise<File>; onClose: () => void; onSaved: (name: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useFeedback();
  useEffect(() => { let active = true; void fileFactory().then((value) => { if (active) setFile(value); }).catch(() => { if (active) { toast("Could not prepare the processed PNG.", { tone: "error" }); onClose(); } }); return () => { active = false; }; }, [fileFactory, onClose, toast]);
  if (!file) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40"><LoaderCircle className="animate-spin text-white" /></div>;
  return <SavePhotoToLibraryDialog file={file} variant="processed" onClose={onClose} onSaved={onSaved} />;
}

async function compositeBackground(file: File, color: string) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable.");
    context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the background PNG.")), "image/png"));
  } finally { bitmap.close(); }
}

function backgroundRemovalError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (/download|fetch|network|failed to fetch/i.test(message)) return "The background-removal model could not download. Check the internet connection, then try again.";
  if (/memory|allocation/i.test(message)) return "This photo is too large for the computer to process. Resize it, then try again.";
  if (/mask/i.test(message)) return "No clear person was detected. Try a portrait with one person and a simpler background.";
  return "Background removal could not finish. Try another clear portrait or restart the browser.";
}
