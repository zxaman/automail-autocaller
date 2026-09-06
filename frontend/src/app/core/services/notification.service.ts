import { Injectable, signal } from '@angular/core';

export type NotificationTone = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  readonly id: string;
  readonly tone: NotificationTone;
  readonly message: string;
  readonly durationMs: number;
}

const DEFAULT_DURATION_MS = 5000;

/** Lightweight toast queue used across features for success and error feedback. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationsSignal = signal<readonly AppNotification[]>([]);
  public readonly notifications = this.notificationsSignal.asReadonly();

  public success(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push('success', message, durationMs);
  }

  public error(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push('error', message, durationMs);
  }

  public warning(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push('warning', message, durationMs);
  }

  public info(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push('info', message, durationMs);
  }

  public dismiss(id: string): void {
    this.notificationsSignal.update((items) => items.filter((item) => item.id !== id));
  }

  private push(tone: NotificationTone, message: string, durationMs: number): void {
    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tone,
      message,
      durationMs,
    };
    this.notificationsSignal.update((items) => [...items, notification]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(notification.id), durationMs);
    }
  }
}
