"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs and short-lived signed URLs intentionally bypass image optimization */

import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, Check, Crop, Download, ImageMinus, Library, LoaderCircle, Maximize2, Minus, Plus, RefreshCw, RotateCcw, Send, SlidersHorizontal, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { checkHomelabBackgroundRemovalHealth, homelabBackgroundRemovalProvider } from "@/lib/background-removal/homelab";
import type { BackgroundRemovalHealth, BackgroundRemovalProgress } from "@/lib/background-removal/types";
import { applyPhotoAdjustmentsPixels, DEFAULT_PHOTO_ADJUSTMENTS, hasPhotoAdjustments, renderAdjustedPhoto, type PhotoAdjustments } from "@/lib/images/photo-adjustments";
import { DEFAULT_PHOTO_CROP, isPhotoCropped, photoCropToPixels, type PhotoCrop } from "@/lib/images/photo-crop";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/library/constants";
import { LibraryPhotoPickerDialog } from "./library-photo-picker-dialog";
import { MaskEdgeEditor } from "./mask-edge-editor";
import { PhotoAdjustmentsDialog } from "./photo-adjustments-dialog";
import { PhotoCropDialog } from "./photo-crop-dialog";
import { useWorkingPhoto } from "./working-photo-context";
import { SavePhotoToLibraryDialog } from "./save-photo-to-library-dialog";
import { useFeedback } from "./feedback-provider";

interface SourcePhoto { file: File; url: string; customerName?: string }
type BackgroundChoice = "transparent" | "white" | "blue" | "gray" | "custom";

export function RemoveBackgroundWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const { sendToTemplate } = useWorkingPhoto();
  const { confirm, toast } = useFeedback();
  const [source, setSource] = useState<SourcePhoto | null>(null);
  const [result, setResult] = useState<File | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [background, setBackground] = useState<BackgroundChoice>("transparent");
  const [customBackground, setCustomBackground] = useState("#dbeafe");
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(DEFAULT_PHOTO_ADJUSTMENTS);
  const [health, setHealth] = useState<BackgroundRemovalHealth>({ status: "starting" });
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [libraryPicker, setLibraryPicker] = useState(false);
  const [maskEditing, setMaskEditing] = useState(false);
  const [adjustmentsDialog, setAdjustmentsDialog] = useState(false);
  const [cropDialog, setCropDialog] = useState(false);
  const [crop, setCrop] = useState<PhotoCrop>(DEFAULT_PHOTO_CROP);
  const [previewZoom, setPreviewZoom] = useState(100);
  const baseFile = result ?? source?.file ?? null;
  const replacementColor = result
    ? background === "transparent" ? null : background === "white" ? "#ffffff" : background === "blue" ? "#dbeafe" : background === "gray" ? "#d1d5db" : customBackground
    : null;

  const refreshHealth = useCallback(async () => {
    setHealth(await checkHomelabBackgroundRemovalHealth());
  }, []);
  const closeAdjustments = useCallback(() => setAdjustmentsDialog(false), []);
  const applyAdjustments = useCallback((next: PhotoAdjustments) => {
    setAdjustments(next);
    setAdjustmentsDialog(false);
    toast("Photo adjustments applied.", { tone: "success" });
  }, [toast]);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void refreshHealth(), 0);
    const interval = window.setInterval(() => void refreshHealth(), 30_000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [refreshHealth]);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const key = event.key.toLowerCase();
      const levelsShortcut = key === "l" && event.ctrlKey && !event.metaKey;
      const fallbackShortcut = key === "a" && !event.ctrlKey && !event.altKey && !event.metaKey;
      if (isTyping || (!levelsShortcut && !fallbackShortcut)) return;
      if (!source || processing || libraryPicker || saveDialog || maskEditing || adjustmentsDialog || cropDialog) return;
      event.preventDefault();
      setAdjustmentsDialog(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjustmentsDialog, cropDialog, libraryPicker, maskEditing, processing, saveDialog, source]);

  function selectFile(file: File, customerName?: string) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) { toast("Choose a JPG, PNG, or WebP image.", { tone: "error" }); return; }
    if (file.size > MAX_PHOTO_BYTES) { toast("The image must be 20 MB or smaller.", { tone: "error" }); return; }
    setSource({ file, url: URL.createObjectURL(file), customerName });
    setResult(null); setProgress(null); setBackground("transparent"); setAdjustments(DEFAULT_PHOTO_ADJUSTMENTS); setCrop(DEFAULT_PHOTO_CROP); setShowOriginal(false); setMaskEditing(false); setAdjustmentsDialog(false); setCropDialog(false); setPreviewZoom(100);
  }

  async function removeBackground() {
    if (!source || health.status !== "ready") return;
    const controller = new AbortController();
    requestRef.current = controller;
    setProcessing(true); setProgress(null);
    try {
      const blob = await homelabBackgroundRemovalProvider.remove(source.file, setProgress, { signal: controller.signal });
      const name = `${source.file.name.replace(/\.[^.]+$/, "")}-background-removed.png`;
      setResult(new File([blob], name, { type: "image/png" }));
      setMaskEditing(false);
      setProgress({ stage: "finishing", percent: 100, message: "Background removed." });
      toast("Background removed. Inspect hair, ears, and shoulders before using it.", { tone: "success" });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) toast(backgroundRemovalError(cause), { tone: "error" });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setProcessing(false);
    }
  }

  async function outputFile() {
    if (!baseFile || !source) throw new Error("Choose a photo first.");
    const blob = await renderAdjustedPhoto(baseFile, adjustments, { backgroundColor: replacementColor, crop });
    const name = `${source.file.name.replace(/\.[^.]+$/, "")}-prepared.png`;
    return new File([blob], name, { type: "image/png" });
  }

  async function sendToTemplateBuilder() {
    try {
      // Keep the cutout transparent so Template Builder can change the color
      // non-destructively. Carry the current choice only as its initial setting.
      if (!baseFile || !source) throw new Error("Choose a photo first.");
      const blob = await renderAdjustedPhoto(baseFile, adjustments, { crop });
      const file = new File([blob], `${source.file.name.replace(/\.[^.]+$/, "")}-prepared.png`, { type: "image/png" });
      sendToTemplate(file, { backgroundColor: replacementColor, source: "photo-preparation" });
      router.push("/app/template");
    }
    catch (cause) { toast(errorMessage(cause, "Could not prepare the photo."), { tone: "error" }); }
  }

  async function download() {
    try {
      const file = await outputFile();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
      toast("Prepared PNG downloaded.", { tone: "success" });
    } catch (cause) { toast(errorMessage(cause, "Could not download the PNG."), { tone: "error" }); }
  }

  function clearWorkspace() {
    requestRef.current?.abort();
    setSource(null); setResult(null); setBackground("transparent"); setCustomBackground("#dbeafe"); setPreviewZoom(100);
    setAdjustments(DEFAULT_PHOTO_ADJUSTMENTS); setCrop(DEFAULT_PHOTO_CROP); setProgress(null); setSaveDialog(false); setShowOriginal(false); setMaskEditing(false); setAdjustmentsDialog(false); setCropDialog(false);
  }

  async function requestReset() {
    const approved = await confirm({ title: "Reset photo preparation?", body: "The selected photo, background result, crop, and adjustments will be cleared from this workspace.", cancelLabel: "Keep working", confirmLabel: "Reset", destructive: true });
    if (approved) clearWorkspace();
  }

  return <div className="flex min-h-[calc(100vh-56px)] flex-col lg:h-[calc(100dvh-56px)] lg:min-h-0 lg:overflow-hidden">
    <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="overflow-y-auto border-b border-[var(--border-soft)] bg-white p-5 lg:border-r lg:border-b-0">
        <ServiceStatus health={health} onRetry={() => void refreshHealth()} />

        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectFile(file); event.target.value = ""; }} />
        {source ? <div className="mt-4 rounded-xl border border-[var(--border-soft)] p-3">
          <img src={source.url} alt="Original photo" className="h-32 w-full rounded-lg bg-[var(--ground)] object-contain" />
          <p className="mt-2 truncate font-bold">{source.file.name}</p>
          {source.customerName && <p className="truncate text-[11px] text-[var(--ink-3)]">Customer: {source.customerName}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={processing} onClick={() => inputRef.current?.click()} className="h-9 rounded-lg border border-[var(--border)] font-semibold">Replace</button><button type="button" disabled={processing} onClick={() => setLibraryPicker(true)} className="h-9 rounded-lg border border-[var(--border)] font-semibold">Library</button></div>
        </div> : <div className="mt-4">
          <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) selectFile(file); }} className={`grid min-h-40 w-full place-items-center rounded-xl border-[1.5px] border-dashed p-5 text-center ${dragging ? "border-[#d5c56f] bg-[var(--brand-tint)]" : "border-[#d5cdb6] bg-[var(--surface-warm)]"}`}>
            <span><Upload className="mx-auto" size={22} /><strong className="mt-3 block">Drag an image here</strong><span className="mt-1 block text-[12px] text-[var(--ink-2)]">or browse this computer</span><span className="measurement mt-2 block text-[10.5px] text-[var(--ink-3)]">JPG · PNG · WEBP · 20 MB max</span></span>
          </button>
          <button type="button" onClick={() => setLibraryPicker(true)} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] font-semibold"><Library size={15} /> Choose from Library</button>
        </div>}

        {processing ? <button type="button" onClick={() => requestRef.current?.abort()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white font-bold"><X size={16} /> Cancel removal</button>
          : <button type="button" disabled={!source || health.status !== "ready"} onClick={() => void removeBackground()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] font-bold disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]"><ImageMinus size={17} /> {result ? "Remove again" : "Remove background"}</button>}
        {progress && <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-[var(--divider)]"><div className="h-full bg-[var(--brand)] transition-[width]" style={{ width: `${progress.percent}%` }} /></div><p className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">{progress.message}</p></div>}

        {source && <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
          <div className="flex items-center justify-between"><p className="font-bold">Photo adjustments</p><button type="button" disabled={!hasPhotoAdjustments(adjustments)} onClick={() => setAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)} className="text-[11px] font-semibold text-[var(--ink-2)] disabled:opacity-35">Reset</button></div>
          <p className="mt-1 text-[11px] leading-4 text-[var(--ink-3)]">Open the live histogram and manual Levels/color controls.</p>
          <button type="button" disabled={processing} onClick={() => setAdjustmentsDialog(true)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white font-bold hover:bg-[var(--surface-warm)] disabled:opacity-45"><SlidersHorizontal size={16} /> Adjust photo <span className="ml-auto mr-1 flex gap-1"><kbd className="rounded border border-[var(--border)] bg-[var(--surface-warm)] px-1.5 py-0.5 text-[9px] font-bold">Ctrl L</kbd><kbd className="rounded border border-[var(--border)] bg-[var(--surface-warm)] px-1.5 py-0.5 text-[9px] font-bold">A</kbd></span></button>
          {hasPhotoAdjustments(adjustments) && <p className="mt-2 text-[10.5px] font-semibold text-[#255c2f]">Manual adjustments applied</p>}
          <button type="button" disabled={processing} onClick={() => setCropDialog(true)} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white font-bold hover:bg-[var(--surface-warm)] disabled:opacity-45"><Crop size={16} /> Crop photo</button>
          {isPhotoCropped(crop) && <div className="mt-2 flex items-center justify-between text-[10.5px] font-semibold text-[#255c2f]"><span>Crop applied</span><button type="button" onClick={() => setCrop(DEFAULT_PHOTO_CROP)} className="text-[var(--ink-2)] underline underline-offset-2">Use full photo</button></div>}
        </div>}

        {result && <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
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

        <div className="mt-5 rounded-lg border border-[#f0e3bc] bg-[#fffaed] p-3 text-[11.5px] leading-4 text-[var(--ink-2)]"><strong className="block text-[var(--ink)]">Private CJNET processing</strong>Background removal sends the photo to the configured homelab and returns a transparent PNG without saving it. Color adjustments stay in this browser.</div>
      </aside>

      <main className="relative grid min-h-[540px] place-items-center overflow-hidden bg-[var(--ground)] p-4 lg:min-h-0">
        {source && !maskEditing && <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center rounded-lg border border-[var(--border-soft)] bg-white p-1 shadow-sm"><button type="button" onClick={() => setShowOriginal(true)} className={`h-8 rounded-md px-3 font-semibold ${showOriginal ? "bg-[var(--ink)] text-white" : ""}`}>Original</button><button type="button" onClick={() => setShowOriginal(false)} className={`h-8 rounded-md px-3 font-semibold ${!showOriginal ? "bg-[var(--ink)] text-white" : ""}`}>Prepared</button>{result && <button type="button" onClick={() => setMaskEditing(true)} className="ml-1 flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 font-semibold"><Brush size={13} /> Edit edges</button>}<span className="mx-1.5 h-5 w-px bg-[var(--divider)]" /><button type="button" onClick={() => setPreviewZoom((current) => Math.max(50, current - 25))} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-warm)]" aria-label="Zoom photo out"><Minus size={13} /></button><span className="measurement min-w-10 text-center text-[10px]">{previewZoom === 100 ? "Fit" : `${previewZoom}%`}</span><button type="button" onClick={() => setPreviewZoom((current) => Math.min(300, current + 25))} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-warm)]" aria-label="Zoom photo in"><Plus size={13} /></button><button type="button" onClick={() => setPreviewZoom(100)} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-warm)]" aria-label="Fit entire photo"><Maximize2 size={13} /></button></div>}
        {maskEditing && source && result ? <MaskEdgeEditor source={source.file} cutout={result} onCancel={() => setMaskEditing(false)} onApply={(file) => { setResult(file); setMaskEditing(false); toast("Edge corrections applied.", { tone: "success" }); }} />
          : source && baseFile ? <div className="flex h-full min-h-0 w-full max-w-[920px] flex-col pt-11">{showOriginal
            ? <ZoomableImagePreview src={source.url} alt="Original photo" zoom={previewZoom} checkerboard={false} backgroundColor={null} crop={crop} />
            : <LiveAdjustedCanvasPreview file={baseFile} adjustments={adjustments} zoom={previewZoom} checkerboard={!replacementColor && Boolean(result)} backgroundColor={replacementColor} crop={crop} />}
            <p className="shrink-0 py-2 text-center text-[11.5px] text-[var(--ink-3)]">{result ? "Inspect hair, ears, shoulders, and background edges before using the processed photo." : "Adjustments are non-destructive. Remove the background when a replacement color is required."}</p></div>
            : <div className="text-center text-[var(--ink-3)]"><SlidersHorizontal className="mx-auto" size={34} /><p className="mt-3 font-bold text-[var(--ink-2)]">The prepared photo will appear here</p><p className="mt-1 text-[12px]">Upload a photo or choose one from the private Library.</p></div>}
      </main>
    </div>

    <footer className="flex min-h-[72px] flex-wrap items-center justify-end gap-2 border-t border-[var(--border-soft)] bg-white px-5 py-3">
      <button type="button" disabled={!source || processing} onClick={() => void requestReset()} className="flex h-10 items-center gap-2 rounded-lg px-3 font-semibold disabled:opacity-45"><RotateCcw size={15} /> Reset</button>
      <button type="button" disabled={!baseFile || processing} onClick={() => setSaveDialog(true)} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold disabled:opacity-45"><Library size={15} /> Save to Library</button>
      <button type="button" disabled={!baseFile || processing} onClick={() => void download()} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold disabled:opacity-45"><Download size={15} /> Download PNG</button>
      <button type="button" disabled={!baseFile || processing} onClick={() => void sendToTemplateBuilder()} className="flex h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 font-bold disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]"><Send size={16} /> Use in Template</button>
    </footer>
    {libraryPicker && <LibraryPhotoPickerDialog onClose={() => setLibraryPicker(false)} onChoose={(file, customerName) => selectFile(file, customerName)} />}
    {saveDialog && baseFile && <ProcessedSaveDialog fileFactory={outputFile} onClose={() => setSaveDialog(false)} onSaved={(name) => { setSaveDialog(false); toast(`Prepared photo saved privately for ${name}.`, { tone: "success" }); }} />}
    {adjustmentsDialog && baseFile && <PhotoAdjustmentsDialog file={baseFile} value={adjustments} onPreview={setAdjustments} onClose={closeAdjustments} onApply={applyAdjustments} />}
    {cropDialog && baseFile && <PhotoCropDialog file={baseFile} value={crop} onClose={() => setCropDialog(false)} onApply={(value) => { setCrop(value); setCropDialog(false); setPreviewZoom(100); toast("Photo crop applied.", { tone: "success" }); }} />}
    {processing && <BackgroundRemovalProgressDialog progress={progress} onCancel={() => requestRef.current?.abort()} />}
  </div>;
}

function ZoomableImagePreview({ src, alt, zoom, checkerboard, backgroundColor, crop }: { src: string; alt: string; zoom: number; checkerboard: boolean; backgroundColor: string | null; crop: PhotoCrop }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const sourceCrop = photoCropToPixels(crop, imageSize.width, imageSize.height);
  const fitScale = Math.min(
    Math.max(1, viewportSize.width - 24) / sourceCrop.width,
    Math.max(1, viewportSize.height - 24) / sourceCrop.height,
  );
  const displayWidth = Math.max(1, Math.round(sourceCrop.width * fitScale * zoom / 100));
  const displayHeight = Math.max(1, Math.round(sourceCrop.height * fitScale * zoom / 100));

  return <div ref={viewportRef} className={`relative min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border-soft)] ${checkerboard ? "checkerboard" : ""}`} style={backgroundColor ? { backgroundColor } : undefined}>
    <div className="flex min-h-full min-w-full items-center justify-center p-3" style={{ width: Math.max(viewportSize.width, displayWidth + 24), height: Math.max(viewportSize.height, displayHeight + 24) }}>
      <div className="relative shrink-0 overflow-hidden" style={{ width: displayWidth, height: displayHeight }}>
        <img src={src} alt={alt} draggable={false} onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="absolute max-w-none select-none" style={{ width: imageSize.width * fitScale * zoom / 100, height: imageSize.height * fitScale * zoom / 100, left: -sourceCrop.x * fitScale * zoom / 100, top: -sourceCrop.y * fitScale * zoom / 100 }} />
      </div>
    </div>
  </div>;
}

function LiveAdjustedCanvasPreview({ file, adjustments, zoom, checkerboard, backgroundColor, crop }: { file: File; adjustments: PhotoAdjustments; zoom: number; checkerboard: boolean; backgroundColor: string | null; crop: PhotoCrop }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [sourceVersion, setSourceVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let bitmap: ImageBitmap | null = null;
    void createImageBitmap(file).then((nextBitmap) => {
      bitmap = nextBitmap;
      if (!active) { nextBitmap.close(); bitmap = null; return; }
      bitmapRef.current = nextBitmap;
      const sourceCrop = photoCropToPixels(crop, nextBitmap.width, nextBitmap.height);
      const scale = Math.min(1, 900 / Math.max(sourceCrop.width, sourceCrop.height));
      const width = Math.max(1, Math.round(sourceCrop.width * scale));
      const height = Math.max(1, Math.round(sourceCrop.height * scale));
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = width; canvas.height = height; }
      setImageSize({ width, height });
      setSourceVersion((current) => current + 1);
      setReady(true);
    });
    return () => {
      active = false;
      if (bitmapRef.current === bitmap) bitmapRef.current = null;
      bitmap?.close();
    };
  }, [crop, file]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const bitmap = bitmapRef.current;
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !bitmap || !context) return;
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const sourceCrop = photoCropToPixels(crop, bitmap.width, bitmap.height);
      context.drawImage(bitmap, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      applyPhotoAdjustmentsPixels(imageData.data, canvas.width, canvas.height, adjustments);
      context.putImageData(imageData, 0, 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [adjustments, crop, sourceVersion]);

  const fitScale = Math.min(
    Math.max(1, viewportSize.width - 24) / imageSize.width,
    Math.max(1, viewportSize.height - 24) / imageSize.height,
  );
  const displayWidth = Math.max(1, Math.round(imageSize.width * fitScale * zoom / 100));
  const displayHeight = Math.max(1, Math.round(imageSize.height * fitScale * zoom / 100));

  return <div ref={viewportRef} className={`relative min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border-soft)] ${checkerboard ? "checkerboard" : ""}`} style={backgroundColor ? { backgroundColor } : undefined}>
    <div className="flex min-h-full min-w-full items-center justify-center p-3" style={{ width: Math.max(viewportSize.width, displayWidth + 24), height: Math.max(viewportSize.height, displayHeight + 24) }}>
      <canvas ref={canvasRef} className="shrink-0" style={{ width: displayWidth, height: displayHeight }} aria-label="Live adjusted photo preview" />
    </div>
    {!ready && <span className="pointer-events-none absolute inset-0 grid place-items-center"><LoaderCircle className="animate-spin" size={22} /></span>}
  </div>;
}

function BackgroundRemovalProgressDialog({ progress, onCancel }: { progress: BackgroundRemovalProgress | null; onCancel: () => void }) {
  const percent = Math.max(3, Math.min(100, progress?.percent ?? 3));
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="background-removal-progress-title">
    <div className="w-full max-w-[420px] rounded-xl border border-[var(--border-soft)] bg-white p-5 shadow-[0_24px_70px_rgba(23,23,23,.3)]">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)]"><LoaderCircle className="animate-spin" size={20} /></span><div><h2 id="background-removal-progress-title" className="text-[17px] font-bold">Removing background</h2><p className="mt-1 text-[12px] leading-5 text-[var(--ink-2)]">{progress?.message ?? "Sending the photo securely to the CJNET processor…"}</p></div></div>
      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[var(--divider)]"><div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
      <div className="mt-2 flex items-center justify-between"><span className="measurement text-[11px] font-bold">{Math.round(percent)}%</span><span className="text-[10.5px] text-[var(--ink-3)]">Keep this window open</span></div>
      <div className="mt-5 flex items-center justify-between border-t border-[var(--border-soft)] pt-4"><p className="max-w-[250px] text-[10.5px] leading-4 text-[var(--ink-3)]">The source is processed by the private CJNET homelab and is not saved by this step.</p><button type="button" onClick={onCancel} className="h-9 rounded-lg border border-[var(--border)] px-4 font-semibold">Cancel</button></div>
    </div>
  </div>;
}

function ServiceStatus({ health, onRetry }: { health: BackgroundRemovalHealth; onRetry: () => void }) {
  const ready = health.status === "ready";
  const starting = health.status === "starting";
  const label = ready ? "Background remover ready" : starting ? "Connecting to background remover…" : health.status === "unconfigured" ? "Background remover not configured" : "Background remover unavailable";
  return <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11.5px] ${ready ? "border-[#cbe3c6] bg-[#eef6ec] text-[#255c2f]" : starting ? "border-[#f0e3bc] bg-[#fffaed]" : "border-[#efc0b2] bg-[#fdf0ec] text-[#8c2410]"}`}><span className={`size-2 rounded-full ${ready ? "bg-[#2f6e3b]" : starting ? "animate-pulse bg-[#a16a00]" : "bg-[#b5220c]"}`} /><span className="min-w-0 flex-1"><strong className="block">{label}</strong>{health.model && <span className="measurement block truncate text-[9.5px] opacity-75">{health.model}</span>}</span>{!ready && !starting && <button type="button" onClick={onRetry} className="grid size-7 place-items-center rounded-md hover:bg-white/60" aria-label="Retry background-removal connection"><RefreshCw size={14} /></button>}</div>;
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

function backgroundRemovalError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (/session|authorized|active staff/i.test(message)) return message || "Your session expired. Sign in again.";
  if (/starting/i.test(message)) return "The background-removal model is still starting. Try again shortly.";
  if (/reach|network|failed to fetch/i.test(message)) return "The CJNET background-removal server is unavailable. Check the homelab connection, then retry.";
  if (/memory|allocation|too large/i.test(message)) return "This photo is too large for the background-removal server.";
  return message || "Background removal could not finish. Try another clear portrait.";
}

function errorMessage(cause: unknown, fallback: string) { return cause instanceof Error && cause.message ? cause.message : fallback; }
