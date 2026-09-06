# AutoCall & AutoMail

A centralized communication workspace for importing contacts, making provider-backed calls, sending personalized email, and tracking communication activity.

## Project documentation

- [Project requirements](document.md)
- [Architecture](architecture.md)
- [Development rules](rules.md)
- [Development phases](phases.md)
- [Design system](design.md)
- [Project memory](memory.md)

## Current status

- Phase 1 backend foundation: complete.
- Phase 2 authentication and workspace foundation: complete.
- Phase 3 Angular foundation and design system: complete (see `frontend/README.md`).
- Phase 4 contacts: complete.
- Phase 5 dashboard foundation: complete.
- Phase 6 flexible spreadsheet import: complete.
- Phase 7 Gmail account connection: complete.
- Phase 8 AutoMail composer and queue: complete.
- Remaining feature phases (AutoMail, AutoCall) are not implemented yet.

## Authentication

Sign-in is Google-only. The browser obtains a short-lived Google ID token, the API verifies
it against Google, provisions the user and a private workspace on first login, and issues an
opaque session in an HttpOnly cookie. Only a SHA-256 hash of the session token is stored.

Set `GOOGLE_CLIENT_ID` in `.env` and `googleClientId` in
`frontend/src/environments/environment.ts` to enable it. When unset, the API returns
`GOOGLE_AUTH_NOT_CONFIGURED` and the login screen says so rather than faking a session.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/google` | public | Exchange a Google ID token for a session |
| GET | `/api/v1/auth/me` | session | Current user and workspace |
| POST | `/api/v1/auth/logout` | session | Revoke the session server-side |

## Contacts

All contact endpoints require a session and are scoped to the caller's workspace. A contact
belonging to another workspace responds `404`, never `403`, so the API does not confirm that
an id exists elsewhere.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/contacts` | Paged list with search, filters, and sorting |
| GET | `/api/v1/contacts/tags` | Distinct tags in the workspace |
| POST | `/api/v1/contacts` | Create a contact |
| GET | `/api/v1/contacts/:id` | Single contact |
| PUT | `/api/v1/contacts/:id` | Update a contact |
| DELETE | `/api/v1/contacts/:id` | Delete a contact |

Query parameters: `page`, `pageSize` (max 100), `search`, `tag`, `company`, `source`,
`hasEmail`, `hasPhone`, `sortBy`, `sortDir`.

Phone numbers are normalized to E.164 before storage, so `9876543210`, `09876543210`, and
`+91 98765 43210` are recognized as the same number for duplicate detection.

## Dashboard

`GET /api/v1/dashboard` returns the whole workspace snapshot in one request: overview
counters, a daily activity series, and the five most recent calls, emails, and imports.

Every number is produced by MongoDB aggregation pipelines that begin with a `$match` on the
caller's `workspaceId`, so no cross-workspace document can enter a result and the client
never has to compute a metric itself.

| Parameter | Values | Purpose |
| --- | --- | --- |
| `preset` | `today`, `week`, `month`, `custom` | Range for the activity series (default `today`) |
| `timezone` | IANA zone, e.g. `Asia/Kolkata` | Day boundaries and bucketing (default `UTC`) |
| `from`, `to` | `YYYY-MM-DD` | Required when `preset=custom`, max 366 days |

Days are bucketed with MongoDB's `$dateToString` in the caller's timezone, so a call placed
at 02:00 IST is counted on the correct local date rather than the previous UTC day. An
unknown timezone falls back to `UTC` instead of failing the request. The activity series
always contains one point per day, including days with no activity, so charts render a
continuous axis.

The `calls`, `emails`, and `import_batches` collections are introduced here only so the
dashboard has something to aggregate; the logic that writes to them arrives in the phases
that own those features.

## Importing contacts

Import accepts `.xlsx`, `.xls`, and `.csv` up to 10 MB, and does **not** require the file to
use particular column names.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/imports/analyze` | Upload a file, get a suggested column mapping |
| POST | `/api/v1/imports/commit` | Import the rows using a confirmed mapping |
| GET | `/api/v1/imports` | Recent import batches |
| GET | `/api/v1/imports/:id` | One batch, including its row errors |

The flow is deliberately two-step. `analyze` parses the file, keeps the grid in a
short-lived server-side session (30 minutes), and returns a suggested mapping. Nothing is
written until `commit` is called with a mapping the user has confirmed.

**Header handling.** The header row is found by scoring the first ten rows, so title rows,
blank rows, and "generated on" stamps above the real headers are skipped. A file whose first
row is already data is detected as headerless and mapped by value analysis alone.

**Column matching.** Two independent signals decide each column: an alias registry matched
against the normalized header (`Phone No.`, `Mobile`, `Contact Number`, `Candidate`,
`Applicant`, `Email ID`, `Mail` and many more), and analysis of the column's own values.
Where they agree, confidence is high and the mapping is pre-accepted. Generic headers such
as `Number`, `User`, and `Details` are capped below the auto-accept threshold and always
require explicit confirmation. Two columns can never claim the same field.

**Row handling.** First-name and last-name columns are combined, phones are normalized to
E.164, emails are format-checked, and a row is rejected if it has no name or no way to
reach the contact. Failures are reported per row using the row number as it appears in
Excel. Duplicates - both against existing contacts and repeats within the same file - are
resolved by the chosen strategy: `skip`, `update`, or `import`.

## Connecting a Gmail account

Sending uses Gmail SMTP with a **Google-generated App Password**, never a normal account
password. App Passwords require 2-Step Verification and are issued at
<https://myaccount.google.com/apppasswords>.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/email-accounts` | Connected accounts (never includes credentials) |
| POST | `/api/v1/email-accounts` | Connect or reconnect an account |
| POST | `/api/v1/email-accounts/:id/verify` | Re-check a stored credential against Gmail |
| POST | `/api/v1/email-accounts/:id/test` | Send a test message |
| PATCH | `/api/v1/email-accounts/:id/default` | Choose the default sending account |
| DELETE | `/api/v1/email-accounts/:id` | Disconnect and delete the credential |

### How the credential is protected

- **Verified before stored.** `POST /email-accounts` authenticates against Gmail first; a
  credential that does not work is never written to the database.
- **Encrypted with AES-256-GCM.** GCM is authenticated, so a tampered record fails to
  decrypt rather than yielding altered plaintext. A fresh random IV is used per encryption.
- **The key lives outside MongoDB**, in `CREDENTIAL_ENCRYPTION_KEY`. Without it the API
  returns `GMAIL_ENCRYPTION_NOT_CONFIGURED` instead of storing anything insecurely.
- **Never returned.** The schema marks the credential `select: false`, the DTO mapper lists
  fields explicitly, and `toJSON`/`toObject` strip it. Three independent layers.
- **Never logged.** Pino redacts `appPassword`, `credential`, and `ciphertext` at top level,
  inside `req.body`, and one level deep; this is covered by tests.
- **Decrypted only for SMTP**, inside a single call, on a transport that is closed
  immediately afterwards.
- **Disconnect deletes the record**, so no recoverable secret material is left behind.

Failures are mapped to a fixed vocabulary — `SMTP_AUTH_FAILED`, `SMTP_RATE_LIMITED`,
`SMTP_TIMEOUT`, `SMTP_CONNECTION_FAILED`, `SMTP_UNAVAILABLE` — because raw SMTP responses
echo the submitted username and invite credential probing.

Generate a key with:

```bash
openssl rand -hex 32
```

Rotating the key invalidates every stored credential and each user must reconnect.

## Sending email (AutoMail)

The composer at `/emails` renders and queues **one message per recipient**. There is no
shared To/Cc/Bcc path anywhere in the send pipeline, so recipients can never see who else
was contacted, and each delivery carries its own status, attempt count, and failure reason.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/email-templates` | List saved templates |
| `POST` | `/api/v1/email-templates` | Create a template |
| `PUT` | `/api/v1/email-templates/:id` | Update a template |
| `DELETE` | `/api/v1/email-templates/:id` | Delete a template |
| `GET` | `/api/v1/email-signatures` | List signatures |
| `POST` | `/api/v1/email-signatures` | Create a signature |
| `DELETE` | `/api/v1/email-signatures/:id` | Delete a signature |
| `GET` | `/api/v1/email-attachments` | List the reusable attachment library |
| `POST` | `/api/v1/email-attachments` | Upload a file (multipart field `file`) |
| `DELETE` | `/api/v1/email-attachments/:id` | Remove an attachment |
| `POST` | `/api/v1/emails/preview` | Render the draft for one contact |
| `POST` | `/api/v1/emails/send` | Queue a personalized send |
| `GET` | `/api/v1/emails` | Email history (`page`, `pageSize`, `status`, `contactId`) |
| `GET` | `/api/v1/emails/:id` | One delivery |
| `POST` | `/api/v1/emails/:id/retry` | Re-queue a failed delivery |

### Personalization

Templates use `{{ contact.name }}` style placeholders. Only a fixed whitelist resolves
(`contact.name`, `firstName`, `email`, `phone`, `company`, `designation`, `location`, and
`sender.name`, `sender.email`); anything else renders as empty rather than reaching into
the object graph. Values are HTML-escaped before insertion and the finished body is
sanitized, so contact data cannot inject markup or script. Subjects have control
characters stripped to prevent header injection.

The rendered body is **frozen onto each email record at compose time**. Editing or
deleting a template afterwards cannot change a message that is already queued, and the
history shows exactly what was sent.

### Queue and throttling

Sends run through a queue driver chosen by `EMAIL_QUEUE_DRIVER`:

- `memory` (default) — no extra infrastructure, but queued jobs are lost on restart and
  do not coordinate across instances. Fine for development.
- `redis` — BullMQ-backed, survives restarts, and shares its rate limiter across every
  worker. **Use this in production.**

Either way jobs run one at a time with at least `EMAIL_SEND_INTERVAL_MS` between them.
This paces delivery to stay inside Gmail's sending limits; it is not a way around them.
Gmail caps free accounts at roughly 500 recipients per day and Workspace accounts at
about 2,000, and the application makes no attempt to evade that.

Retries are deliberate rather than blanket. Timeouts, rate limiting, and connection
failures are retried with exponential backoff. An authentication failure or a rejected
recipient is permanent: it is recorded, the account is flagged where relevant, and no
further attempts are made, because retrying would only waste quota.

### Attachments

Uploaded bytes go to object storage (`ATTACHMENT_STORAGE_DIR` locally, S3-compatible
storage in production) and only the key is kept in MongoDB. Identical content uploaded
twice is deduplicated by checksum. Executables and scripts are rejected at upload.

## Local backend setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Start local infrastructure with `docker compose up -d`.
4. Install backend dependencies with `npm install --prefix backend`.
5. Install frontend dependencies with `npm install --prefix frontend`.
6. Start the API with `npm run api:dev`.

The health endpoint is available at `http://localhost:3000/api/v1/health`.

## Local frontend setup

1. Install dependencies with `npm install --legacy-peer-deps --prefix frontend`.
2. Start the Angular dev server with `npm run web:dev`.
3. Open `http://localhost:4200`. Requests to `/api` are proxied to the backend on port 3000.

Frontend tests run with `npm run web:test` and a production build with `npm run web:build`.
