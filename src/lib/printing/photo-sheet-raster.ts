import { drawCropToCanvas, canvasToPngBytes } from "@/lib/images/crop";
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS } from "@/lib/layout";
import { collectCutGuideSegments, type PhotoSheetPdfOptions } from "@/lib/pdf/photo-sheet";

export const NATIVE_PRINT_DPI = 300;
export const NATIVE_PRINT_WIDTH_PIXELS = pointsToPixels(A4_WIDTH_POINTS);
export const NATIVE_PRINT_HEIGHT_PIXELS = pointsToPixels(A4_HEIGHT_POINTS);

export interface RasterRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pointsToPixels(points: number, dpi = NATIVE_PRINT_DPI) {
  return Math.max(1, Math.round(points * dpi / 72));
}

export function pointRectangleToRaster(rectangle: RasterRectangle, dpi = NATIVE_PRINT_DPI): RasterRectangle {
  const scale = dpi / 72;
  const left = Math.round(rectangle.x * scale);
  const top = Math.round(rectangle.y * scale);
  const right = Math.round((rectangle.x + rectangle.width) * scale);
  const bottom = Math.round((rectangle.y + rectangle.height) * scale);
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export async function generateNativePrintSheet(options: PhotoSheetPdfOptions): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = NATIVE_PRINT_WIDTH_PIXELS;
  canvas.height = NATIVE_PRINT_HEIGHT_PIXELS;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is not available in this browser.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const item of options.layout.placed) {
    const source = options.sources[item.sourceKey] ?? options.sources.big ?? options.sources.primary;
    if (!source) throw new Error(`No photo is available for ${item.sourceKey}.`);
    drawCropToCanvas(
      context,
      source.image,
      pointRectangleToRaster({ x: item.x, y: item.y, width: item.width, height: item.height }),
      source.crop,
      options.backgroundColor ?? null,
    );
  }

  if (options.borders) drawCutGuides(context, options);
  return canvasToPngBytes(canvas);
}

function drawCutGuides(context: CanvasRenderingContext2D, options: PhotoSheetPdfOptions) {
  const scale = NATIVE_PRINT_DPI / 72;
  context.save();
  context.beginPath();
  context.strokeStyle = options.borderColor;
  context.lineWidth = Math.max(1, options.borderThickness * scale);
  context.lineCap = "butt";

  for (const line of collectCutGuideSegments(options.layout)) {
    context.moveTo(line.x1 * scale, (A4_HEIGHT_POINTS - line.y1) * scale);
    context.lineTo(line.x2 * scale, (A4_HEIGHT_POINTS - line.y2) * scale);
  }

  context.stroke();
  context.restore();
}
