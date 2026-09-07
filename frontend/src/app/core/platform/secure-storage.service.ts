import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { PlatformService } from './platform.service';

/**
 * Small-value storage that uses the OS keystore on native.
 *
 * `@capacitor/preferences` maps to Android `EncryptedSharedPreferences` and
 * iOS `UserDefaults` backed by the app sandbox, so values are protected by the
 * platform rather than by the WebView.
 *
 * On the web this intentionally does nothing. There is no browser store that
 * is safe against XSS, and the web session already lives in an httpOnly cookie
 * the page cannot read; writing a token to localStorage as a fallback would
 * quietly weaken the web build to match the phone.
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly platform = inject(PlatformService);

  public get isAvailable(): boolean {
    return this.platform.capabilities().hasSecureStorage;
  }

  public async get(key: string): Promise<string | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const result = await Preferences.get({ key });
      return result.value;
    } catch {
      // A storage failure must never break a screen; treat it as absent.
      return null;
    }
  }

  public async set(key: string, value: string): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      await Preferences.set({ key, value });
      return true;
    } catch {
      return false;
    }
  }

  public async remove(key: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      await Preferences.remove({ key });
    } catch {
      // Best effort: sign-out must complete regardless.
    }
  }

  /** Clears everything this app stored. Used on sign-out. */
  public async clear(): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      await Preferences.clear();
    } catch {
      // Ignored for the same reason as above.
    }
  }
}
