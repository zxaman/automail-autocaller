/** A single entry in the unified communication timeline. */
export interface TimelineEntry {
  readonly id: string;
  readonly kind: 'call' | 'email' | 'note';
  readonly title: string;
  readonly description: string | null;
  readonly occurredAt: string;
}

/** Groups timeline entries under a day heading. */
export interface TimelineGroup {
  readonly label: string;
  readonly entries: readonly TimelineEntry[];
}
