export interface PhotoCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_PHOTO_CROP: PhotoCrop = { x: 0, y: 0, width: 1, height: 1 };
export const MIN_PHOTO_CROP_SIZE = 0.05;

export function normalizePhotoCrop(value: PhotoCrop): PhotoCrop {
  const width = clamp(value.width, MIN_PHOTO_CROP_SIZE, 1);
  const height = clamp(value.height, MIN_PHOTO_CROP_SIZE, 1);
  return {
    x: clamp(value.x, 0, 1 - width),
    y: clamp(value.y, 0, 1 - height),
    width,
    height,
  };
}

export function photoCropToPixels(value: PhotoCrop, imageWidth: number, imageHeight: number): PixelCrop {
  const crop = normalizePhotoCrop(value);
  const x = Math.min(imageWidth - 1, Math.max(0, Math.round(crop.x * imageWidth)));
  const y = Math.min(imageHeight - 1, Math.max(0, Math.round(crop.y * imageHeight)));
  const width = Math.max(1, Math.min(imageWidth - x, Math.round(crop.width * imageWidth)));
  const height = Math.max(1, Math.min(imageHeight - y, Math.round(crop.height * imageHeight)));
  return { x, y, width, height };
}

export function centeredPhotoCropForAspect(imageWidth: number, imageHeight: number, targetAspect: number): PhotoCrop {
  if (imageWidth <= 0 || imageHeight <= 0 || targetAspect <= 0) return DEFAULT_PHOTO_CROP;
  const sourceAspect = imageWidth / imageHeight;
  if (sourceAspect > targetAspect) {
    const width = targetAspect / sourceAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = sourceAspect / targetAspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

export function isPhotoCropped(value: PhotoCrop) {
  const crop = normalizePhotoCrop(value);
  return crop.x > 0.0001 || crop.y > 0.0001 || crop.width < 0.9999 || crop.height < 0.9999;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
