export type UiStatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'accent';

/** Domain statuses mapped to a visual tone. Text is always shown with color. */
export const UI_STATUS_TONES: Readonly<Record<string, UiStatusTone>> = {
  sent: 'success',
  completed: 'success',
  connected: 'success',
  imported: 'success',
  delivered: 'success',
  queued: 'info',
  sending: 'info',
  ringing: 'info',
  draft: 'neutral',
  duplicate: 'warning',
  missed: 'warning',
  onhold: 'warning',
  failed: 'error',
  invalid: 'error',
  disconnected: 'error',
};
