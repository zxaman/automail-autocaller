import type { ImportTargetField } from './import.types';

export interface ValueSignal {
  field: ImportTargetField;
  /** Share of non-empty samples that look like this field, 0..1. */
  ratio: number;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Deliberately loose: 7-15 digits after stripping separators and a lead +. */
const PHONE_PATTERN = /^\+?[0-9][0-9\s\-().]{5,20}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]{1,60}$/u;
const NUMERIC_ONLY = /^\d+$/;

/**
 * Infers what a column contains by looking at its values.
 *
 * This is what makes a header called `Number` or `User` usable: the label tells
 * us nothing, but ten sample values usually settle it. Ratios rather than
 * booleans, so one stray value does not flip a verdict.
 */
export class ValueAnalyzer {
  public analyze(samples: readonly string[]): ValueSignal[] {
    const values = samples.map((value) => value.trim()).filter((value) => value !== '');
    if (values.length === 0) {
      return [];
    }

    const signals: ValueSignal[] = [
      { field: 'email', ratio: this.ratio(values, (value) => EMAIL_PATTERN.test(value)) },
      { field: 'phone', ratio: this.ratio(values, (value) => this.looksLikePhone(value)) },
      { field: 'name', ratio: this.ratio(values, (value) => this.looksLikeName(value)) },
    ];

    return signals.filter((signal) => signal.ratio > 0).sort((a, b) => b.ratio - a.ratio);
  }

  /**
   * A phone must survive separator stripping and land in a plausible digit
   * range. Short numbers are rejected so row counters and ages do not match.
   */
  public looksLikePhone(value: string): boolean {
    if (!PHONE_PATTERN.test(value)) {
      return false;
    }
    const digits = value.replace(/[^\d]/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return false;
    }
    // A serial column counts 1, 2, 3... - never 7+ digits, so length carries it.
    return true;
  }

  public looksLikeName(value: string): boolean {
    if (NUMERIC_ONLY.test(value) || EMAIL_PATTERN.test(value)) {
      return false;
    }
    if (!NAME_PATTERN.test(value)) {
      return false;
    }
    // Require a letter majority so "12-A" style codes do not pass.
    const letters = value.replace(/[^\p{L}]/gu, '').length;
    return letters >= Math.ceil(value.length * 0.6);
  }

  private ratio(values: readonly string[], predicate: (value: string) => boolean): number {
    const matches = values.filter(predicate).length;
    return matches / values.length;
  }
}
