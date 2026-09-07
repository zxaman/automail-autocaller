import { Injectable, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';

import { PlatformService } from './platform.service';

/**
 * Native app lifecycle.
 *
 * A phone suspends the app whenever the user takes a call or switches away,
 * and on resume the screen may be showing minutes-old data. Exposing the
 * resume moment lets a screen refresh rather than present stale numbers.
 */
@Injectable({ providedIn: 'root' })
export class AppLifecycleService {
  private readonly platform = inject(PlatformService);

  private readonly isActiveSignal = signal(true);
  private readonly resumeCounterSignal = signal(0);
  private initialized = false;

  public readonly isActive = this.isActiveSignal.asReadonly();
  /** Increments on every resume, so an effect can react to it. */
  public readonly resumeCounter = this.resumeCounterSignal.asReadonly();

  public async initialize(): Promise<void> {
    if (this.initialized || !this.platform.capabilities().hasAppLifecycle) {
      return;
    }
    this.initialized = true;

    try {
      await App.addListener('appStateChange', ({ isActive }) => {
        const wasActive = this.isActiveSignal();
        this.isActiveSignal.set(isActive);

        if (isActive && !wasActive) {
          this.resumeCounterSignal.update((value) => value + 1);
        }
      });
    } catch {
      // Without lifecycle events the app simply never auto-refreshes.
    }
  }
}
