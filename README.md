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
- Remaining feature phases (Gmail connection, AutoMail, AutoCall) are not implemented yet.

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
