import type { DashboardRangePreset } from '../../dashboard-page/dashboard-page.model';

export interface RangePresetOption {
  readonly value: DashboardRangePreset;
  readonly label: string;
  readonly description: string;
}

export const DASHBOARD_RANGE_OPTIONS: readonly RangePresetOption[] = [
  { value: 'today', label: 'Today', description: 'Activity recorded so far today' },
  { value: 'week', label: 'Last 7 days', description: 'A rolling week including today' },
  { value: 'month', label: 'Last 30 days', description: 'A rolling month including today' },
  { value: 'custom', label: 'Custom', description: 'Pick your own start and end date' },
];
