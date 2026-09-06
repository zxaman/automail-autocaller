import { describe, expect, it } from 'vitest';

import {
  contactIdParamSchema,
  createContactSchema,
  listContactsQuerySchema,
} from './contact.validation';

describe('contact validation', () => {
  it('requires at least a phone or an email', () => {
    const result = createContactSchema.safeParse({ name: 'Rahul' });
    expect(result.success).toBe(false);
  });

  it('accepts a contact with only an email', () => {
    const result = createContactSchema.safeParse({ name: 'Rahul', email: 'RAHUL@Example.com ' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('rahul@example.com');
  });

  it('rejects a malformed email', () => {
    const result = createContactSchema.safeParse({ name: 'Rahul', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('lowercases and de-duplicates tags', () => {
    const result = createContactSchema.safeParse({
      name: 'Rahul',
      email: 'a@b.com',
      tags: ['Candidate', 'candidate', 'Senior'],
    });
    expect(result.success && result.data.tags).toEqual(['candidate', 'senior']);
  });

  it('converts empty optional strings to null', () => {
    const result = createContactSchema.safeParse({ name: 'Rahul', email: 'a@b.com', company: '' });
    expect(result.success && result.data.company).toBeNull();
  });

  it('caps the page size so a client cannot request everything', () => {
    expect(listContactsQuerySchema.safeParse({ pageSize: '5000' }).success).toBe(false);
    const ok = listContactsQuerySchema.safeParse({});
    expect(ok.success && ok.data.pageSize).toBe(25);
    expect(ok.success && ok.data.sortBy).toBe('createdAt');
  });

  it('rejects an unknown sort field', () => {
    expect(listContactsQuerySchema.safeParse({ sortBy: 'password' }).success).toBe(false);
  });

  it('rejects a non-ObjectId contact id', () => {
    expect(contactIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(contactIdParamSchema.safeParse({ id: 'a'.repeat(24) }).success).toBe(true);
  });
});
