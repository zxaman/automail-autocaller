export type LoginPhase = 'initializing' | 'ready' | 'submitting' | 'unavailable';

export interface LoginPageState {
  readonly phase: LoginPhase;
  readonly errorMessage: string | null;
}

/** Reasons the router may pass when redirecting to the login screen. */
export type LoginRedirectReason = 'session-expired' | null;
