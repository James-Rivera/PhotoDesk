import { inchesToPoints } from "./units";

export const A4_WIDTH_POINTS = 595.28;
export const A4_HEIGHT_POINTS = 841.89;
export const TWO_BY_TWO_POINTS = inchesToPoints(2);
export const ONE_BY_ONE_POINTS = inchesToPoints(1);

// Four exact 2x2 photos consume 576 pt of A4's 595.28 pt width. Centering
// that row gives the largest possible equal left/right printer-safe margin.
export const CJNET_NORMAL_EDGE_MARGIN_POINTS = (A4_WIDTH_POINTS - 4 * TWO_BY_TWO_POINTS) / 2;
export const PASSPORT_EDGE_MARGIN_POINTS = CJNET_NORMAL_EDGE_MARGIN_POINTS;

export const A4_PAGE = {
  width: A4_WIDTH_POINTS,
  height: A4_HEIGHT_POINTS,
} as const;
