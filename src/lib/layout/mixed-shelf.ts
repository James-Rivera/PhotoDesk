import type { LayoutItem, LayoutResult, PageMargins, SizePoints } from "./types";

export interface MixedShelfRequest {
  page: SizePoints;
  margins: PageMargins;
  big: SizePoints;
  small: SizePoints;
  bigQuantity: number;
  smallQuantity: number;
  bigSourceKey?: string;
  smallSourceKey?: string;
}

interface Shelf { y: number; height: number; usedWidth: number; row: number }

export function arrangeMixedShelves(request: MixedShelfRequest): LayoutResult {
  validate(request);
  const left = request.margins.left;
  const top = request.margins.top;
  const contentWidth = Math.max(0, request.page.width - request.margins.left - request.margins.right);
  const contentHeight = Math.max(0, request.page.height - request.margins.top - request.margins.bottom);
  const bottom = top + contentHeight;
  const placed: LayoutResult["placed"] = [];
  const shelves: Shelf[] = [];
  let remainingBig = request.bigQuantity;
  let remainingSmall = request.smallQuantity;
  let y = top;
  let row = 0;

  const bigPerRow = Math.floor(contentWidth / request.big.width);
  while (remainingBig > 0 && bigPerRow > 0 && y + request.big.height <= bottom + 0.0001) {
    const count = Math.min(remainingBig, bigPerRow);
    for (let column = 0; column < count; column += 1) {
      placed.push({ id: `big-${request.bigQuantity - remainingBig + column}`, sourceKey: request.bigSourceKey ?? "big", ...request.big, x: left + column * request.big.width, y, row });
    }
    shelves.push({ y, height: request.big.height, usedWidth: count * request.big.width, row });
    remainingBig -= count;
    y += request.big.height;
    row += 1;
  }

  for (const shelf of shelves) {
    if (remainingSmall <= 0) break;
    const columns = Math.floor((contentWidth - shelf.usedWidth) / request.small.width);
    const rows = Math.floor(shelf.height / request.small.height);
    if (columns <= 0 || rows <= 0) continue;
    for (let smallRow = 0; smallRow < rows && remainingSmall > 0; smallRow += 1) {
      for (let column = 0; column < columns && remainingSmall > 0; column += 1) {
        placed.push({
          id: `small-${request.smallQuantity - remainingSmall}`,
          sourceKey: request.smallSourceKey ?? "small",
          ...request.small,
          x: left + shelf.usedWidth + column * request.small.width,
          y: shelf.y + smallRow * request.small.height,
          row: shelf.row,
        });
        remainingSmall -= 1;
      }
    }
  }

  const smallPerRow = Math.floor(contentWidth / request.small.width);
  while (remainingSmall > 0 && smallPerRow > 0 && y + request.small.height <= bottom + 0.0001) {
    const count = Math.min(remainingSmall, smallPerRow);
    for (let column = 0; column < count; column += 1) {
      placed.push({ id: `small-${request.smallQuantity - remainingSmall + column}`, sourceKey: request.smallSourceKey ?? "small", ...request.small, x: left + column * request.small.width, y, row });
    }
    remainingSmall -= count;
    y += request.small.height;
    row += 1;
  }

  const overflow: LayoutItem[] = [
    ...Array.from({ length: remainingBig }, (_, index) => ({ id: `big-overflow-${index}`, sourceKey: request.bigSourceKey ?? "big", ...request.big })),
    ...Array.from({ length: remainingSmall }, (_, index) => ({ id: `small-overflow-${index}`, sourceKey: request.smallSourceKey ?? "small", ...request.small })),
  ];
  return { placed, overflow, fits: overflow.length === 0, content: { width: contentWidth, height: contentHeight } };
}

export function maximumSmallCopies(request: Omit<MixedShelfRequest, "smallQuantity">): number {
  const probe = arrangeMixedShelves({ ...request, smallQuantity: 10_000 });
  return probe.placed.filter((item) => item.sourceKey === (request.smallSourceKey ?? "small")).length;
}

function validate(request: MixedShelfRequest) {
  const values = [request.page.width, request.page.height, request.big.width, request.big.height, request.small.width, request.small.height, request.bigQuantity, request.smallQuantity, request.margins.top, request.margins.right, request.margins.bottom, request.margins.left];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new RangeError("Mixed layout measurements and quantities must be finite and non-negative.");
  if (request.page.width <= 0 || request.page.height <= 0 || request.big.width <= 0 || request.big.height <= 0 || request.small.width <= 0 || request.small.height <= 0) throw new RangeError("Page and photo dimensions must be greater than zero.");
}
