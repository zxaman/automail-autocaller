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
- Phase 9 telephony provider evaluation: complete (decision phase; see `telephony-evaluation.md`).
- Phase 10 AutoCall: complete. Provider-backed calling via PSTN bridging (Exotel for +91),
  signed webhooks, a call state machine, calling screen, history, and a manually advanced
  queue. There is no `tel:` fallback and no in-app audio.
- Calling is domestic only: the agent and the contact are in the same country. Cross-border
  calling is out of scope, so no international CPaaS is used. Serving a new country means
  onboarding an operator licensed there.
- Phase 11 call recording: cancelled. All recording surface has been removed from the code.
- Phase 14 Capacitor mobile packaging: complete. Shared Angular build wrapped for Android and
  iOS, with a platform capability service, OS-backed secure storage, connectivity and
  lifecycle awareness, and a native-aware API origin. No microphone, audio, CallKit, or
  Telecom integration: see the capability table below for why.
- Phase 13 analytics: complete. Server-side aggregation of call, email, and import
  performance over a timezone-aware custom date range, with day/week/month bucketing,
  a most-contacted ranking, and published definitions for every metric.
- Phase 12 unified communication timeline: complete. One chronological history per contact
  merging calls, emails (with attachment metadata), notes, and the import that created the
  contact, plus a call-completed follow-up that prefills the composer.
- Phase 15 security hardening: complete. See the Security section below.
- Phase 16 production readiness: complete. Production images, deployment configuration,
  meaningful health checks, metrics, graceful shutdown, verified backup scripts, API
  reference (`docs/api.md`) and an on-call runbook (`docs/runbook.md`). No image has been
  built or run here, and the backup scripts have not been executed: neither Docker nor
  MongoDB is available in the development sandbox.

All 16 planned phases are delivered except Phase 11 (call recording), which was cancelled.

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
2. Use **MongoDB 4.4 or newer**. The analytics most-contacted ranking uses the `$unionWith`
   aggregation stage, which older servers do not recognise. The version is checked once at
   startup and logged; an older server still boots, with that one ranking unavailable.
3. Copy `.env.example` to `.env`.
4. Start local infrastructure with `docker compose up -d`.
5. Install backend dependencies with `npm install --prefix backend`.
6. Install frontend dependencies with `npm install --prefix frontend`.
7. Start the API with `npm run api:dev`.

The health endpoint is available at `http://localhost:3000/api/v1/health`.

## Local frontend setup

1. Install dependencies with `npm install --legacy-peer-deps --prefix frontend`.
2. Start the Angular dev server with `npm run web:dev`.
3. Open `http://localhost:4200`. Requests to `/api` are proxied to the backend on port 3000.

Frontend tests run with `npm run web:test` and a production build with `npm run web:build`.


## Web and mobile capability differences

The same Angular build runs in a browser and inside a Capacitor WebView. These are the
differences the code actually accounts for, exposed through `PlatformService` so a feature
asks for a capability rather than testing for a platform name.

| Capability | Web | Android / iOS | Why |
| --- | --- | --- | --- |
| Session storage | httpOnly cookie | httpOnly cookie + OS-backed `Preferences` for small values | The browser cannot read an httpOnly cookie, which is the safer arrangement. There is deliberately no `localStorage` fallback: adding one would weaken the web build to match the phone. |
| API origin | relative `/api/v1` | absolute `nativeApiOrigin` | Inside a WebView the page origin is the device, so a relative path requests a server that does not exist there. |
| CORS | same-origin | cross-origin | Native origins (`http://localhost`, `capacitor://localhost`) must be in `CORS_ORIGINS`, and the session cookie needs `SameSite=None` + `Secure`. |
| Connectivity | browser online/offline events | `@capacitor/network` | A phone loses signal in ways a desktop rarely does, and this app places real calls. |
| App lifecycle | none | `@capacitor/app` resume events | The OS suspends the app during a call; on resume the screen may be showing stale data. |
| In-app voice | **no** | **no** | Calls are bridged by the telephony provider over the PSTN and answered on the handset dialler. The app never touches call audio. |
| Microphone permission | **never requested** | **never requested** | A direct consequence of the row above: there is no audio to capture, so asking would be requesting a permission the app cannot justify. |
| CallKit / Android Telecom | not applicable | not integrated | Both exist to let an app present *its own* VoIP calls to the OS. Our calls are ordinary carrier calls placed by the provider, so the native dialler already handles them; integrating would mean duplicating a call UI the OS is already showing. |

### Building the mobile apps

```bash
npm run mobile:add:android   # once, requires Android Studio + SDK
npm run mobile:add:ios       # once, requires Xcode (macOS only)
npm run mobile:sync          # after every web build
```

Set `nativeApiOrigin` in `frontend/src/environments/environment.prod.ts` to the HTTPS API
origin before a release build. The generated `frontend/android` and `frontend/ios` folders are
regenerable and therefore not committed.


## Security

Security controls are enforced by tests in `backend/src/security/`, which run
as part of `npm run api:test`.

| Control | Where | Test |
| --- | --- | --- |
| Every route requires a session | `middleware/auth.middleware.ts` | `route-authorization.spec.ts` enumerates the live router, so new routes are covered automatically |
| Secrets never reach the logs | `infrastructure/logger/logger.ts` | `log-redaction.spec.ts` asserts on real pino output at three nesting depths |
| Queries cannot cross a workspace | `modules/*/*.repository.ts` | `repository-scoping.spec.ts` |
| Rate limits actually throttle | `middleware/rate-limit.middleware.ts` | `rate-limit.spec.ts` |
| Webhooks verified by HMAC | `infrastructure/telephony/exotel-provider.ts` | signature checked before the body is parsed |
| Gmail App Passwords encrypted at rest | `infrastructure/crypto/credential-cipher.ts` | AES-256-GCM, `select: false`, never returned by the API |

Two routes are public by design: `POST /api/v1/auth/google` (sign-in, no
session exists yet) and the telephony webhook (authenticated by HMAC, since a
provider cannot send a cookie).

### Operational notes

- `CREDENTIAL_ENCRYPTION_KEY` and `TELEPHONY_WEBHOOK_SECRET` must be set from a
  secret manager, never committed. Rotating the encryption key requires
  re-encrypting stored credentials; there is no migration script yet.
- Rate limits are held in process memory, so effective limits multiply by
  instance count behind a load balancer. Move to a shared store before scaling
  horizontally.
- Run `npm audit` in both `backend/` and `frontend/` before a release; it is
  not yet wired into CI.


## Deployment

Production images are multi-stage and run as a non-root user. The build context
for both is the **repository root**, because the TypeScript configs extend a
shared file one level up.

```bash
cp .env.production.example .env.production   # then fill from your secret manager
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl -sf https://<host>/api/v1/health/ready
```

The API **refuses to start in production** when a required setting is missing or
unsafe, and names what is wrong. This is deliberate: a container that boots
half-configured fails later, in front of a user, instead of at deploy time.
It checks for a Google client ID, a credential encryption key, a non-localhost
MongoDB URI, `COOKIE_SECURE=true`, the Redis queue driver, and — if telephony is
configured at all — every Exotel value including the webhook secret.

`docs/api.md` documents all 51 endpoints. `docs/runbook.md` is the on-call
guide: symptoms, how to confirm them, and what to do.

### Health and observability

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/health/live` | Liveness. Checks nothing else, so a dependency blip cannot cause a restart loop. |
| `GET /api/v1/health/ready` | Readiness. 503 when a hard dependency is down, so the load balancer drains the instance. Reports dependency state, queue depth, uptime and version. |
| `GET /api/v1/metrics` | Prometheus counters. Requires `METRICS_TOKEN`; returns 404 when unset. |

Readiness distinguishes **degraded** from **not-ready**: running on the
in-process queue is degraded (it works, but a restart loses queued mail) and
keeps serving traffic, while an unreachable database or queue is not-ready and
takes the instance out of rotation.

Shutdown is graceful. On SIGTERM the server stops accepting connections, lets
in-flight requests finish, closes the queue, then exits — with a 15 s cap so a
stuck socket cannot hang the container.

### Backups

```bash
MONGODB_URI="..." npm run db:backup            # dumps, then verifies by reading back
CONFIRM=yes MONGODB_URI="..." npm run db:restore backups/automail-<ts>.gz
```

`backup-mongodb.sh` always re-reads each archive with `mongorestore --dryRun`,
because `mongodump` can exit 0 and still leave an unusable file. Restore
defaults to a dry run and needs `CONFIRM=yes` to write.

**Attachments are not included in the database dump.** Back up the attachments
volume separately, or use object storage with versioning enabled.
