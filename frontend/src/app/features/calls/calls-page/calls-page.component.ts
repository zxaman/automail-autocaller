import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiEmptyStateComponent } from '../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiLoadingSpinnerComponent } from '../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import { UiStatusBadgeComponent } from '../../../shared/components/ui-status-badge/ui-status-badge.component';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { CALL_STATUS_LABELS, type CallStatus } from '../models/call.model';
import { CallsPageService } from './calls-page.service';

/**
 * Calling screen.
 *
 * With PSTN bridging the conversation happens on the agent's own handset, so
 * this screen shows honest call *state* and does not render mute, hold, or
 * keypad controls it cannot actually perform.
 */
@Component({
  selector: 'app-calls-page',
  standalone: true,
  imports: [
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiLoadingSpinnerComponent,
    UiStatusBadgeComponent,
    DurationPipe,
    RelativeTimePipe,
  ],
  providers: [CallsPageService],
  templateUrl: './calls-page.component.html',
  styleUrl: './calls-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallsPageComponent implements OnInit, OnDestroy {
  protected readonly state = inject(CallsPageService);

  public ngOnInit(): void {
    void this.state.load();
  }

  public ngOnDestroy(): void {
    // Leaving the screen must not leave a timer running.
    this.state.stopPolling();
  }

  protected onAgentNumberInput(event: Event): void {
    this.state.setAgentNumber((event.target as HTMLInputElement).value);
  }

  protected statusLabel(status: CallStatus): string {
    return CALL_STATUS_LABELS[status];
  }
}
