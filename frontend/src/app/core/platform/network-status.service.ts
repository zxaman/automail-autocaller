import { Injectable, computed, inject, signal } from '@angular/core';
import { Network } from '@capacitor/network';

import { PlatformService } from './platform.service';

/**
 * Connectivity state.
 *
 * A phone loses signal in ways a desktop browser rarely does, and this app
 * places real phone calls and sends real email, so telling the user their
 * action will not go through is better than letting it fail silently.
 *
 * On the web it falls back to the browser online/offline events.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly platform = inject(PlatformService);

  private readonly isOnlineSignal = signal(true);
  private readonly connectionTypeSignal = signal<string>('unknown');
  private initialized = false;

  public readonly isOnline = this.isOnlineSignal.asReadonly();
  public readonly connectionType = this.connectionTypeSignal.asReadonly();
  public readonly isOffline = computed(() => !this.isOnlineSignal());

  /** Idempotent: safe to call from more than one place during startup. */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (this.platform.capabilities().hasNetworkStatus) {
      await this.initializeNative();
      return;
    }

    this.initializeWeb();
  }

  private async initializeNative(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.isOnlineSignal.set(status.connected);
      this.connectionTypeSignal.set(status.connectionType);

      await Network.addListener('networkStatusChange', (status) => {
        this.isOnlineSignal.set(status.connected);
        this.connectionTypeSignal.set(status.connectionType);
      });
    } catch {
      // If the plugin is unavailable, assume connected rather than blocking
      // the whole app behind a false offline state.
      this.isOnlineSignal.set(true);
    }
  }

  private initializeWeb(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.isOnlineSignal.set(window.navigator.onLine);
    window.addEventListener('online', () => this.isOnlineSignal.set(true));
    window.addEventListener('offline', () => this.isOnlineSignal.set(false));
  }
}
