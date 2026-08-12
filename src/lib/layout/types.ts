export interface SizePoints {
  width: number;
  height: number;
}

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutItem extends SizePoints {
  id: string;
  sourceKey: string;
  rowBreakBefore?: boolean;
}

export interface PlacedItem extends LayoutItem {
  x: number;
  y: number;
  row: number;
}

export interface LayoutRequest {
  page: SizePoints;
  margins: PageMargins;
  horizontalSpacing: number;
  verticalSpacing: number;
  items: LayoutItem[];
}

export interface LayoutResult {
  placed: PlacedItem[];
  overflow: LayoutItem[];
  fits: boolean;
  content: SizePoints;
}
