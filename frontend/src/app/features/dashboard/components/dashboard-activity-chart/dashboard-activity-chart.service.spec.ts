import { beforeEach, describe, expect, it } from 'vitest';

import { DashboardActivityChartService } from './dashboard-activity-chart.service';

describe('DashboardActivityChartService', () => {
  let service: DashboardActivityChartService;

  beforeEach(() => {
    service = new DashboardActivityChartService();
  });

  it('marks an all-zero series as empty and still emits bars', () => {
    const chart = service.build([
      { date: '2026-03-09', calls: 0, emails: 0 },
      { date: '2026-03-10', calls: 0, emails: 0 },
    ]);

    expect(chart.isEmpty).toBe(true);
    expect(chart.bars).toHaveLength(2);
    expect(chart.bars[0]?.callsHeight).toBe(0);
  });

  it('scales the tallest bar to the plot height', () => {
    const chart = service.build([
      { date: '2026-03-09', calls: 4, emails: 0 },
      { date: '2026-03-10', calls: 8, emails: 2 },
    ]);

    expect(chart.isEmpty).toBe(false);
    expect(chart.maxValue).toBe(8);
    expect(chart.bars[1]?.callsHeight).toBeGreaterThan(chart.bars[0]?.callsHeight ?? 0);
  });

  it('keeps grid labels as whole numbers', () => {
    const chart = service.build([{ date: '2026-03-10', calls: 7, emails: 0 }]);

    expect(chart.gridLines).toHaveLength(5);
    for (const line of chart.gridLines) {
      expect(Number.isInteger(line.value)).toBe(true);
    }
  });

  it('labels days from the date parts, without a timezone shift', () => {
    const chart = service.build([{ date: '2026-03-01', calls: 1, emails: 1 }]);
    expect(chart.bars[0]?.label).toBe('1 Mar');
  });

  it('narrows the bars as the range grows', () => {
    const wide = service.build([{ date: '2026-03-10', calls: 1, emails: 1 }]);
    const dense = service.build(
      Array.from({ length: 30 }, (_, index) => ({
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        calls: 1,
        emails: 1,
      })),
    );

    expect(dense.bars[0]!.barWidth).toBeLessThan(wide.bars[0]!.barWidth);
    expect(dense.bars).toHaveLength(30);
  });
});
