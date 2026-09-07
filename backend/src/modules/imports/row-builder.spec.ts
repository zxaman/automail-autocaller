import { describe, expect, it } from 'vitest';

import type { ColumnAssignment } from './import.types';
import { RowBuilder } from './row-builder';

function mapping(...fields: ColumnAssignment[]): Map<number, ColumnAssignment> {
  return new Map(fields.map((field, index) => [index, field]));
}

describe('RowBuilder', () => {
  const builder = new RowBuilder();
  const nameThenPhoneThenEmail = mapping('name', 'phone', 'email');

  it('builds a contact from a well-formed row', () => {
    const result = builder.build(
      ['Asha Menon', '9812345678', 'ASHA@Example.com'],
      nameThenPhoneThenEmail,
      2,
    );

    expect(result.error).toBeNull();
    expect(result.draft).toMatchObject({
      name: 'Asha Menon',
      phone: '+919812345678',
      email: 'asha@example.com',
      rowNumber: 2,
    });
  });

  it('combines first and last name columns', () => {
    const result = builder.build(
      ['Asha', 'Menon', '9812345678'],
      mapping('firstName', 'lastName', 'phone'),
      2,
    );

    expect(result.draft?.name).toBe('Asha Menon');
  });

  it('prefers a full name column over the split columns', () => {
    const result = builder.build(
      ['Asha Menon', 'Ignored', 'Also', '9812345678'],
      mapping('name', 'firstName', 'lastName', 'phone'),
      2,
    );

    expect(result.draft?.name).toBe('Asha Menon');
  });

  it('normalizes local phone numbers to E.164', () => {
    const result = builder.build(
      ['Asha', '+91 98123 45678', ''],
      nameThenPhoneThenEmail,
      2,
    );

    expect(result.draft?.phone).toBe('+919812345678');
  });

  it('rejects an unusable phone number with a clear reason', () => {
    const result = builder.build(['Asha', '12', ''], nameThenPhoneThenEmail, 5);

    expect(result.draft).toBeNull();
    expect(result.error).toContain('not a valid phone number');
  });

  it('rejects a malformed email address', () => {
    const result = builder.build(['Asha', '', 'asha@@example'], nameThenPhoneThenEmail, 5);

    expect(result.error).toContain('not a valid email address');
  });

  it('rejects a row with neither a phone nor an email', () => {
    const result = builder.build(['Asha', '', ''], nameThenPhoneThenEmail, 5);

    expect(result.error).toContain('neither a phone number nor an email');
  });

  it('rejects a row with no name', () => {
    const result = builder.build(['', '9812345678', ''], nameThenPhoneThenEmail, 5);

    expect(result.error).toContain('no name');
  });

  it('reports a blank row as empty rather than as an error', () => {
    const result = builder.build(['', '', ''], nameThenPhoneThenEmail, 5);

    expect(result.isEmpty).toBe(true);
    expect(result.error).toBeNull();
  });

  it('ignores columns the user chose to skip', () => {
    const result = builder.build(
      ['Asha', '9812345678', 'secret-internal-id'],
      mapping('name', 'phone', 'ignore'),
      2,
    );

    expect(result.draft?.notes).toBeNull();
  });

  it('splits multi-value tag cells and merges the import-wide tags', () => {
    const tagged = new RowBuilder(['q3-batch']);
    const result = tagged.build(
      ['Asha', '9812345678', 'vip; lead, warm'],
      mapping('name', 'phone', 'tags'),
      2,
    );

    expect(result.draft?.tags).toEqual(['q3-batch', 'vip', 'lead', 'warm']);
  });

  it('accepts a row with only an email, since it can still be mailed', () => {
    const result = builder.build(['Asha', '', 'asha@example.com'], nameThenPhoneThenEmail, 2);

    expect(result.error).toBeNull();
    expect(result.draft?.phone).toBeNull();
  });
});
