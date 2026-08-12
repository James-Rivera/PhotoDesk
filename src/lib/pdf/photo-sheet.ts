import { PDFDocument, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS, type LayoutResult } from "@/lib/layout";
import { renderCropToPng, type CropTransform } from "@/lib/images/crop";

export interface PdfPhotoSource {
  image: HTMLImageElement;
  crop: CropTransform;
}

export interface PhotoSheetPdfOptions {
  layout: LayoutResult;
  sources: Record<string, PdfPhotoSource>;
  borders: boolean;
  borderColor: string;
  borderThickness: number;
  backgroundColor?: string | null;
}

export async function createExactA4Document(): Promise<PDFDocument> {
  const document = await PDFDocument.create();
  document.addPage([A4_WIDTH_POINTS, A4_HEIGHT_POINTS]);
  return document;
}

export async function generatePhotoSheetPdf(options: PhotoSheetPdfOptions): Promise<Uint8Array> {
  const document = await createExactA4Document();
  document.setTitle("CJNET PhotoDesk A4 Photo Sheet");
  document.setCreator("CJNET PhotoDesk");
  const page = document.getPage(0);
  const embedded = new Map<string, PDFImage>();

  for (const item of options.layout.placed) {
    const source = options.sources[item.sourceKey] ?? options.sources.big ?? options.sources.primary;
    if (!source) throw new Error(`No photo is available for ${item.sourceKey}.`);
    const key = [item.sourceKey, item.width, item.height, source.crop.zoom, source.crop.dx, source.crop.dy, source.crop.fitMode].join(":");
    let pdfImage = embedded.get(key);
    if (!pdfImage) {
      const pngBytes = await renderCropToPng(source.image, item.width, item.height, source.crop, 300, options.backgroundColor ?? null);
      pdfImage = await document.embedPng(pngBytes);
      embedded.set(key, pdfImage);
    }
    page.drawImage(pdfImage, {
      x: item.x,
      y: A4_HEIGHT_POINTS - item.y - item.height,
      width: item.width,
      height: item.height,
    });
  }

  if (options.borders) drawSharedCutGuides(page, options.layout, options.borderColor, options.borderThickness);
  return document.save();
}

function drawSharedCutGuides(page: PDFPage, layout: LayoutResult, colorValue: string, thickness: number) {
  const color = hexToRgb(colorValue);
  for (const line of collectCutGuideSegments(layout)) {
    page.drawLine({
      start: { x: line.x1, y: line.y1 },
      end: { x: line.x2, y: line.y2 },
      thickness,
      color: rgb(color.r, color.g, color.b),
    });
  }
}

export interface CutGuideSegment { x1: number; y1: number; x2: number; y2: number }

export function collectCutGuideSegments(layout: LayoutResult): CutGuideSegment[] {
  const horizontal = new Map<string, Array<[number, number]>>();
  const vertical = new Map<string, Array<[number, number]>>();
  const add = (groups: Map<string, Array<[number, number]>>, coordinate: number, start: number, end: number) => {
    const key = coordinate.toFixed(4);
    const intervals = groups.get(key) ?? [];
    intervals.push([Math.min(start, end), Math.max(start, end)]);
    groups.set(key, intervals);
  };

  for (const item of layout.placed) {
    const left = item.x;
    const right = item.x + item.width;
    const top = A4_HEIGHT_POINTS - item.y;
    const bottom = top - item.height;
    add(horizontal, top, left, right);
    add(horizontal, bottom, left, right);
    add(vertical, left, bottom, top);
    add(vertical, right, bottom, top);
  }

  const segments: CutGuideSegment[] = [];
  for (const [coordinate, intervals] of horizontal) {
    for (const [start, end] of mergeIntervals(intervals)) segments.push({ x1: start, y1: Number(coordinate), x2: end, y2: Number(coordinate) });
  }
  for (const [coordinate, intervals] of vertical) {
    for (const [start, end] of mergeIntervals(intervals)) segments.push({ x1: Number(coordinate), y1: start, x2: Number(coordinate), y2: end });
  }
  return segments;
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval[0] > previous[1] + 0.0001) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return merged;
}

function hexToRgb(value: string) {
  const normalized = value.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return { r: 185 / 255, g: 178 / 255, b: 162 / 255 };
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
}
