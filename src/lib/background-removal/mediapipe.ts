import type { BackgroundRemovalProvider, BackgroundRemovalProgress } from "./types";

const VERSION = "0.10.35";
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const MODEL_CACHE = "cjnet-background-model-v1";

type Segmenter = import("@mediapipe/tasks-vision").ImageSegmenter;
let segmenterPromise: Promise<Segmenter> | null = null;

export const mediaPipeBackgroundRemovalProvider: BackgroundRemovalProvider = {
  id: "mediapipe-selfie-segmenter",
  name: "MediaPipe Selfie Segmenter",
  async remove(file, onProgress) {
    onProgress(progress("runtime", 4, "Loading the local image engine…"));
    const segmenter = await getSegmenter(onProgress);
    onProgress(progress("processing", 82, "Finding the person in the photo…"));
    const bitmap = await createImageBitmap(file);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      let maskData: Float32Array | null = null;
      let maskWidth = 0;
      let maskHeight = 0;
      segmenter.segment(bitmap, (result) => {
        const mask = result.confidenceMasks?.[0];
        if (!mask) return;
        maskData = Float32Array.from(mask.getAsFloat32Array());
        maskWidth = mask.width;
        maskHeight = mask.height;
      });
      if (!maskData || !maskWidth || !maskHeight) throw new Error("The model did not produce a person mask.");
      onProgress(progress("finishing", 94, "Preparing the transparent PNG…"));
      return await applyMask(bitmap, maskData, maskWidth, maskHeight);
    } finally { bitmap.close(); }
  },
};

function getSegmenter(onProgress: (progress: BackgroundRemovalProgress) => void) {
  if (!segmenterPromise) segmenterPromise = createSegmenter(onProgress).catch((error) => { segmenterPromise = null; throw error; });
  return segmenterPromise;
}

async function createSegmenter(onProgress: (progress: BackgroundRemovalProgress) => void) {
  const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  onProgress(progress("model", 12, "Downloading the person-detection model…"));
  const model = await loadCachedModel((loaded, total) => {
    const ratio = total ? loaded / total : Math.min(loaded / 3_000_000, 1);
    onProgress(progress("model", 12 + Math.round(ratio * 62), total ? `Downloading model… ${Math.round(ratio * 100)}%` : "Downloading model…"));
  });
  onProgress(progress("model", 76, "Starting the person-detection model…"));
  const options = { runningMode: "IMAGE" as const, outputConfidenceMasks: true, outputCategoryMask: false };
  try {
    return await ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { modelAssetBuffer: model, delegate: "GPU" } });
  } catch {
    onProgress(progress("model", 78, "Graphics acceleration is unavailable. Starting compatible mode…"));
    return ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { modelAssetBuffer: model, delegate: "CPU" } });
  }
}

async function loadCachedModel(onDownload: (loaded: number, total: number) => void) {
  const cache = "caches" in window ? await caches.open(MODEL_CACHE) : null;
  const cached = await cache?.match(MODEL_URL);
  if (cached) { onDownload(1, 1); return new Uint8Array(await cached.arrayBuffer()); }
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error("The background-removal model could not be downloaded.");
  const cacheCopy = response.clone();
  const total = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length; onDownload(loaded, total);
  }
  await cache?.put(MODEL_URL, cacheCopy);
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function applyMask(image: ImageBitmap, mask: Float32Array, maskWidth: number, maskHeight: number) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskWidth; maskCanvas.height = maskHeight;
  const maskContext = maskCanvas.getContext("2d");
  if (!maskContext) throw new Error("Canvas is not available in this browser.");
  const pixels = maskContext.createImageData(maskWidth, maskHeight);
  for (let index = 0; index < mask.length; index += 1) {
    const alpha = Math.max(0, Math.min(255, Math.round(mask[index] * 255)));
    const pixel = index * 4;
    pixels.data[pixel] = 255; pixels.data[pixel + 1] = 255; pixels.data[pixel + 2] = 255; pixels.data[pixel + 3] = alpha;
  }
  maskContext.putImageData(pixels, 0, 0);
  const output = document.createElement("canvas");
  output.width = image.width; output.height = image.height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "destination-in";
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(maskCanvas, 0, 0, output.width, output.height);
  return new Promise<Blob>((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The transparent PNG could not be created.")), "image/png"));
}

function progress(stage: BackgroundRemovalProgress["stage"], percent: number, message: string): BackgroundRemovalProgress { return { stage, percent, message }; }
