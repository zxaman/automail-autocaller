import { isTerminalCallStatus, type CallStatus } from '../../infrastructure/telephony/telephony-provider';

/**
 * Call status transitions.
 *
 * Provider webhooks arrive over the network and are not ordered: a "ringing"
 * event can land after "completed" through a retry or a slow hop. Applying it
 * blindly would resurrect a finished call and corrupt history, so every
 * transition is checked against this machine.
 *
 * The rules are deliberately narrow — a status only moves forward, and a
 * terminal status never moves at all.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<CallStatus, readonly CallStatus[]>> = {
  queued: ['initiated', 'ringing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed', 'canceled'],
  initiated: ['ringing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed', 'canceled'],
  ringing: ['in_progress', 'completed', 'no_answer', 'busy', 'failed', 'canceled'],
  in_progress: ['completed', 'failed'],
  // Terminal: nothing follows.
  completed: [],
  no_answer: [],
  busy: [],
  failed: [],
  canceled: [],
};

export function canTransition(from: CallStatus, to: CallStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface TransitionResult {
  readonly applied: boolean;
  readonly status: CallStatus;
  readonly reason: string;
}

/**
 * Applies a provider status if it is a legal next step.
 *
 * Rejecting is normal, not an error: duplicate and late webhooks are expected
 * in any provider integration.
 */
export function applyTransition(current: CallStatus, incoming: CallStatus): TransitionResult {
  if (current === incoming) {
    return { applied: false, status: current, reason: 'Duplicate event for the current status' };
  }

  if (isTerminalCallStatus(current)) {
    return {
      applied: false,
      status: current,
      reason: `Call already finished as "${current}"; ignoring late "${incoming}" event`,
    };
  }

  if (!canTransition(current, incoming)) {
    return {
      applied: false,
      status: current,
      reason: `"${incoming}" is not reachable from "${current}"`,
    };
  }

  return { applied: true, status: incoming, reason: 'Applied' };
}

/** True once a call has connected, which is what "answered" means for metrics. */
export function isAnsweredStatus(status: CallStatus): boolean {
  return status === 'in_progress' || status === 'completed';
}
