import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/services/notification.service';
import type {
  TimelineDayGroup,
  TimelineEntry,
  TimelineEntryKind,
} from '../../models/timeline.model';
import { TimelineService } from '../../services/timeline.service';

/**
 * State for one contact's timeline: loading, filtering, and note editing.
 *
 * Kept separate from the component so the grouping and filter rules can be
 * tested without rendering anything.
 */
@Injectable()
export class ContactTimelineStateService {
  private readonly timelineService = inject(TimelineService);
  private readonly notifications = inject(NotificationService);

  private readonly entriesSignal = signal<readonly TimelineEntry[]>([]);
  private readonly activeKindsSignal = signal<readonly TimelineEntryKind[]>([]);
  private readonly isLoadingSignal = signal(false);
  private readonly isSavingNoteSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  private contactId: string | null = null;

  public readonly entries = this.entriesSignal.asReadonly();
  public readonly activeKinds = this.activeKindsSignal.asReadonly();
  public readonly isLoading = this.isLoadingSignal.asReadonly();
  public readonly isSavingNote = this.isSavingNoteSignal.asReadonly();
  public readonly errorMessage = this.errorSignal.asReadonly();

  /**
   * True only when the contact genuinely has no history.
   *
   * A failed load is not emptiness: claiming "no activity yet" when the
   * request errored would hide the problem and misrepresent the data.
   */
  public readonly isEmpty = computed(
    () =>
      !this.isLoadingSignal() &&
      this.errorSignal() === null &&
      this.entriesSignal().length === 0,
  );

  /** Entries filtered client-side, so toggling a filter costs no request. */
  public readonly visibleEntries = computed(() => {
    const kinds = this.activeKindsSignal();

    if (kinds.length === 0) {
      return this.entriesSignal();
    }

    return this.entriesSignal().filter((entry) => kinds.includes(entry.kind));
  });

  /**
   * Day-grouped view of the timeline.
   *
   * Grouping happens here rather than in the template because a template
   * cannot express it without recomputing on every change detection pass.
   */
  public readonly groups = computed<readonly TimelineDayGroup[]>(() => {
    const groups: TimelineDayGroup[] = [];
    let currentLabel: string | null = null;
    let bucket: TimelineEntry[] = [];

    for (const entry of this.visibleEntries()) {
      const label = this.dayLabel(entry.occurredAt);

      if (label !== currentLabel) {
        if (currentLabel !== null) {
          groups.push({ label: currentLabel, entries: bucket });
        }
        currentLabel = label;
        bucket = [];
      }

      bucket.push(entry);
    }

    if (currentLabel !== null) {
      groups.push({ label: currentLabel, entries: bucket });
    }

    return groups;
  });

  public async load(contactId: string): Promise<void> {
    this.contactId = contactId;
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const timeline = await firstValueFrom(
        this.timelineService.getContactTimeline(contactId),
      );
      this.entriesSignal.set(timeline.entries);
    } catch (error) {
      this.errorSignal.set(
        error instanceof AppError ? error.message : 'The timeline could not be loaded',
      );
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  public toggleKind(kind: TimelineEntryKind): void {
    const current = this.activeKindsSignal();

    this.activeKindsSignal.set(
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    );
  }

  public clearFilters(): void {
    this.activeKindsSignal.set([]);
  }

  public async addNote(body: string, callId: string | null = null): Promise<boolean> {
    if (!this.contactId || body.trim().length === 0) {
      return false;
    }

    this.isSavingNoteSignal.set(true);

    try {
      const entry = await firstValueFrom(
        this.timelineService.addNote(this.contactId, body.trim(), callId),
      );

      // Inserted locally so the note appears immediately, then re-sorted:
      // a note is newest, but re-sorting keeps the invariant explicit.
      this.entriesSignal.set(
        [entry, ...this.entriesSignal()].sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        ),
      );
      this.notifications.success('Note added');
      return true;
    } catch (error) {
      this.notifications.error(
        error instanceof AppError ? error.message : 'The note could not be saved',
      );
      return false;
    } finally {
      this.isSavingNoteSignal.set(false);
    }
  }

  public async deleteNote(entry: TimelineEntry): Promise<void> {
    try {
      await firstValueFrom(this.timelineService.deleteNote(entry.sourceId));
      this.entriesSignal.set(this.entriesSignal().filter((item) => item.id !== entry.id));
      this.notifications.success('Note deleted');
    } catch (error) {
      this.notifications.error(
        error instanceof AppError ? error.message : 'The note could not be deleted',
      );
    }
  }

  /** "Today" / "Yesterday" / a written date, in the user's own locale. */
  private dayLabel(isoDate: string): string {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date): boolean =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(date, today)) {
      return 'Today';
    }
    if (sameDay(date, yesterday)) {
      return 'Yesterday';
    }

    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    });
  }
}
