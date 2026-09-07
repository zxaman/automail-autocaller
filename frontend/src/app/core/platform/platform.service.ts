import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import type { PlatformCapabilities, RuntimePlatform } from './platform.model';

/**
 * Reports the runtime platform and what it can actually do.
 *
 * Features should ask this service for a capability rather than checking for
 * a platform name, so behaviour stays correct when a new platform is added.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly capabilitiesSignal = signal<PlatformCapabilities>(this.detect());

  public readonly capabilities = this.capabilitiesSignal.asReadonly();

  public get platform(): RuntimePlatform {
    return this.capabilitiesSignal().platform;
  }

  public get isNative(): boolean {
    return this.capabilitiesSignal().isNative;
  }

  private detect(): PlatformCapabilities {
    const raw = Capacitor.getPlatform();
    const platform: RuntimePlatform =
      raw === 'android' || raw === 'ios' ? raw : 'web';
    const isNative = platform !== 'web';

    return {
      platform,
      isNative,
      // The web session is an httpOnly cookie the page cannot read, which is
      // deliberately safer than any storage the page could reach.
      hasSecureStorage: isNative,
      hasNetworkStatus: isNative,
      hasAppLifecycle: isNative,
      // Never true on any platform: calls are bridged provider-side.
      hasInAppVoice: false,
      needsMicrophonePermission: false,
    };
  }
}
