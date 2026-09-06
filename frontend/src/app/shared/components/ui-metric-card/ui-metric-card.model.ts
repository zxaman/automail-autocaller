import type { UiIconName } from '../ui-icon/ui-icon.model';

export type MetricTrendDirection = 'up' | 'down' | 'flat';

export interface MetricTrend {
  readonly direction: MetricTrendDirection;
  readonly label: string;
}

export interface MetricCardData {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly icon: UiIconName;
  readonly context?: string;
  readonly trend?: MetricTrend;
}
