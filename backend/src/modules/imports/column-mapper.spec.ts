import { describe, expect, it } from 'vitest';

import { ColumnMapper } from './column-mapper';
import { normalizeHeaderLabel } from './header-alias.registry';
import type { DetectedHeader } from './import.types';

const mapper = new ColumnMapper();

function header(index: number, rawLabel: string, sampleValues: string[] = []): DetectedHeader {
  return {
    index,
    rawLabel,
    normalizedLabel: normalizeHeaderLabel(rawLabel),
    sampleValues,
  };
}

describe('ColumnMapper', () => {
  it.each([
    ['Phone No.', 'phone'],
    ['Mobile', 'phone'],
    ['Mobile Number', 'phone'],
    ['Contact Number', 'phone'],
    ['Telephone', 'phone'],
    ['Candidate', 'name'],
    ['Candidate Name', 'name'],
    ['Applicant', 'name'],
    ['Full Name', 'name'],
    ['Email ID', 'email'],
    ['Mail', 'email'],
    ['Email Address', 'email'],
  ])('maps the nonstandard header "%s" to %s', (label, expected) => {
    const [suggestion] = mapper.suggest([header(0, label)], true);
    expect(suggestion?.suggestedField).toBe(expected);
  });

  it('maps a generic "Number" header using its values, and asks for confirmation', () => {
    const [suggestion] = mapper.suggest(
      [header(0, 'Number', ['9812345678', '9812345679', '9812345670'])],
      true,
    );

    expect(suggestion?.suggestedField).toBe('phone');
    expect(suggestion?.requiresConfirmation).toBe(true);
    expect(suggestion?.confidence).not.toBe('high');
    expect(suggestion?.reason).toContain('generic');
  });

  it('maps a generic "User" header of names using value analysis', () => {
    const [suggestion] = mapper.suggest(
      [header(0, 'User', ['Asha Menon', 'Ravi Kumar', 'Meera Nair'])],
      true,
    );

    expect(suggestion?.suggestedField).toBe('name');
    expect(suggestion?.requiresConfirmation).toBe(true);
  });

  it('never auto-applies the generic header "Details"', () => {
    // "Details" is a plausible notes column, but far too vague to trust, so it
    // must be offered as a suggestion rather than applied silently.
    const [suggestion] = mapper.suggest([header(0, 'Details', ['x1', 'x2'])], true);

    expect(suggestion?.confidence).not.toBe('high');
    expect(suggestion?.requiresConfirmation).toBe(true);
  });

  it('does not force a field onto a column nothing matches', () => {
    const [suggestion] = mapper.suggest([header(0, 'Zx99 Code', ['x1', 'x2'])], true);

    expect(suggestion?.suggestedField).toBeNull();
    expect(suggestion?.requiresConfirmation).toBe(true);
  });

  it('maps headerless columns purely from their values', () => {
    const suggestions = mapper.suggest(
      [
        header(0, 'Column 1', ['Asha Menon', 'Ravi Kumar']),
        header(1, 'Column 2', ['9812345678', '9812345679']),
        header(2, 'Column 3', ['asha@example.com', 'ravi@example.com']),
      ],
      false,
    );

    expect(suggestions.map((entry) => entry.suggestedField)).toEqual(['name', 'phone', 'email']);
    // Value-only evidence should never silently auto-apply.
    expect(suggestions.every((entry) => entry.requiresConfirmation)).toBe(true);
  });

  it('raises confidence when the label and the values agree', () => {
    const [withValues] = mapper.suggest(
      [header(0, 'Email', ['asha@example.com', 'ravi@example.com'])],
      true,
    );
    const [labelOnly] = mapper.suggest([header(0, 'Email')], true);

    expect(withValues!.score).toBeGreaterThan(labelOnly!.score);
    expect(withValues?.confidence).toBe('high');
  });

  it('does not let two columns claim the same field', () => {
    const suggestions = mapper.suggest(
      [
        header(0, 'Mobile', ['9812345678', '9812345679']),
        header(1, 'Phone Number', ['9812345670', '9812345671']),
      ],
      true,
    );

    const phoneColumns = suggestions.filter((entry) => entry.suggestedField === 'phone');
    expect(phoneColumns).toHaveLength(1);

    const demoted = suggestions.find((entry) => entry.suggestedField !== 'phone');
    expect(demoted?.requiresConfirmation).toBe(true);
  });

  it('keeps first and last name as separate fields', () => {
    const suggestions = mapper.suggest(
      [header(0, 'First Name', ['Asha']), header(1, 'Surname', ['Menon'])],
      true,
    );

    expect(suggestions.map((entry) => entry.suggestedField)).toEqual(['firstName', 'lastName']);
  });

  it('explains every suggestion in plain language', () => {
    const [suggestion] = mapper.suggest([header(0, 'Mobile No', ['9812345678'])], true);
    expect(suggestion?.reason.length).toBeGreaterThan(10);
  });
});
