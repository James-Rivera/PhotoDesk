export type FitMode = "cover" | "contain";

export interface CropTransform {
  zoom: number;
  dx: number;
  dy: number;
  fitMode: FitMode;
}

export const DEFAULT_CROP: CropTransform = {
  zoom: 100,
  dx: 0,
  dy: 0,
  fitMode: "cover",
};

export function cropTransformStyle(crop: CropTransform) {
  return {
    objectFit: crop.fitMode,
    transform: `scale(${crop.zoom / 100}) translate(${crop.dx}%, ${crop.dy}%)`,
    transformOrigin: "center",
  } as const;
}

export async function renderCropToPng(
  image: HTMLImageElement,
  widthPoints: number,
  heightPoints: number,
  crop: CropTransform,
  dpi = 300,
  backgroundColor: string | null = null,
): Promise<Uint8Array> {
  const width = Math.max(1, Math.round((widthPoints / 72) * dpi));
  const height = Math.max(1, Math.round((heightPoints / 72) * dpi));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas is not available in this browser.");

  drawCropToCanvas(context, image, { x: 0, y: 0, width, height }, crop, backgroundColor);

  return canvasToPngBytes(canvas);
}

export interface CanvasCropRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawCropToCanvas(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rectangle: CanvasCropRectangle,
  crop: CropTransform,
  backgroundColor: string | null = null,
) {
  const { x, y, width, height } = rectangle;
  if (width <= 0 || height <= 0) return;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(x, y, width, height);
  }

  const baseScale = crop.fitMode === "cover"
    ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
    : Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * baseScale;
  const renderedHeight = image.naturalHeight * baseScale;
  const zoom = crop.zoom / 100;

  context.translate(x + width / 2, y + height / 2);
  context.scale(zoom, zoom);
  context.translate((crop.dx / 100) * width, (crop.dy / 100) * height);
  context.drawImage(image, -renderedWidth / 2, -renderedHeight / 2, renderedWidth, renderedHeight);
  context.restore();
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not prepare the print image.")), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}
