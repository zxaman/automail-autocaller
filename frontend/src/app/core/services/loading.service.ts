import { Injectable, computed, signal } from '@angular/core';

/** Counts active HTTP requests for the global loading indicator. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly activeRequests = signal(0);
  public readonly isLoading = computed(() => this.activeRequests() > 0);

  public start(): void {
    this.activeRequests.update((count) => count + 1);
  }

  public stop(): void {
    this.activeRequests.update((count) => Math.max(0, count - 1));
  }
}
