"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs intentionally bypass image optimization */

import { useEffect, useRef, useState } from "react";
import { Crop, RotateCcw, X } from "lucide-react";
import { centeredPhotoCropForAspect, DEFAULT_PHOTO_CROP, MIN_PHOTO_CROP_SIZE, normalizePhotoCrop, photoCropToPixels, type PhotoCrop } from "@/lib/images/photo-crop";

type DragMode = "move" | "nw" | "ne" | "sw" | "se";
interface DragState { mode: DragMode; x: number; y: number; crop: PhotoCrop }

export function PhotoCropDialog({ file, value, onApply, onClose }: { file: File; value: PhotoCrop; onApply: (value: PhotoCrop) => void; onClose: () => void }) {
  const [crop, setCrop] = useState(() => normalizePhotoCrop(value));
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const pixels = photoCropToPixels(crop, imageSize.width, imageSize.height);
  const applyAspect = (aspect: number) => setCrop(centeredPhotoCropForAspect(imageSize.width, imageSize.height, aspect));

  function startDrag(event: React.PointerEvent<HTMLElement>, mode: DragMode) {
    dragRef.current = { mode, x: event.clientX, y: event.clientY, crop };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function drag(event: React.PointerEvent<HTMLElement>) {
    const start = dragRef.current;
    if (!start) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - start.x) / bounds.width;
    const dy = (event.clientY - start.y) / bounds.height;
    const next = { ...start.crop };
    if (start.mode === "move") {
      next.x += dx; next.y += dy;
    } else {
      if (start.mode.includes("w")) { next.x += dx; next.width -= dx; }
      if (start.mode.includes("e")) next.width += dx;
      if (start.mode.includes("n")) { next.y += dy; next.height -= dy; }
      if (start.mode.includes("s")) next.height += dy;
      if (next.width < MIN_PHOTO_CROP_SIZE) {
        if (start.mode.includes("w")) next.x -= MIN_PHOTO_CROP_SIZE - next.width;
        next.width = MIN_PHOTO_CROP_SIZE;
      }
      if (next.height < MIN_PHOTO_CROP_SIZE) {
        if (start.mode.includes("n")) next.y -= MIN_PHOTO_CROP_SIZE - next.height;
        next.height = MIN_PHOTO_CROP_SIZE;
      }
    }
    setCrop(normalizePhotoCrop(next));
  }

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title">
    <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-[920px] flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white shadow-[0_24px_70px_rgba(23,23,23,.3)]">
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-[var(--border-soft)] px-5"><Crop size={18} /><h2 id="photo-crop-title" className="text-[17px] font-bold">Crop photo</h2><span className="measurement rounded-full bg-[var(--surface-warm)] px-2.5 py-1 text-[10.5px]">{pixels.width} × {pixels.height} px</span><button type="button" onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-md hover:bg-[var(--surface-warm)]" aria-label="Close crop dialog"><X size={17} /></button></header>
      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_276px] md:overflow-hidden">
        <section className="grid min-h-[360px] place-items-center overflow-auto bg-[var(--ground)] p-5 md:min-h-0">
          <div className="relative w-full max-w-[560px] touch-none overflow-hidden bg-black/10 shadow-sm" style={{ aspectRatio: `${imageSize.width}/${imageSize.height}` }} onPointerMove={drag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
            <img src={imageUrl} alt="Crop preview" draggable={false} onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="absolute inset-0 size-full select-none" />
            <div className="absolute cursor-move border-2 border-[var(--brand)] shadow-[0_0_0_9999px_rgba(23,23,23,.58)]" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} onPointerDown={(event) => startDrag(event, "move")}>
              <span className="pointer-events-none absolute left-1/3 top-0 h-full border-l border-white/50" /><span className="pointer-events-none absolute left-2/3 top-0 h-full border-l border-white/50" /><span className="pointer-events-none absolute left-0 top-1/3 w-full border-t border-white/50" /><span className="pointer-events-none absolute left-0 top-2/3 w-full border-t border-white/50" />
              {(["nw", "ne", "sw", "se"] as DragMode[]).map((mode) => <button key={mode} type="button" aria-label={`Resize crop from ${mode}`} onPointerDown={(event) => { event.stopPropagation(); startDrag(event, mode); }} className={`absolute size-4 rounded-full border-2 border-white bg-[var(--brand)] shadow ${mode.includes("n") ? "-top-2" : "-bottom-2"} ${mode.includes("w") ? "-left-2" : "-right-2"}`} />)}
            </div>
          </div>
        </section>
        <aside className="border-t border-[var(--border-soft)] p-5 md:overflow-y-auto md:border-l md:border-t-0">
          <p className="font-bold">Shape</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCrop(DEFAULT_PHOTO_CROP)} className="h-9 rounded-lg border border-[var(--border)] font-semibold">Original</button><button type="button" onClick={() => applyAspect(1)} className="h-9 rounded-lg border border-[var(--border)] font-semibold">Square</button><button type="button" onClick={() => applyAspect(35 / 45)} className="h-9 rounded-lg border border-[var(--border)] font-semibold">Passport</button><button type="button" onClick={() => applyAspect(2 / 3)} className="h-9 rounded-lg border border-[var(--border)] font-semibold">2 × 3</button></div>
          <p className="mt-4 text-[11.5px] leading-5 text-[var(--ink-2)]">Drag inside the frame to move it. Drag a corner to resize it freely.</p>
          <div className="mt-4 rounded-lg border border-[#f0e3bc] bg-[#fffaed] p-3 text-[11.5px] leading-5 text-[var(--ink-2)]">Cropping is non-destructive. It affects the prepared preview, download, Library save, and Template handoff.</div>
          <button type="button" onClick={() => setCrop(DEFAULT_PHOTO_CROP)} className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg font-semibold hover:bg-[var(--surface-warm)]"><RotateCcw size={14} /> Reset crop</button>
          <div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="h-11 flex-1 rounded-lg border border-[var(--border)] font-semibold">Cancel</button><button type="button" onClick={() => onApply(normalizePhotoCrop(crop))} className="h-11 flex-1 rounded-lg bg-[var(--brand)] font-bold">Apply crop</button></div>
        </aside>
      </div>
    </div>
  </div>;
}
