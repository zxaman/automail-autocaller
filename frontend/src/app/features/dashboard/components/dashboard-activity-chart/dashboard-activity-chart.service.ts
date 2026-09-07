import { Injectable } from '@angular/core';

import type { DashboardActivityPoint } from '../../dashboard-page/dashboard-page.model';
import type {
  ActivityChartBar,
  ActivityChartGridLine,
  ActivityChartViewModel,
} from './dashboard-activity-chart.model';

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const GRID_LINES = 4;

/**
 * Turns a daily activity series into SVG geometry.
 *
 * Kept as a pure, injectable service so the maths is unit-testable without
 * rendering a component, and so no charting dependency is added for what is a
 * simple grouped bar chart.
 */
@Injectable()
export class DashboardActivityChartService {
  public build(points: readonly DashboardActivityPoint[]): ActivityChartViewModel {
    const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const maxValue = this.niceMax(points);
    const isEmpty = points.every((point) => point.calls === 0 && point.emails === 0);

    const slotWidth = points.length > 0 ? CHART_WIDTH / points.length : CHART_WIDTH;
    const barWidth = Math.max(3, Math.min(18, (slotWidth - 8) / 2));

    const bars: ActivityChartBar[] = points.map((point, index) => {
      const slotCentre = slotWidth * index + slotWidth / 2;
      const callsHeight = this.scale(point.calls, maxValue, plotHeight);
      const emailsHeight = this.scale(point.emails, maxValue, plotHeight);

      return {
        date: point.date,
        label: this.formatLabel(point.date),
        calls: point.calls,
        emails: point.emails,
        x: slotCentre - barWidth - 1,
        callsY: PADDING_TOP + plotHeight - callsHeight,
        callsHeight,
        emailsY: PADDING_TOP + plotHeight - emailsHeight,
        emailsHeight,
        barWidth,
        tooltip: `${this.formatLabel(point.date)}: ${point.calls} calls, ${point.emails} emails`,
      };
    });

    const gridLines: ActivityChartGridLine[] = Array.from(
      { length: GRID_LINES + 1 },
      (_, index) => ({
        y: PADDING_TOP + plotHeight - (plotHeight / GRID_LINES) * index,
        value: Math.round((maxValue / GRID_LINES) * index),
      }),
    );

    return { width: CHART_WIDTH, height: CHART_HEIGHT, bars, gridLines, maxValue, isEmpty };
  }

  /** Rounds the axis top up to a readable number so grid labels are integers. */
  private niceMax(points: readonly DashboardActivityPoint[]): number {
    const peak = points.reduce(
      (max, point) => Math.max(max, point.calls, point.emails),
      0,
    );
    if (peak <= GRID_LINES) {
      return GRID_LINES;
    }
    return Math.ceil(peak / GRID_LINES) * GRID_LINES;
  }

  private scale(value: number, maxValue: number, plotHeight: number): number {
    if (maxValue <= 0 || value <= 0) {
      return 0;
    }
    return (value / maxValue) * plotHeight;
  }

  /** `2026-03-10` -> `10 Mar`, formatted from the date parts to avoid a timezone shift. */
  private formatLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) {
      return isoDate;
    }
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(Date.UTC(year, month - 1, day)),
    );
  }
}
