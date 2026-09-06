import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import type { GoogleIdentity } from '../../infrastructure/google/google-token-verifier';
import { SessionModel } from '../auth/session.model';
import { UserModel } from '../users/user.model';
import { WorkspaceModel } from '../workspaces/workspace.model';
import { createTestMongo, type TestMongo } from '../../test-support/mongo';
import { ContactModel } from './contact.model';

const verifyMock = vi.fn<(idToken: string) => Promise<GoogleIdentity>>();

vi.mock('../../infrastructure/google/google-token-verifier', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../infrastructure/google/google-token-verifier')
  >();
  return { ...actual, createGoogleTokenVerifier: () => ({ verify: verifyMock }) };
});

const testMongo: TestMongo = await createTestMongo();
const describeWithDb = testMongo.available ? describe : describe.skip;

if (!testMongo.available) {
  console.warn('Skipping contact integration tests: no MongoDB is reachable.');
}

const app = createApp();
const VALID_TOKEN = 'a'.repeat(24);

/** Signs in a user and returns their session cookie. */
async function signIn(googleId: string, email: string, name: string): Promise<string> {
  verifyMock.mockResolvedValueOnce({
    googleId,
    email,
    emailVerified: true,
    name,
    pictureUrl: null,
  });
  const response = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const cookie = cookies.find((value) => value.startsWith('aca_session='));
  if (!cookie) {
    throw new Error('Sign-in did not return a session');
  }
  return cookie.split(';')[0] as string;
}

function createContact(cookie: string, body: Record<string, unknown>) {
  return request(app).post('/api/v1/contacts').set('Cookie', cookie).send(body);
}

afterAll(async () => {
  await testMongo?.disconnect();
});

afterEach(async () => {
  vi.clearAllMocks();
  if (!testMongo.available) {
    return;
  }
  await Promise.all([
    UserModel.deleteMany({}),
    WorkspaceModel.deleteMany({}),
    SessionModel.deleteMany({}),
    ContactModel.deleteMany({}),
  ]);
});

describeWithDb('contacts CRUD', () => {
  it('creates a contact and normalizes the phone number', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');

    const response = await createContact(cookie, {
      name: 'Rahul Sharma',
      phone: '09876543210',
      email: 'rahul@example.com',
      company: 'ABC Pvt Ltd',
      tags: ['Candidate'],
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      tags: ['candidate'],
    });
    expect(response.body.data).not.toHaveProperty('workspaceId');

    const stored = await ContactModel.findById(response.body.data.id).exec();
    expect(stored!.phoneNormalized).toBe('+919876543210');
  });

  it('rejects a contact with neither phone nor email', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    const response = await createContact(cookie, { name: 'No Channel' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate phone even when formatted differently', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    await createContact(cookie, { name: 'Rahul', phone: '9876543210' });

    const response = await createContact(cookie, { name: 'Rahul Again', phone: '+91 98765 43210' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONTACT_DUPLICATE');
  });

  it('updates and then deletes a contact', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    const created = await createContact(cookie, { name: 'Rahul', email: 'rahul@example.com' });
    const id = created.body.data.id as string;

    const updated = await request(app)
      .put(`/api/v1/contacts/${id}`)
      .set('Cookie', cookie)
      .send({ name: 'Rahul Sharma', email: 'rahul@example.com', company: 'ABC' });

    expect(updated.status).toBe(200);
    expect(updated.body.data.company).toBe('ABC');

    const deleted = await request(app).delete(`/api/v1/contacts/${id}`).set('Cookie', cookie);
    expect(deleted.status).toBe(200);
    expect(await ContactModel.countDocuments({})).toBe(0);
  });

  it('rejects a malformed contact id', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    const response = await request(app).get('/api/v1/contacts/not-an-id').set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describeWithDb('contacts listing', () => {
  async function seed(cookie: string): Promise<void> {
    await createContact(cookie, { name: 'Rahul Sharma', email: 'rahul@example.com', company: 'ABC', tags: ['candidate'] });
    await createContact(cookie, { name: 'Priya Singh', email: 'priya@example.com', company: 'XYZ', tags: ['client'] });
    await createContact(cookie, { name: 'Amit Kumar', phone: '9812345678', company: 'ABC' });
  }

  it('paginates and reports totals', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    await seed(cookie);

    const response = await request(app)
      .get('/api/v1/contacts?page=1&pageSize=2')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });
  });

  it('searches by name and company', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    await seed(cookie);

    const byName = await request(app).get('/api/v1/contacts?search=priya').set('Cookie', cookie);
    expect(byName.body.data.items).toHaveLength(1);
    expect(byName.body.data.items[0].name).toBe('Priya Singh');

    const byCompany = await request(app).get('/api/v1/contacts?search=ABC').set('Cookie', cookie);
    expect(byCompany.body.data.items).toHaveLength(2);
  });

  it('filters by tag and sorts by name', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    await seed(cookie);

    const tagged = await request(app).get('/api/v1/contacts?tag=client').set('Cookie', cookie);
    expect(tagged.body.data.items).toHaveLength(1);

    const sorted = await request(app)
      .get('/api/v1/contacts?sortBy=name&sortDir=asc')
      .set('Cookie', cookie);
    expect(sorted.body.data.items.map((c: { name: string }) => c.name)).toEqual([
      'Amit Kumar',
      'Priya Singh',
      'Rahul Sharma',
    ]);
  });

  it('filters by whether an email exists', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    await seed(cookie);

    const withEmail = await request(app).get('/api/v1/contacts?hasEmail=true').set('Cookie', cookie);
    expect(withEmail.body.data.items).toHaveLength(2);

    const withoutEmail = await request(app)
      .get('/api/v1/contacts?hasEmail=false')
      .set('Cookie', cookie);
    expect(withoutEmail.body.data.items).toHaveLength(1);
  });

  it('lists the distinct tags for the workspace', async () => {
    const cookie = await signIn('g1', 'recruiter@example.com', 'Recruiter One');
    await seed(cookie);

    const response = await request(app).get('/api/v1/contacts/tags').set('Cookie', cookie);
    expect(response.body.data.tags).toEqual(['candidate', 'client']);
  });
});

describeWithDb('contacts user isolation', () => {
  it('never leaks another workspace contact through any endpoint', async () => {
    const cookieA = await signIn('g1', 'a@example.com', 'User A');
    const cookieB = await signIn('g2', 'b@example.com', 'User B');

    const created = await createContact(cookieA, {
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
    });
    const contactId = created.body.data.id as string;

    // Listing
    const listB = await request(app).get('/api/v1/contacts').set('Cookie', cookieB);
    expect(listB.body.data.items).toHaveLength(0);

    // Direct read with a known, valid id.
    const readB = await request(app)
      .get(`/api/v1/contacts/${contactId}`)
      .set('Cookie', cookieB);
    expect(readB.status).toBe(404);
    expect(readB.body.error.code).toBe('CONTACT_NOT_FOUND');

    // Update attempt.
    const updateB = await request(app)
      .put(`/api/v1/contacts/${contactId}`)
      .set('Cookie', cookieB)
      .send({ name: 'Hijacked', email: 'hijack@example.com' });
    expect(updateB.status).toBe(404);

    // Delete attempt.
    const deleteB = await request(app)
      .delete(`/api/v1/contacts/${contactId}`)
      .set('Cookie', cookieB);
    expect(deleteB.status).toBe(404);

    // The record is untouched.
    const stored = await ContactModel.findById(contactId).exec();
    expect(stored!.name).toBe('Rahul Sharma');
  });

  it('allows both workspaces to use the same email independently', async () => {
    const cookieA = await signIn('g1', 'a@example.com', 'User A');
    const cookieB = await signIn('g2', 'b@example.com', 'User B');

    const first = await createContact(cookieA, { name: 'Rahul', email: 'rahul@example.com' });
    const second = await createContact(cookieB, { name: 'Rahul', email: 'rahul@example.com' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('does not expose tags from another workspace', async () => {
    const cookieA = await signIn('g1', 'a@example.com', 'User A');
    const cookieB = await signIn('g2', 'b@example.com', 'User B');

    await createContact(cookieA, { name: 'Rahul', email: 'r@example.com', tags: ['secret-tag'] });

    const tagsB = await request(app).get('/api/v1/contacts/tags').set('Cookie', cookieB);
    expect(tagsB.body.data.tags).toEqual([]);
  });

  it('requires authentication on every contact endpoint', async () => {
    const id = new mongoose.Types.ObjectId().toString();

    for (const call of [
      request(app).get('/api/v1/contacts'),
      request(app).get('/api/v1/contacts/tags'),
      request(app).post('/api/v1/contacts').send({ name: 'X', email: 'x@y.com' }),
      request(app).get(`/api/v1/contacts/${id}`),
      request(app).put(`/api/v1/contacts/${id}`).send({ name: 'X', email: 'x@y.com' }),
      request(app).delete(`/api/v1/contacts/${id}`),
    ]) {
      const response = await call;
      expect(response.status).toBe(401);
    }
  });
});
