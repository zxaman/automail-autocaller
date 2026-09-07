/** Where the app is currently running. */
export type RuntimePlatform = 'web' | 'android' | 'ios';

/**
 * Capabilities that genuinely differ between web and native.
 *
 * Written as data so a feature can ask what is available instead of testing
 * for a platform name, which is how "works on my phone" bugs start.
 */
export interface PlatformCapabilities {
  readonly platform: RuntimePlatform;
  readonly isNative: boolean;
  /**
   * Whether the session can be kept in OS-backed secure storage.
   * On the web it cannot: the session is an httpOnly cookie the page is not
   * permitted to read, which is the safer arrangement there.
   */
  readonly hasSecureStorage: boolean;
  /** Whether the runtime can report connectivity changes. */
  readonly hasNetworkStatus: boolean;
  /** Whether the app can be backgrounded and resumed by the OS. */
  readonly hasAppLifecycle: boolean;
  /**
   * Always false. Calls are bridged by the telephony provider over the PSTN
   * and answered on the handset dialler, so the app never handles call audio
   * on any platform. Recorded explicitly so no screen assumes otherwise.
   */
  readonly hasInAppVoice: boolean;
  /**
   * Always false, and a consequence of the line above: with no in-app audio
   * there is nothing to grant microphone access to, so the app must never ask.
   */
  readonly needsMicrophonePermission: boolean;
}
