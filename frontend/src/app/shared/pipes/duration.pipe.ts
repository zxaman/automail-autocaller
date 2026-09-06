import { Pipe, type PipeTransform } from '@angular/core';

/** Formats a call duration in seconds as `5m 32s` / `1h 04m`. */
@Pipe({ name: 'appDuration', standalone: true })
export class DurationPipe implements PipeTransform {
  public transform(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
      return '—';
    }
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${String(secs).padStart(2, '0')}s`;
    }
    return `${secs}s`;
  }
}
