"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BarChart3, GripHorizontal, LoaderCircle, RotateCcw, WandSparkles, X } from "lucide-react";
import {
  computeAutoLevels,
  computePhotoHistogram,
  DEFAULT_PHOTO_ADJUSTMENTS,
  hasPhotoAdjustments,
  renderAdjustedPhoto,
  type PhotoAdjustments,
  type PhotoHistogram,
} from "@/lib/images/photo-adjustments";

type AdjustmentSection = "levels" | "color";
interface DialogPosition { x: number; y: number }
interface DragState { pointerId: number; offsetX: number; offsetY: number }

const POSITION_STORAGE_KEY = "photodesk.adjustments-dialog-position";

export function PhotoAdjustmentsDialog({
  file,
  value,
  onPreview,
  onApply,
  onClose,
}: {
  file: File;
  value: PhotoAdjustments;
  onPreview: (value: PhotoAdjustments) => void;
  onApply: (value: PhotoAdjustments) => void;
  onClose: () => void;
}) {
  const initialValue = useRef(value);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const positionRef = useRef<DialogPosition>({ x: 12, y: 64 });
  const [position, setPosition] = useState<DialogPosition>({ x: 12, y: 64 });
  const [draft, setDraft] = useState(value);
  const [section, setSection] = useState<AdjustmentSection>("levels");
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [histogram, setHistogram] = useState<PhotoHistogram | null>(null);
  const [sourceHistogram, setSourceHistogram] = useState<PhotoHistogram | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  const cancel = useCallback(() => {
    onPreview(initialValue.current);
    onClose();
  }, [onClose, onPreview]);

  useEffect(() => {
    let active = true;
    void renderAdjustedPhoto(file, DEFAULT_PHOTO_ADJUSTMENTS, { maxDimension: 640 })
      .then(histogramFromBlob)
      .then((nextHistogram) => { if (active) setSourceHistogram(nextHistogram); })
      .catch(() => { if (active) setSourceHistogram(null); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rectangle = dialog.getBoundingClientRect();
    let next = defaultDialogPosition(rectangle.width, rectangle.height);
    if (window.innerWidth >= 640) {
      try {
        const stored = JSON.parse(window.sessionStorage.getItem(POSITION_STORAGE_KEY) ?? "null") as Partial<DialogPosition> | null;
        if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) next = clampDialogPosition(stored.x as number, stored.y as number, rectangle.width, rectangle.height);
      } catch { /* Ignore invalid session-only position data. */ }
    }
    positionRef.current = next;
    setPosition(next);

    const onResize = () => {
      const currentRectangle = dialog.getBoundingClientRect();
      setPosition((current) => {
        const nextPosition = window.innerWidth < 640
          ? defaultDialogPosition(currentRectangle.width, currentRectangle.height)
          : clampDialogPosition(current.x, current.y, currentRectangle.width, currentRectangle.height);
        positionRef.current = nextPosition;
        return nextPosition;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const rectangle = dialogRef.current?.getBoundingClientRect();
      if (rectangle) setPosition((current) => {
        const nextPosition = window.innerWidth < 640
          ? defaultDialogPosition(rectangle.width, rectangle.height)
          : clampDialogPosition(current.x, current.y, rectangle.width, rectangle.height);
        positionRef.current = nextPosition;
        return nextPosition;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [section]);

  useEffect(() => {
    onPreview(previewEnabled ? draft : initialValue.current);
  }, [draft, onPreview, previewEnabled]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setRendering(true);
      setPreviewError(false);
      void renderAdjustedPhoto(file, draft, { maxDimension: 640 }).then(async (blob) => {
        const nextHistogram = await histogramFromBlob(blob);
        if (active) setHistogram(nextHistogram);
      }).catch(() => {
        if (active) {
          setPreviewError(true);
          setHistogram(null);
        }
      }).finally(() => {
        if (active) setRendering(false);
      });
    }, 70);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft, file]);

  const update = (key: keyof PhotoAdjustments, next: number) => {
    setAutoApplied(false);
    setDraft((current) => ({ ...current, [key]: next }));
  };

  function applyAutoLevels() {
    if (!sourceHistogram) return;
    const levels = computeAutoLevels(sourceHistogram);
    setDraft((current) => ({ ...current, ...levels }));
    setAutoApplied(true);
    setSection("levels");
  }

  function startDragging(event: ReactPointerEvent<HTMLElement>) {
    if (window.innerWidth < 640 || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, input, label, a")) return;
    const rectangle = dialogRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rectangle.left, offsetY: event.clientY - rectangle.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDialog(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const rectangle = dialogRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !rectangle) return;
    event.preventDefault();
    const next = clampDialogPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY, rectangle.width, rectangle.height);
    positionRef.current = next;
    setPosition(next);
  }

  function stopDragging(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    window.sessionStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positionRef.current));
  }

  function resetPosition() {
    const rectangle = dialogRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    const next = defaultDialogPosition(rectangle.width, rectangle.height);
    positionRef.current = next;
    setPosition(next);
    window.sessionStorage.removeItem(POSITION_STORAGE_KEY);
  }

  return <div className="fixed inset-0 z-50 bg-transparent" role="dialog" aria-modal="true" aria-labelledby="photo-adjustments-title" aria-describedby="photo-adjustments-description">
    <div ref={dialogRef} style={{ left: position.x, top: position.y }} className="absolute flex max-h-[calc(100dvh-16px)] w-[calc(100vw-24px)] max-w-[520px] flex-col overflow-hidden rounded-lg border border-[#aaa39a] bg-[#f5f3ee] shadow-[0_20px_58px_rgba(23,23,23,.34)]">
      <header onPointerDown={startDragging} onPointerMove={moveDialog} onPointerUp={stopDragging} onPointerCancel={stopDragging} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button")) resetPosition(); }} className="flex h-11 shrink-0 touch-none select-none items-center gap-2 border-b border-[#cbc6bc] bg-white px-3.5 sm:cursor-move">
        <GripHorizontal size={14} className="hidden shrink-0 text-[var(--ink-3)] sm:block" aria-hidden="true" />
        <h2 id="photo-adjustments-title" className="font-bold">Levels &amp; color</h2>
        <p id="photo-adjustments-description" className="sr-only">Manual photo levels and color adjustments with a live histogram and preview.</p>
        <span className="ml-auto hidden text-[9px] text-[var(--ink-3)] sm:block">Drag · double-click to reset</span>
        <button type="button" onClick={resetPosition} className="grid size-7 place-items-center rounded hover:bg-[var(--surface-warm)]" aria-label="Reset dialog position"><RotateCcw size={13} /></button>
        <button ref={closeButtonRef} type="button" onClick={cancel} className="grid size-7 place-items-center rounded hover:bg-[var(--surface-warm)]" aria-label="Cancel and close photo adjustments"><X size={16} /></button>
      </header>

      <div className="min-h-0 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--ink-2)]">Preset</span>
          <span className="h-8 min-w-0 flex-1 truncate rounded border border-[#b8b2a7] bg-white px-2.5 py-1.5 text-[11px] font-semibold">{autoApplied ? "Auto levels" : hasPhotoAdjustments(draft) ? "Manual" : "Default"}</span>
          <button type="button" disabled={!sourceHistogram} onClick={applyAutoLevels} className="flex h-8 items-center gap-1.5 rounded border border-[#8f8b83] bg-white px-3 text-[10.5px] font-bold disabled:opacity-35" title="Apply conservative automatic input levels"><WandSparkles size={13} /> Auto</button>
          <button type="button" disabled={!hasPhotoAdjustments(draft)} onClick={() => { setAutoApplied(false); setDraft(DEFAULT_PHOTO_ADJUSTMENTS); }} className="grid size-8 place-items-center rounded border border-[#b8b2a7] bg-white disabled:opacity-35" aria-label="Reset all adjustments"><RotateCcw size={13} /></button>
        </div>

        <div className="mt-3 grid grid-cols-2 rounded-md border border-[#b8b2a7] bg-white p-0.5" role="tablist" aria-label="Adjustment groups">
          <button type="button" role="tab" aria-selected={section === "levels"} onClick={() => setSection("levels")} className={`h-8 rounded text-[11px] font-bold ${section === "levels" ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)]"}`}>Levels</button>
          <button type="button" role="tab" aria-selected={section === "color"} onClick={() => setSection("color")} className={`h-8 rounded text-[11px] font-bold ${section === "color" ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)]"}`}>Color &amp; detail</button>
        </div>

        <HistogramChart histogram={histogram} loading={rendering} error={previewError} />

        {section === "levels" ? <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between"><p className="text-[11px] font-bold">Input levels</p><span className="measurement text-[9px] text-[var(--ink-3)]">RGB composite · 0–255</span></div>
          <div className="space-y-2">
            <CompactSlider label="Black" value={draft.blackPoint} min={0} max={40} onChange={(next) => update("blackPoint", Math.min(next, draft.whitePoint - 1))} />
            <CompactSlider label="Midtones" value={draft.midtone} min={0.5} max={1.5} step={0.01} decimals={2} onChange={(next) => update("midtone", next)} />
            <CompactSlider label="White" value={draft.whitePoint} min={215} max={255} onChange={(next) => update("whitePoint", Math.max(next, draft.blackPoint + 1))} />
          </div>
          <div className="mt-3 border-t border-[#cbc6bc] pt-3">
            <div className="mb-1.5 flex items-center justify-between"><p className="text-[11px] font-bold">Output levels</p><span className="h-2.5 w-36 rounded-sm border border-[#999] bg-gradient-to-r from-black to-white" /></div>
            <div className="space-y-2">
              <CompactSlider label="Shadow output" value={draft.outputBlack} min={0} max={100} onChange={(next) => update("outputBlack", Math.min(next, draft.outputWhite - 1))} />
              <CompactSlider label="Highlight output" value={draft.outputWhite} min={155} max={255} onChange={(next) => update("outputWhite", Math.max(next, draft.outputBlack + 1))} />
            </div>
          </div>
        </div> : <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <CompactSlider label="Exposure (EV)" value={draft.exposure} min={-2} max={2} step={0.05} decimals={2} onChange={(next) => update("exposure", next)} />
          <CompactSlider label="Contrast" value={draft.contrast} min={-50} max={50} onChange={(next) => update("contrast", next)} />
          <CompactSlider label="Warmth" value={draft.warmth} min={-50} max={50} onChange={(next) => update("warmth", next)} />
          <CompactSlider label="Tint" value={draft.tint} min={-50} max={50} onChange={(next) => update("tint", next)} />
          <CompactSlider label="Saturation" value={draft.saturation} min={-50} max={50} onChange={(next) => update("saturation", next)} />
          <CompactSlider label="Sharpness" value={draft.sharpness} min={0} max={50} onChange={(next) => update("sharpness", next)} />
        </div>}
      </div>

      <footer className="flex min-h-14 shrink-0 items-center gap-2 border-t border-[#cbc6bc] bg-white px-4 py-2.5">
        <label className="mr-auto flex cursor-pointer items-center gap-2 text-[11px] font-bold"><input type="checkbox" checked={previewEnabled} onChange={(event) => setPreviewEnabled(event.target.checked)} className="accent-[var(--ink)]" /> Preview</label>
        <button type="button" onClick={cancel} className="h-9 rounded-full border border-[#8f8b83] px-5 font-semibold">Cancel</button>
        <button type="button" disabled={rendering || previewError} onClick={() => onApply(draft)} className="h-9 rounded-full border border-[var(--ink)] bg-[var(--ink)] px-6 font-bold text-white disabled:opacity-45">Apply</button>
      </footer>
    </div>
  </div>;
}

function defaultDialogPosition(width: number, height: number): DialogPosition {
  if (window.innerWidth < 640) {
    return clampDialogPosition(
      (window.innerWidth - width) / 2,
      (window.innerHeight - height) / 2,
      width,
      height,
    );
  }
  return clampDialogPosition(16, 64, width, height);
}

function clampDialogPosition(x: number, y: number, width: number, height: number): DialogPosition {
  const margin = 8;
  return {
    x: Math.max(margin, Math.min(x, Math.max(margin, window.innerWidth - width - margin))),
    y: Math.max(margin, Math.min(y, Math.max(margin, window.innerHeight - height - margin))),
  };
}

function HistogramChart({ histogram, loading, error }: { histogram: PhotoHistogram | null; loading: boolean; error: boolean }) {
  const paths = useMemo(() => histogram ? {
    luminance: histogramArea(histogram.luminance),
    red: histogramLine(histogram.red),
    green: histogramLine(histogram.green),
    blue: histogramLine(histogram.blue),
  } : null, [histogram]);

  return <div className="mt-3">
    <div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[11px] font-bold"><BarChart3 size={13} /> Histogram</span><span className="measurement text-[9px] text-[var(--ink-3)]">Shadows → Highlights</span></div>
    <div className="relative h-[132px] overflow-hidden rounded border border-[#777] bg-[#3e3e3e] p-2" aria-label="Live RGB and luminance histogram">
      <svg viewBox="0 0 255 96" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Histogram of the adjusted image">
        <path d={paths?.luminance ?? "M0 96 L255 96 Z"} fill="rgba(255,255,255,.62)" />
        <path d={paths?.red ?? ""} fill="none" stroke="#ff6961" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
        <path d={paths?.green ?? ""} fill="none" stroke="#52d273" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
        <path d={paths?.blue ?? ""} fill="none" stroke="#66adff" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
      </svg>
      {loading && <span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><LoaderCircle className="animate-spin" size={18} /></span>}
      {error && <span className="absolute inset-0 grid place-items-center bg-[#3e3e3e] px-5 text-center text-[11px] font-semibold text-white">Preview unavailable. Reset the controls or try another photo.</span>}
    </div>
  </div>;
}

function CompactSlider({ label, value, min, max, step = 1, decimals = 0, onChange }: { label: string; value: number; min: number; max: number; step?: number; decimals?: number; onChange: (value: number) => void }) {
  const change = (next: number) => { if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next))); };
  return <label className="grid grid-cols-[92px_minmax(0,1fr)_58px] items-center gap-2 text-[10.5px] font-semibold text-[var(--ink-2)]"><span>{label}</span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => change(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-[var(--ink)]" /><input type="number" aria-label={`${label} value`} value={value.toFixed(decimals)} min={min} max={max} step={step} onChange={(event) => change(Number(event.target.value))} className="h-7 rounded border border-[#b8b2a7] bg-white px-1.5 text-right measurement text-[10px]" /></label>;
}

function histogramArea(values: Uint32Array) { return `M0 96 L${histogramPoints(values)} L255 96 Z`; }
function histogramLine(values: Uint32Array) { return `M${histogramPoints(values)}`; }
function histogramPoints(values: Uint32Array) {
  const maximum = Math.max(1, ...values);
  const denominator = Math.log1p(maximum);
  return Array.from(values, (value, index) => `${index} ${96 - (Math.log1p(value) / denominator) * 92}`).join(" L");
}

async function histogramFromBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(bitmap, 0, 0, width, height);
    return computePhotoHistogram(context.getImageData(0, 0, width, height).data, width, height);
  } finally {
    bitmap.close();
  }
}
