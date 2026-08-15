"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser, LoaderCircle, Maximize2, RotateCcw, Undo2, ZoomIn, ZoomOut } from "lucide-react";

type BrushMode = "erase" | "restore";
interface Point { x: number; y: number }
interface Stroke { mode: BrushMode; size: number; points: Point[] }

export function MaskEdgeEditor({ source, cutout, onApply, onCancel }: { source: File; cutout: File; onApply: (file: File) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cutoutBitmapRef = useRef<ImageBitmap | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const [mode, setMode] = useState<BrushMode>("erase");
  const [size, setSize] = useState(36);
  const [strokeCount, setStrokeCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
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

  useEffect(() => {
    let active = true;
    let sourceBitmap: ImageBitmap | null = null;
    let cutoutBitmap: ImageBitmap | null = null;
    void Promise.all([createImageBitmap(source), createImageBitmap(cutout)]).then(([original, foreground]) => {
      sourceBitmap = original; cutoutBitmap = foreground;
      if (!active) {
        original.close();
        foreground.close();
        sourceBitmap = null;
        cutoutBitmap = null;
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = foreground.width; canvas.height = foreground.height;
      setImageSize({ width: foreground.width, height: foreground.height });
      setZoom(100);
      const originalCanvas = document.createElement("canvas");
      originalCanvas.width = foreground.width; originalCanvas.height = foreground.height;
      const originalContext = originalCanvas.getContext("2d");
      const context = canvas.getContext("2d");
      if (!originalContext || !context) return;
      originalContext.drawImage(original, 0, 0, foreground.width, foreground.height);
      context.drawImage(foreground, 0, 0);
      originalCanvasRef.current = originalCanvas;
      cutoutBitmapRef.current = foreground;
      strokesRef.current = [];
      setStrokeCount(0);
      setReady(true);
    });
    return () => {
      active = false;
      sourceBitmap?.close();
      cutoutBitmap?.close();
      originalCanvasRef.current = null;
      cutoutBitmapRef.current = null;
    };
  }, [cutout, source]);

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    const stroke = { mode, size, points: [point] } satisfies Stroke;
    strokesRef.current.push(stroke);
    activeStrokeRef.current = stroke;
    drawSegment(stroke, point, point);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    const point = canvasPoint(event);
    const previous = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    drawSegment(stroke, previous, point);
  }

  function pointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    activeStrokeRef.current = null;
    setStrokeCount(strokesRef.current.length);
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  }

  function drawSegment(stroke: Stroke, from: Point, to: Point) {
    const canvas = canvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !originalCanvas || !context) return;
    context.save();
    context.lineCap = "round"; context.lineJoin = "round"; context.lineWidth = stroke.size;
    if (stroke.mode === "erase") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "#000";
    } else {
      const pattern = context.createPattern(originalCanvas, "no-repeat");
      if (!pattern) { context.restore(); return; }
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = pattern;
    }
    context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
    context.restore();
  }

  function redraw() {
    const canvas = canvasRef.current;
    const bitmap = cutoutBitmapRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !bitmap || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    for (const stroke of strokesRef.current) {
      for (let index = 0; index < stroke.points.length; index += 1) {
        drawSegment(stroke, stroke.points[Math.max(0, index - 1)], stroke.points[index]);
      }
    }
    setStrokeCount(strokesRef.current.length);
  }

  function undo() {
    strokesRef.current.pop();
    redraw();
  }

  function reset() {
    strokesRef.current = [];
    redraw();
  }

  async function apply() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not save the corrected mask.")), "image/png"));
      onApply(new File([blob], cutout.name, { type: "image/png" }));
    } finally { setSaving(false); }
  }

  const fitScale = Math.min(
    Math.max(1, viewportSize.width - 24) / imageSize.width,
    Math.max(1, viewportSize.height - 24) / imageSize.height,
  );
  const displayWidth = Math.max(1, Math.round(imageSize.width * fitScale * zoom / 100));
  const displayHeight = Math.max(1, Math.round(imageSize.height * fitScale * zoom / 100));

  return <div className="flex h-full min-h-0 w-full max-w-[980px] flex-col pt-12">
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-2 shadow-sm">
      <button type="button" onClick={() => setMode("erase")} className={`flex h-9 items-center gap-2 rounded-lg px-3 font-semibold ${mode === "erase" ? "bg-[var(--ink)] text-white" : "hover:bg-[var(--surface-warm)]"}`}><Eraser size={15} /> Erase</button>
      <button type="button" onClick={() => setMode("restore")} className={`h-9 rounded-lg px-3 font-semibold ${mode === "restore" ? "bg-[var(--ink)] text-white" : "hover:bg-[var(--surface-warm)]"}`}>Restore</button>
      <label className="flex items-center gap-2 px-2 text-[11px] font-semibold">Brush <input type="range" min={8} max={120} value={size} onChange={(event) => setSize(Number(event.target.value))} className="w-28 accent-[var(--brand)]" /><span className="measurement w-9">{size}px</span></label>
      <button type="button" disabled={!strokeCount} onClick={undo} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-warm)] disabled:opacity-35" aria-label="Undo last edge correction"><Undo2 size={15} /></button>
      <button type="button" disabled={!strokeCount} onClick={reset} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-warm)] disabled:opacity-35" aria-label="Reset edge corrections"><RotateCcw size={15} /></button>
      <span className="mx-1 h-6 w-px bg-[var(--divider)]" />
      <button type="button" onClick={() => setZoom((current) => Math.max(50, current - 25))} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-warm)]" aria-label="Zoom edge editor out"><ZoomOut size={15} /></button>
      <span className="measurement min-w-10 text-center text-[10.5px]">{zoom}%</span>
      <button type="button" onClick={() => setZoom((current) => Math.min(300, current + 25))} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-warm)]" aria-label="Zoom edge editor in"><ZoomIn size={15} /></button>
      <button type="button" onClick={() => setZoom(100)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-warm)]" aria-label="Fit image in edge editor"><Maximize2 size={14} /></button>
    </div>
    <div ref={viewportRef} className="checkerboard relative min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border-soft)]">
      <div className="flex min-h-full min-w-full items-center justify-center p-3" style={{ width: Math.max(viewportSize.width, displayWidth + 24), height: Math.max(viewportSize.height, displayHeight + 24) }}>
        <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className="shrink-0 touch-none cursor-crosshair" style={{ width: displayWidth, height: displayHeight }} aria-label="Background edge correction canvas" />
      </div>
      {!ready && <span className="absolute inset-0 grid place-items-center"><LoaderCircle className="animate-spin" size={26} /></span>}
    </div>
    <div className="flex shrink-0 items-center justify-between gap-3 py-3"><p className="text-[11.5px] text-[var(--ink-3)]">Erase leftover background or restore original hair, ears, and clothing.</p><div className="flex shrink-0 gap-2"><button type="button" disabled={saving} onClick={onCancel} className="h-10 rounded-lg border border-[var(--border)] bg-white px-4 font-semibold">Cancel</button><button type="button" disabled={!ready || saving} onClick={() => void apply()} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 font-bold disabled:opacity-50">{saving && <LoaderCircle className="animate-spin" size={15} />} Done</button></div></div>
  </div>;
}
