/** Geometry for one bar pair, precomputed so the template stays declarative. */
export interface ActivityChartBar {
  readonly date: string;
  readonly label: string;
  readonly calls: number;
  readonly emails: number;
  readonly x: number;
  readonly callsY: number;
  readonly callsHeight: number;
  readonly emailsY: number;
  readonly emailsHeight: number;
  readonly barWidth: number;
  readonly tooltip: string;
}

export interface ActivityChartGridLine {
  readonly y: number;
  readonly value: number;
}

export interface ActivityChartViewModel {
  readonly width: number;
  readonly height: number;
  readonly bars: readonly ActivityChartBar[];
  readonly gridLines: readonly ActivityChartGridLine[];
  readonly maxValue: number;
  readonly isEmpty: boolean;
}
