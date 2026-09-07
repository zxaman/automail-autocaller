import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type {
  DashboardRangePreset,
  DashboardRangeSelection,
} from '../../dashboard-page/dashboard-page.model';
import { DASHBOARD_RANGE_OPTIONS } from './dashboard-range-filter.model';

/** Preset segmented control plus an optional custom start/end date pair. */
@Component({
  selector: 'app-dashboard-range-filter',
  standalone: true,
  templateUrl: './dashboard-range-filter.component.html',
  styleUrl: './dashboard-range-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardRangeFilterComponent {
  public readonly selection = input.required<DashboardRangeSelection>();
  public readonly disabled = input(false);
  public readonly rangeChange = output<DashboardRangeSelection>();

  protected readonly options = DASHBOARD_RANGE_OPTIONS;
  protected readonly customFrom = signal('');
  protected readonly customTo = signal('');
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly isCustom = computed(() => this.selection().preset === 'custom');
  protected readonly canApplyCustom = computed(() => {
    const from = this.customFrom();
    const to = this.customTo();
    return from !== '' && to !== '' && from <= to;
  });

  protected selectPreset(preset: DashboardRangePreset): void {
    if (preset === this.selection().preset) {
      return;
    }

    if (preset === 'custom') {
      // Seed the inputs with a sensible week so the pickers are never blank.
      if (this.customFrom() === '' || this.customTo() === '') {
        const to = new Date();
        const from = new Date(to.getTime() - 6 * 86_400_000);
        this.customFrom.set(from.toISOString().slice(0, 10));
        this.customTo.set(to.toISOString().slice(0, 10));
      }
      this.rangeChange.emit({ preset: 'custom', from: this.customFrom(), to: this.customTo() });
      return;
    }

    this.rangeChange.emit({ preset });
  }

  protected updateFrom(value: string): void {
    this.customFrom.set(value);
  }

  protected updateTo(value: string): void {
    this.customTo.set(value);
  }

  protected applyCustom(): void {
    if (!this.canApplyCustom()) {
      return;
    }
    this.rangeChange.emit({ preset: 'custom', from: this.customFrom(), to: this.customTo() });
  }
}
