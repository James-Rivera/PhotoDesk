export interface PhotoAdjustments {
  exposure: number;
  contrast: number;
  blackPoint: number;
  midtone: number;
  whitePoint: number;
  outputBlack: number;
  outputWhite: number;
  warmth: number;
  tint: number;
  saturation: number;
  sharpness: number;
}

export interface PhotoHistogram {
  red: Uint32Array;
  green: Uint32Array;
  blue: Uint32Array;
  luminance: Uint32Array;
  pixelCount: number;
}

export const DEFAULT_PHOTO_ADJUSTMENTS: PhotoAdjustments = {
  exposure: 0,
  contrast: 0,
  blackPoint: 0,
  midtone: 1,
  whitePoint: 255,
  outputBlack: 0,
  outputWhite: 255,
  warmth: 0,
  tint: 0,
  saturation: 0,
  sharpness: 0,
};

export function hasPhotoAdjustments(value: PhotoAdjustments) {
  return (Object.keys(DEFAULT_PHOTO_ADJUSTMENTS) as Array<keyof PhotoAdjustments>)
    .some((key) => value[key] !== DEFAULT_PHOTO_ADJUSTMENTS[key]);
}

export function computePhotoHistogram(pixels: Uint8ClampedArray, width: number, height: number): PhotoHistogram {
  if (pixels.length !== width * height * 4) throw new Error("Pixel data does not match the image dimensions.");
  const red = new Uint32Array(256);
  const green = new Uint32Array(256);
  const blue = new Uint32Array(256);
  const luminance = new Uint32Array(256);
  let pixelCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const redValue = pixels[index];
    const greenValue = pixels[index + 1];
    const blueValue = pixels[index + 2];
    red[redValue] += 1;
    green[greenValue] += 1;
    blue[blueValue] += 1;
    luminance[Math.round(redValue * 0.2126 + greenValue * 0.7152 + blueValue * 0.0722)] += 1;
    pixelCount += 1;
  }

  return { red, green, blue, luminance, pixelCount };
}

export function computeAutoLevels(histogram: PhotoHistogram): Pick<PhotoAdjustments, "blackPoint" | "midtone" | "whitePoint" | "outputBlack" | "outputWhite"> {
  if (histogram.pixelCount === 0) {
    return {
      blackPoint: DEFAULT_PHOTO_ADJUSTMENTS.blackPoint,
      midtone: DEFAULT_PHOTO_ADJUSTMENTS.midtone,
      whitePoint: DEFAULT_PHOTO_ADJUSTMENTS.whitePoint,
      outputBlack: DEFAULT_PHOTO_ADJUSTMENTS.outputBlack,
      outputWhite: DEFAULT_PHOTO_ADJUSTMENTS.outputWhite,
    };
  }

  // Clip only the outer 0.5% of visible luminance values, then apply a tightly
  // bounded midpoint correction. This avoids the aggressive shifts common in
  // one-click enhancement while still correcting flat ID-photo captures.
  const blackPoint = Math.min(40, histogramPercentile(histogram.luminance, histogram.pixelCount, 0.005));
  const whitePoint = Math.max(215, histogramPercentile(histogram.luminance, histogram.pixelCount, 0.995));
  const median = histogramPercentile(histogram.luminance, histogram.pixelCount, 0.5);
  const normalizedMedian = Math.max(0.01, Math.min(0.99, (median - blackPoint) / Math.max(1, whitePoint - blackPoint)));
  const midtone = Math.max(0.8, Math.min(1.25, Math.log(normalizedMedian) / Math.log(0.5)));

  return {
    blackPoint,
    midtone: Math.round(midtone * 100) / 100,
    whitePoint,
    outputBlack: 0,
    outputWhite: 255,
  };
}

export function applyPhotoAdjustmentsPixels(pixels: Uint8ClampedArray, width: number, height: number, adjustments: PhotoAdjustments) {
  if (pixels.length !== width * height * 4) throw new Error("Pixel data does not match the image dimensions.");
  const range = Math.max(1, adjustments.whitePoint - adjustments.blackPoint);
  const exposure = 2 ** adjustments.exposure;
  const contrast = 1 + adjustments.contrast / 100;
  const gamma = Math.max(0.2, adjustments.midtone);
  const saturation = 1 + adjustments.saturation / 100;
  const warmth = adjustments.warmth * 0.45;
  const tint = adjustments.tint * 0.3;
  const outputRange = Math.max(1, adjustments.outputWhite - adjustments.outputBlack);

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    let red = correctChannel(pixels[index], adjustments.blackPoint, range, gamma, exposure, contrast);
    let green = correctChannel(pixels[index + 1], adjustments.blackPoint, range, gamma, exposure, contrast);
    let blue = correctChannel(pixels[index + 2], adjustments.blackPoint, range, gamma, exposure, contrast);

    red += warmth + tint * 0.35;
    green -= tint;
    blue -= warmth;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    pixels[index] = applyOutputLevels(luminance + (red - luminance) * saturation, adjustments.outputBlack, outputRange);
    pixels[index + 1] = applyOutputLevels(luminance + (green - luminance) * saturation, adjustments.outputBlack, outputRange);
    pixels[index + 2] = applyOutputLevels(luminance + (blue - luminance) * saturation, adjustments.outputBlack, outputRange);
  }

  if (adjustments.sharpness > 0 && width > 2 && height > 2) sharpenPixels(pixels, width, height, adjustments.sharpness / 100);
}

export async function renderAdjustedPhoto(file: File, adjustments: PhotoAdjustments, options: { maxDimension?: number; backgroundColor?: string | null } = {}) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = options.maxDimension && Math.max(bitmap.width, bitmap.height) > options.maxDimension
      ? options.maxDimension / Math.max(bitmap.width, bitmap.height)
      : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    applyPhotoAdjustmentsPixels(imageData.data, width, height, adjustments);
    context.putImageData(imageData, 0, 0);

    if (options.backgroundColor) {
      const foreground = document.createElement("canvas");
      foreground.width = width; foreground.height = height;
      foreground.getContext("2d")?.drawImage(canvas, 0, 0);
      context.globalCompositeOperation = "copy";
      context.fillStyle = options.backgroundColor;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      context.drawImage(foreground, 0, 0);
    }
    return await canvasToPng(canvas);
  } finally {
    bitmap.close();
  }
}

function correctChannel(channel: number, blackPoint: number, range: number, gamma: number, exposure: number, contrast: number) {
  const leveled = Math.max(0, Math.min(1, (channel - blackPoint) / range));
  const corrected = Math.pow(leveled, 1 / gamma) * exposure;
  return ((corrected - 0.5) * contrast + 0.5) * 255;
}

function histogramPercentile(values: Uint32Array, pixelCount: number, percentile: number) {
  const target = Math.max(1, Math.ceil(pixelCount * percentile));
  let cumulative = 0;
  for (let value = 0; value < values.length; value += 1) {
    cumulative += values[value];
    if (cumulative >= target) return value;
  }
  return 255;
}

function applyOutputLevels(value: number, outputBlack: number, outputRange: number) {
  return clampByte(outputBlack + (Math.max(0, Math.min(255, value)) / 255) * outputRange);
}

function sharpenPixels(pixels: Uint8ClampedArray, width: number, height: number, amount: number) {
  const source = new Uint8ClampedArray(pixels);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      if (source[index + 3] === 0) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel];
        const neighbor = (offset: number) => source[index + offset + 3] === 0 ? center : source[index + offset + channel];
        const value = center * (1 + amount * 4)
          - amount * (neighbor(-width * 4) + neighbor(width * 4) + neighbor(-4) + neighbor(4));
        pixels[index + channel] = clampByte(value);
      }
    }
  }
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("The processed PNG could not be created.")),
    "image/png",
  ));
}
