import { inchesToPoints } from "./units";

export const A4_WIDTH_POINTS = 595.28;
export const A4_HEIGHT_POINTS = 841.89;
export const TWO_BY_TWO_POINTS = inchesToPoints(2);
export const ONE_BY_ONE_POINTS = inchesToPoints(1);

export const A4_PAGE = {
  width: A4_WIDTH_POINTS,
  height: A4_HEIGHT_POINTS,
} as const;
