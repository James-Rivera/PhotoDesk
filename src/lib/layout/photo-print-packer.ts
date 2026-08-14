import type { LayoutItem, LayoutResult, PageMargins, SizePoints } from "./types";

export interface PhotoPrintPackRequest {
  page: SizePoints;
  margins: PageMargins;
  horizontalSpacing: number;
  verticalSpacing: number;
  items: LayoutItem[];
}

interface Shelf {
  y: number;
  height: number;
  usedWidth: number;
  row: number;
}

const EPSILON = 0.0001;

/**
 * Packs mixed, fixed-size photo rectangles into cut-friendly horizontal shelves.
 * Larger/taller photos are considered first, while placement remains deterministic,
 * left-to-right and top-to-bottom. Items are never rotated or resized.
 */
export function arrangePhotoPrints(request: PhotoPrintPackRequest): LayoutResult {
  validate(request);

  const contentWidth = Math.max(0, request.page.width - request.margins.left - request.margins.right);
  const contentHeight = Math.max(0, request.page.height - request.margins.top - request.margins.bottom);
  const rightEdge = request.margins.left + contentWidth;
  const bottomEdge = request.margins.top + contentHeight;
  const shelves: Shelf[] = [];
  const placed: LayoutResult["placed"] = [];
  const overflow: LayoutItem[] = [];

  const sorted = request.items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) =>
      b.item.height - a.item.height
      || b.item.width - a.item.width
      || b.item.width * b.item.height - a.item.width * a.item.height
      || a.originalIndex - b.originalIndex,
    );

  for (const { item } of sorted) {
    if (item.width > contentWidth + EPSILON || item.height > contentHeight + EPSILON) {
      overflow.push(item);
      continue;
    }

    const shelf = shelves.find((candidate) => {
      const spacing = candidate.usedWidth > 0 ? request.horizontalSpacing : 0;
      return item.height <= candidate.height + EPSILON
        && request.margins.left + candidate.usedWidth + spacing + item.width <= rightEdge + EPSILON;
    });

    if (shelf) {
      const spacing = shelf.usedWidth > 0 ? request.horizontalSpacing : 0;
      const x = request.margins.left + shelf.usedWidth + spacing;
      placed.push({ ...item, x, y: shelf.y, row: shelf.row });
      shelf.usedWidth += spacing + item.width;
      continue;
    }

    const previous = shelves.at(-1);
    const y = previous
      ? previous.y + previous.height + request.verticalSpacing
      : request.margins.top;
    if (y + item.height > bottomEdge + EPSILON) {
      overflow.push(item);
      continue;
    }

    const nextShelf: Shelf = { y, height: item.height, usedWidth: item.width, row: shelves.length };
    shelves.push(nextShelf);
    placed.push({ ...item, x: request.margins.left, y, row: nextShelf.row });
  }

  return {
    placed,
    overflow,
    fits: overflow.length === 0,
    content: { width: contentWidth, height: contentHeight },
  };
}

function validate(request: PhotoPrintPackRequest) {
  const measurements = [
    request.page.width,
    request.page.height,
    request.margins.top,
    request.margins.right,
    request.margins.bottom,
    request.margins.left,
    request.horizontalSpacing,
    request.verticalSpacing,
    ...request.items.flatMap((item) => [item.width, item.height]),
  ];
  if (measurements.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("Photo print measurements must be finite and non-negative.");
  }
  if (request.page.width <= 0 || request.page.height <= 0 || request.items.some((item) => item.width <= 0 || item.height <= 0)) {
    throw new RangeError("Page and photo dimensions must be greater than zero.");
  }
}
