import { Pipe, type PipeTransform } from '@angular/core';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Formats an ISO timestamp as a short relative label such as `Today 10:32 AM`. */
@Pipe({ name: 'appRelativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  public transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const diff = Date.now() - date.getTime();

    if (diff < MINUTE) {
      return 'Just now';
    }
    if (this.isSameDay(date, new Date())) {
      return `Today ${time}`;
    }
    const yesterday = new Date(Date.now() - DAY);
    if (this.isSameDay(date, yesterday)) {
      return `Yesterday ${time}`;
    }
    return `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${time}`;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
