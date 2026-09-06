import { describe, expect, it } from 'vitest';

import { applyTransition, canTransition, isAnsweredStatus } from './call-state-machine';

describe('call state machine', () => {
  it('follows the normal lifecycle', () => {
    expect(canTransition('queued', 'initiated')).toBe(true);
    expect(canTransition('initiated', 'ringing')).toBe(true);
    expect(canTransition('ringing', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'completed')).toBe(true);
  });

  it('allows a call to fail before it is answered', () => {
    expect(canTransition('ringing', 'no_answer')).toBe(true);
    expect(canTransition('ringing', 'busy')).toBe(true);
  });

  it('never moves backwards', () => {
    expect(canTransition('in_progress', 'ringing')).toBe(false);
    expect(canTransition('completed', 'in_progress')).toBe(false);
  });

  it('cannot report no-answer for a call that connected', () => {
    // Once someone spoke, "no answer" is a contradiction.
    expect(canTransition('in_progress', 'no_answer')).toBe(false);
  });

  it('ignores a late event after the call finished', () => {
    const result = applyTransition('completed', 'ringing');

    expect(result.applied).toBe(false);
    expect(result.status).toBe('completed');
    expect(result.reason).toContain('already finished');
  });

  it('ignores a duplicate event', () => {
    const result = applyTransition('ringing', 'ringing');

    expect(result.applied).toBe(false);
    expect(result.reason).toContain('Duplicate');
  });

  it('applies a legal transition', () => {
    const result = applyTransition('ringing', 'in_progress');

    expect(result.applied).toBe(true);
    expect(result.status).toBe('in_progress');
  });

  it('treats every terminal status as final', () => {
    for (const terminal of ['completed', 'no_answer', 'busy', 'failed', 'canceled'] as const) {
      expect(applyTransition(terminal, 'in_progress').applied).toBe(false);
    }
  });

  it('counts only connected calls as answered', () => {
    expect(isAnsweredStatus('completed')).toBe(true);
    expect(isAnsweredStatus('in_progress')).toBe(true);
    expect(isAnsweredStatus('no_answer')).toBe(false);
    expect(isAnsweredStatus('busy')).toBe(false);
  });
});
