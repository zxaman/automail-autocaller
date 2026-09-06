# AutoCall & AutoMail — Project Memory

**Document status:** Initial memory template  
**Project stage:** Documentation before project creation  
**Last updated:** 2026-09-06

This file is updated after meaningful implementation work so future work can resume with accurate project context.

## Current Status

- Repository contains the architecture documentation and Phase 1 backend foundation.
- The Angular application and product feature modules have not been created yet.
- No database migrations or business collections have been created yet.
- No environment secrets have been added.
- No external provider credentials have been configured.
- Phase 0 documentation is complete.
- Phase 1 backend foundation is complete.
- Phase 3 Angular foundation and design system is complete.
- Phase 2 authentication and workspace foundation is complete.
- Phase 4 contacts is complete and awaiting review.
- Angular Material is adopted for complex interaction primitives; simple presentational components remain custom.
- Next planned phase: Phase 5 dashboard foundation after approval.

## Documents Created

- `document.md` — product requirements and feature scope
- `architecture.md` — system architecture, flow, structure, and technology decisions
- `rules.md` — engineering, security, library, error-handling, and AI boundaries
- `phases.md` — phased development roadmap and approval gates
- `design.md` — visual design system and UX guidelines
- `memory.md` — this project state and handoff record

## Current Phase

### Phase 4 — Contacts

Status: Implemented and awaiting review.

## Current File Being Worked On

No implementation file is currently being worked on. Phase 1 implementation is complete.

## Completed Work

- Product requirements documented.
- Flexible spreadsheet column mapping requirement documented.
- Provider-backed calling requirement documented.
- Gmail App Password security requirement documented.
- Angular and backend architecture documented.
- File storage and queue architecture documented.
- Design system direction documented.
- Development phases documented.
- Top-level `backend/` and `frontend/` folders created.
- Backend-local dependencies installed in `backend/node_modules`.
- Frontend Angular dependency workspace installed in `frontend/node_modules`.
- Node.js and Express TypeScript backend created.
- Environment validation added.
- MongoDB connection lifecycle added.
- Structured Pino logging added.
- Request ID middleware added.
- Helmet and CORS configuration added.
- JSON body-size limits added.
- Centralized error handling added.
- Liveness and readiness endpoints added.
- Docker Compose services for MongoDB and Redis added.
- Phase 1 API tests added.
- TypeScript build and tests pass.
- Angular 22 standalone workspace created with zoneless change detection.
- Strict TypeScript and strict template checking enabled.
- Design tokens, reset, mixins, and utilities added as SCSS.
- Application shell, sidebar, header, and mobile bottom navigation added.
- Functional auth and guest guards added.
- Functional auth, loading, and error HTTP interceptors added.
- ApiClient, Auth, Layout, Loading, Navigation, Notification, and FeatureFlag services added.
- Twelve shared presentation components and three shared pipes added.
- Nine lazy-loaded feature routes added with an honest phase placeholder where the backend is missing.
- Dashboard page wired to the backend aggregation endpoint with loading, empty, and error states.
- 27 frontend unit tests pass; development and production builds succeed.
- Google ID-token verification isolated behind a GoogleTokenVerifier interface.
- User, Workspace, and Session Mongoose models added with indexes and a session TTL index.
- Repository, service, controller, and route layers added for authentication.
- Private workspace provisioned on first login with orphan cleanup on failure.
- Opaque session tokens issued; only SHA-256 hashes are persisted.
- HttpOnly, SameSite=Lax session cookie with configurable secure flag and domain.
- Authenticate and authorize middleware added; AuthContext attached to every protected request.
- Zod request validation middleware and global plus auth-specific rate limiting added.
- Angular Material added and themed against the product design tokens.
- Google Identity Services button wired into the login screen.
- App initializer resolves the session once before the first route activates.
- Material menu for the account menu and a shared Material confirm dialog added.
- 21 backend tests pass; 12 database integration tests skip gracefully without MongoDB.
- 38 frontend tests pass. Build and test typechecks are both clean.
- Contact model added with workspace-scoped compound and partial unique indexes.
- Phone normalization utility added for E.164 duplicate detection.
- Contact repository enforces workspace scoping on every read and write.
- Contact service handles duplicate policy, not-found semantics, and unique-index races.
- Contact CRUD, search, filter, sort, pagination, and tag endpoints added.
- Contact list page, detail page, form dialog, card, and filter components added.
- Material paginator, select, chips, form fields, and dialog used for interaction primitives.
- Search debounced at 300ms with switchMap cancellation to avoid stale renders.
- 47 backend tests and 48 frontend tests pass.
- 26 backend integration tests skip in this sandbox because MongoDB binaries are unreachable.

## Pending Decisions

- Primary launch geography
- Telephony provider
- Web-only or web plus mobile MVP
- Whether to enable a real Google client ID for demo purposes
- Gmail App Password-only MVP versus OAuth timing
- Object storage provider
- Deployment target
- Initial workspace/team scope

## Important Constraints

- Do not use `tel:` as the production calling architecture.
- Do not fake calling functionality.
- Do not store Gmail App Passwords in plaintext.
- Do not store credentials in Angular local storage.
- Do not expose decrypted credentials through APIs.
- Do not allow cross-user resource access.
- Do not store large files directly in MongoDB.
- Do not bypass Gmail sending limits or anti-abuse controls.
- Do not claim unsupported native or provider features.
- Do not begin the next major phase without approval.

## Update Template

When updating this file, record:

### Date

`YYYY-MM-DD`

### Phase

Current phase name and status.

### Completed

- Work completed
- Important decisions
- Tests completed

### Files Created

- List files

### Files Modified

- List files

### Current Work

- File currently being worked on
- Current objective

### Next Step

- Review and approve Phase 1.
- Begin Phase 2 authentication and workspace foundation after approval.

### Known Issues

- The API currently has health and foundation routes only.
- The API startup requires MongoDB to be available.
- The `frontend/` package dependencies are installed, but the Angular workspace and feature screens are not created until the frontend foundation phase.
- Authentication, business models, and feature endpoints are not implemented yet.
- Redis is provisioned by Docker Compose but is not consumed until queue work begins.
- Per-phase branch creation and merging into `main` cannot be performed in this Arena session because work is fixed to `arena/01a07639-automail-autocaller`.

### Environment Changes

- Added `.env.example` with API, MongoDB, Redis, CORS, logging, and proxy configuration.
- Added Docker Compose MongoDB and Redis services.
- No provider credentials configured.

## Phase 5 - Dashboard foundation

Delivered `GET /api/v1/dashboard`, a single aggregation-backed snapshot endpoint, and wired
the existing dashboard page to it.

Backend:
- `modules/calls/call.model.ts`, `modules/emails/email.model.ts`,
  `modules/imports/import-batch.model.ts` - minimal schemas so the dashboard has collections
  to aggregate. Writing to them belongs to phases 6, 8, and 10.
- `shared/utils/date-range.ts` - preset and custom range resolution. `from` inclusive, `to`
  exclusive, DST-safe, unknown timezones fall back to UTC. 12 tests.
- `modules/dashboard/` - types, zod validation, repository (`$group` pipelines and
  `$dateToString` day bucketing, always scoped by `workspaceId`), service (derives rates and
  averages, fills empty days), controller, module. `routes/dashboard.routes.ts`.

Frontend:
- `dashboard-page.model.ts` updated to the real contract; service now owns range state and
  sends the browser timezone.
- `components/dashboard-range-filter/` - preset segmented control plus custom date pair.
- `components/dashboard-activity-chart/` - inline SVG grouped bar chart. Geometry lives in a
  separate injectable service so it is testable without rendering. No charting dependency.

Tests after phase 5: backend 85 pass + 26 skipped, frontend 58 pass.

Decision: the "today" metric cards stay pinned to today even when a wider range is selected,
so the range control only affects the activity chart. Mixing the two made the cards
ambiguous.

## Phase 6 - Flexible spreadsheet import

Two-step import: `POST /imports/analyze` parses and proposes a mapping, `POST /imports/commit`
writes with a mapping the user confirmed. Nothing is written until commit.

Backend (`modules/imports/`):
- `spreadsheet.parser.ts` - ExcelJS for xlsx/xls/csv into a `string[][]` grid. Numeric cells
  are stringified without scientific notation so phone numbers survive.
- `header-detector.ts` - scores the first ten rows to find the header, skipping title and
  blank rows. A row with no recognisable alias cannot be a header, which is what makes
  headerless files detectable.
- `header-alias.registry.ts` - alias table plus the ambiguous-header set.
- `value-analyzer.ts` - infers email/phone/name from values as ratios.
- `column-mapper.ts` - combines label and value evidence, caps generic headers below
  auto-accept, and resolves two-columns-one-field collisions.
- `row-builder.ts` - name combination, E.164 phones, email validation, tag splitting.
- `import-session.store.ts` - in-memory TTL store for parsed grids, workspace-scoped.
- `import.repository.ts` / `import.service.ts` / `import.controller.ts` / validation / mapper.
- `middleware/upload.middleware.ts` - multer memory storage, 10 MB cap.

Dependency note: the npm `xlsx` package is the abandoned 0.18.5 with two unpatched high CVEs
and SheetJS's own CDN is unreachable from this sandbox, so ExcelJS was used instead. A `uuid`
override pins its transitive dependency; `npm audit` is clean.

Frontend (`features/imports/`): `import-wizard-page/` three-step wizard plus
`components/import-file-drop/`, `components/import-column-mapper/`,
`components/import-result-summary/`. `ApiClientService.upload()` added for multipart.

Tests after phase 6: backend 140 pass + 26 skipped, frontend 69 pass.

Decision: the wizard blocks commit until every low-confidence column is confirmed and until
a name plus a phone-or-email are mapped. Guessing silently is how imports quietly corrupt an
address book.

## Phase 7 - Gmail account connection

Gmail SMTP sending via Google App Passwords, encrypted at rest with AES-256-GCM.

Backend:
- `infrastructure/crypto/credential-cipher.ts` - AES-256-GCM. Random IV per encryption,
  auth tag stored separately, versioned envelope. Rejects keys that are not 256-bit rather
  than padding them. 15 tests including tamper and wrong-key cases.
- `infrastructure/smtp/smtp-verifier.ts` - builds a transport per operation and closes it,
  so a decrypted password is never cached. Nodemailer logging is explicitly off.
- `infrastructure/smtp/smtp-error.ts` - maps raw SMTP failures to a safe fixed vocabulary.
- `modules/email-accounts/` - model (credential `select: false`, toJSON/toObject strip it,
  partial unique index for one default per workspace), repository (only
  `findByIdWithCredential` returns ciphertext), service, controller, validation, mapper.
- `middleware/rate-limit.middleware.ts` - added `credentialRateLimiter` (10 per 15 min).
- Logger redaction extended to nested paths, with `logger.spec.ts` proving it.

Frontend (`features/settings/`): `email-accounts-page/`, `components/connect-gmail-form/`
(App Password held in a component signal only until submit, cleared after), 
`components/email-account-card/`, models, service. Wired into the settings page.

Config: `CREDENTIAL_ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_TIMEOUT_MS`. No key means the feature is disabled, never a plaintext fallback.

Tests after phase 7: backend 198 pass + 26 skipped, frontend 78 pass.

Decision: the injected cipher is the only source of truth for whether the feature is on.
An earlier draft also re-read the env flag inside the service, which was a second
drift-prone copy of the same decision; the tests caught it.

Verified end-to-end against a local fake SMTP server: the API response carried no
credential field, the stored blob contained no plaintext, the server could still decrypt,
and the password never crossed the wire in cleartext.

## Phase 8 — AutoMail composer and queue

Delivered the sending pipeline: compose, personalize, queue, send, and track.

**Queue abstraction.** `QueueDriver` has two implementations. `InProcessQueue` runs jobs
one at a time with a configurable gap and needs no infrastructure; `RedisQueue` (BullMQ)
survives restarts and shares its limiter across workers. The sandbox has no Redis, so the
Redis driver is written to the same contract but exercised only through the shared
interface. `RetryableJobError` is the single signal that a job should be retried —
anything else thrown is permanent and is discarded rather than burning attempts.

**Rendering.** `template-renderer.ts` resolves a fixed variable whitelist. The order
substitute → escape → sanitize matters: contact data is HTML-escaped before it lands in
the document, so a contact named `<img onerror=...>` becomes inert text. Subjects have
control characters stripped against header injection.

**One record per recipient.** `compose()` renders per contact and writes N email records,
then enqueues N jobs — only after the records exist, so no job can reference a missing
row. The rendered body is frozen onto the record, which means editing a template later
cannot alter an already-queued message. Contacts without an email are reported as
`skipped` rather than failing the batch.

**Worker.** Resolves the credential for exactly one send, never caching it. Already-sent
messages are skipped so a duplicate job cannot double-send. Retryable failures
(timeout, rate limit, connection) throw `RetryableJobError`; auth failures mark the
message failed and flag the account.

**Storage.** Attachment bytes go to `ObjectStorage`, never MongoDB. `LocalObjectStorage`
namespaces keys by workspace, generates UUID filenames, and rejects any key that resolves
outside its root. Duplicate uploads are deduplicated by checksum.

Tests: backend 262 pass / 26 skipped, frontend 91 pass. Known gaps: no MongoDB or Redis in
this sandbox, so integration tests skip and the Redis driver is unverified against a real
server; the composer loads a 100-contact working set pending server-side recipient search.


## Phase 9 — Telephony provider evaluation (decision phase, no feature code)

The finding that reshaped the plan: **India prohibits domestic VoIP-to-PSTN dial-out.**
A WebRTC softphone in the browser or Capacitor shell cannot lawfully call an Indian
mobile or landline. The Telecommunications Act 2023 did not lift this. Twilio's own
India guidance confirms outbound calls to India must originate from non-Indian numbers,
which rules Twilio out as the primary provider despite `architecture.md` having named it.

The lawful model is **PSTN-to-PSTN bridging**: the provider dials the agent's handset,
then the contact, and patches the legs. Our app sends an API request and carries no audio.

The consequence to keep in mind for Phase 10: **mute, hold, DTMF, and speaker are the
handset's, not ours.** Rendering those buttons in-app would be fake calling UI and is
forbidden by rules.md. `TelephonyCapabilities` exists so the UI hides what the provider
genuinely cannot do, rather than showing dead controls.

Decision: **Exotel primary** (UL-VNO licensed, REST, no client SDK, recording + webhooks),
**Twilio behind the same interface** for international only.

Recording: India's one-party-consent baseline is not enough for a commercial product.
DPDP Act 2023 makes recorded audio personal data; full notice-and-consent compliance is
required by May 13, 2027. Defaults chosen: recording off, purpose-specific announcement,
timestamped consent log, per-workspace retention with deletion, private storage only.

Also: no auto-dialler. TRAI's UCC regime plus rules.md line 289 means the calling queue
stays manually advanced.

Artifacts: `telephony-evaluation.md`, `backend/src/infrastructure/telephony/telephony-provider.ts`,
revised `architecture.md` §6, telephony env keys in `.env.example`.

## Phase 10 - AutoCall

Calling is provider-backed and honest about what it is. The app never carries voice: it asks
the provider to dial the agent's own handset (leg 1), then the contact (leg 2), and bridge them.
Voice never touches the browser, the device audio stack, or a `tel:` link.

Because the agent is on a normal handset, mute / hold / speaker / DTMF are handset functions.
The server reports `TelephonyCapabilities`, the mapper turns them into `CallControls`, and the
UI renders only what the provider can actually do. On the Exotel path every one of those is
`false`, so the screen states plainly that audio is on the handset instead of drawing dead buttons.

The provider is resolved per call from the destination dial code, never from a global setting,
so the product stays pitchable outside India: `+91` goes to Exotel or is refused with
`CALL_DESTINATION_UNSUPPORTED`; other destinations go to Twilio.

Correctness details worth remembering:
- The webhook route is mounted before any JSON parser and before `authenticate`, using
  `express.text({ type: '*/*' })`, because re-serializing a parsed body changes the bytes and
  breaks HMAC verification. Signature check uses `timingSafeEqual`; JSON is parsed only after.
- `providerCallId` has a unique partial index, so a replayed webhook cannot fork a record.
- The state machine rejects duplicate, backwards, and post-terminal transitions, so a late or
  out-of-order webhook cannot resurrect a finished call.
- The provider call is made *before* the record is written, so a provider failure leaves no row.
- The client polls `/refresh` while a call is live to reconcile a lost webhook, and stops at a
  terminal status.
- The queue never advances on its own; `skipToNext` is only reachable from a user action.

Recording (former Phase 11) was cancelled and physically removed from the contract, the model,
and `.env.example`.
