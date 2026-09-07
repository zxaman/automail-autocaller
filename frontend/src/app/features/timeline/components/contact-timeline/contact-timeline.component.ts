import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';

import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button.component';
import { UiEmptyStateComponent } from '../../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../../shared/components/ui-error-state/ui-error-state.component';
import { UiIconComponent } from '../../../../shared/components/ui-icon/ui-icon.component';
import type { UiIconName } from '../../../../shared/components/ui-icon/ui-icon.model';
import { UiLoadingSpinnerComponent } from '../../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import { UiStatusBadgeComponent } from '../../../../shared/components/ui-status-badge/ui-status-badge.component';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import {
  TIMELINE_KIND_ICONS,
  TIMELINE_KIND_LABELS,
  type TimelineEntry,
  type TimelineEntryKind,
} from '../../models/timeline.model';
import { TimelineNoteFormComponent } from '../timeline-note-form/timeline-note-form.component';
import { ContactTimelineStateService } from './contact-timeline.service';

/** Reusable unified history for one contact: calls, emails, notes, and imports. */
@Component({
  selector: 'app-contact-timeline',
  standalone: true,
  imports: [
    UiButtonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiIconComponent,
    UiLoadingSpinnerComponent,
    UiStatusBadgeComponent,
    TimelineNoteFormComponent,
    DurationPipe,
    RelativeTimePipe,
  ],
  providers: [ContactTimelineStateService],
  templateUrl: './contact-timeline.component.html',
  styleUrl: './contact-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactTimelineComponent {
  protected readonly state = inject(ContactTimelineStateService);

  public readonly contactId = input.required<string>();

  /** Raised when the user wants a follow-up email for a finished call. */
  public readonly followUpRequested = output<TimelineEntry>();

  protected readonly filterKinds: readonly TimelineEntryKind[] = [
    'call',
    'email',
    'note',
    'import',
  ];

  constructor() {
    effect(() => {
      const id = this.contactId();

      if (id) {
        void this.state.load(id);
      }
    });
  }

  protected iconFor(kind: TimelineEntryKind): UiIconName {
    return TIMELINE_KIND_ICONS[kind] as UiIconName;
  }

  protected labelFor(kind: TimelineEntryKind): string {
    return TIMELINE_KIND_LABELS[kind];
  }

  protected isFilterActive(kind: TimelineEntryKind): boolean {
    return this.state.activeKinds().includes(kind);
  }

  protected async onNoteSubmitted(body: string): Promise<void> {
    await this.state.addNote(body);
  }
}
