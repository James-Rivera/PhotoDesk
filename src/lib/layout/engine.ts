import type { LayoutRequest, LayoutResult, PlacedItem } from "./types";

const EPSILON = 0.0001;

function assertValidRequest(request: LayoutRequest) {
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
    throw new RangeError("Layout measurements must be finite and non-negative.");
  }
  if (request.page.width <= 0 || request.page.height <= 0) {
    throw new RangeError("Page dimensions must be greater than zero.");
  }
}

export function arrangeOnPage(request: LayoutRequest): LayoutResult {
  assertValidRequest(request);

  const left = request.margins.left;
  const top = request.margins.top;
  const rightEdge = request.page.width - request.margins.right;
  const bottomEdge = request.page.height - request.margins.bottom;
  const contentWidth = Math.max(0, rightEdge - left);
  const contentHeight = Math.max(0, bottomEdge - top);

  const placed: PlacedItem[] = [];
  const overflow = [];
  let x = left;
  let y = top;
  let rowHeight = 0;
  let row = 0;

  for (const item of request.items) {
    const hasItemsInRow = x > left + EPSILON;
    const mustWrap =
      (item.rowBreakBefore && hasItemsInRow) ||
      (hasItemsInRow && x + item.width > rightEdge + EPSILON);

    if (mustWrap) {
      x = left;
      y += rowHeight + request.verticalSpacing;
      rowHeight = 0;
      row += 1;
    }

    const fitsWidth = item.width <= contentWidth + EPSILON;
    const fitsHeight = y + item.height <= bottomEdge + EPSILON;

    if (!fitsWidth || !fitsHeight) {
      overflow.push(item);
      continue;
    }

    placed.push({ ...item, x, y, row });
    x += item.width + request.horizontalSpacing;
    rowHeight = Math.max(rowHeight, item.height);
  }

  return {
    placed,
    overflow,
    fits: overflow.length === 0,
    content: { width: contentWidth, height: contentHeight },
  };
}
