import { toPoints, type PhysicalUnit } from "./units";

export type PhotoPrintSizeId = "cute" | "2r" | "3r" | "4r" | "5r" | "6r" | "8r" | "cr80" | "custom";
export type PhotoPrintOrientation = "portrait" | "landscape";

export interface PhotoPrintSizeDefinition {
  id: Exclude<PhotoPrintSizeId, "custom">;
  label: string;
  width: number;
  height: number;
  unit: PhysicalUnit;
  note: string;
}

export const PHOTO_PRINT_SIZES: readonly PhotoPrintSizeDefinition[] = [
  { id: "cr80", label: "CR80 / Wallet ID", width: 53.98, height: 85.6, unit: "mm", note: "53.98 × 85.60 mm" },
  { id: "cute", label: "Cute Size", width: 2, height: 3, unit: "in", note: "2 × 3 in" },
  { id: "2r", label: "2R Photo", width: 2.5, height: 3.5, unit: "in", note: "2.5 × 3.5 in" },
  { id: "3r", label: "3R", width: 3.5, height: 5, unit: "in", note: "3.5 × 5 in" },
  { id: "4r", label: "4R", width: 4, height: 6, unit: "in", note: "4 × 6 in" },
  { id: "5r", label: "5R", width: 5, height: 7, unit: "in", note: "5 × 7 in" },
  { id: "6r", label: "6R", width: 6, height: 8, unit: "in", note: "6 × 8 in" },
  { id: "8r", label: "8R", width: 8, height: 10, unit: "in", note: "8 × 10 in" },
] as const;

export function getPhotoPrintSize(id: Exclude<PhotoPrintSizeId, "custom">) {
  const definition = PHOTO_PRINT_SIZES.find((size) => size.id === id);
  if (!definition) throw new RangeError(`Unknown photo print size: ${id}`);
  return definition;
}

export function photoPrintSizeToPoints(id: Exclude<PhotoPrintSizeId, "custom">, orientation: PhotoPrintOrientation) {
  const definition = getPhotoPrintSize(id);
  const width = toPoints(definition.width, definition.unit);
  const height = toPoints(definition.height, definition.unit);
  return orientation === "portrait" ? { width, height } : { width: height, height: width };
}
