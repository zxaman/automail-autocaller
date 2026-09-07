import { beforeEach, describe, expect, it } from 'vitest';

import {
  METRICS,
  getCounterValue,
  incrementCounter,
  renderMetrics,
  resetMetrics,
} from './metrics';

describe('metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('counts occurrences', () => {
    incrementCounter(METRICS.emailSendAttempts, 'help');
    incrementCounter(METRICS.emailSendAttempts, 'help');

    expect(getCounterValue(METRICS.emailSendAttempts)).toBe(2);
  });

  it('keeps label sets independent', () => {
    // An alert on SMTP_AUTH_FAILED must not be diluted by unrelated failures.
    incrementCounter(METRICS.emailSendFailures, 'help', { code: 'SMTP_AUTH_FAILED' });
    incrementCounter(METRICS.emailSendFailures, 'help', { code: 'SMTP_TIMEOUT' });
    incrementCounter(METRICS.emailSendFailures, 'help', { code: 'SMTP_TIMEOUT' });

    expect(getCounterValue(METRICS.emailSendFailures, { code: 'SMTP_AUTH_FAILED' })).toBe(1);
    expect(getCounterValue(METRICS.emailSendFailures, { code: 'SMTP_TIMEOUT' })).toBe(2);
  });

  it('treats label order as insignificant', () => {
    incrementCounter('probe', 'help', { a: '1', b: '2' });

    expect(getCounterValue('probe', { b: '2', a: '1' })).toBe(1);
  });

  it('returns zero for a counter never incremented', () => {
    expect(getCounterValue('never_touched')).toBe(0);
  });

  it('renders Prometheus exposition format', () => {
    incrementCounter(METRICS.callsPlaced, 'Calls placed.', { provider: 'exotel' });

    const output = renderMetrics();

    expect(output).toContain(`# TYPE ${METRICS.callsPlaced} counter`);
    expect(output).toContain(`${METRICS.callsPlaced}{provider="exotel"} 1`);
  });

  it('escapes quotes in label values so the output stays parseable', () => {
    incrementCounter('probe', 'help', { detail: 'say "hi"' });

    expect(renderMetrics()).toContain('detail="say \\"hi\\""');
  });
});
