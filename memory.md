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

Decision: **Exotel** (UL-VNO licensed, REST, no client SDK, webhooks). Superseded in Phase 10:
calling is domestic only, so the planned Twilio international adapter was dropped entirely.

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

The provider is resolved per call from the destination dial code, never from a global setting.
Calling is DOMESTIC ONLY - agent and contact are in the same country - so there is no
cross-border calling and no international CPaaS. `+91` goes to Exotel; any country without a
licensed operator in `DOMESTIC_PROVIDERS` is refused with `CALL_DESTINATION_UNSUPPORTED`.
Twilio was removed entirely: an Indian licence does not authorise dialling a foreign number,
and without cross-border calling a second provider bought nothing.

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

## Phase 12 - Unified Communication Timeline

A contact's history lives in four collections (calls, emails, notes, import batches), so no
single query can order it. The service reads each source workspace-scoped, normalizes every
record to one `TimelineEntryDto` shape, and merges in memory. Normalizing first is what lets
the view sort by time alone without knowing where an entry came from.

Ownership is checked once, up front, by loading the contact within the workspace scope. If
that fails nothing else is read, and the error is 404 rather than 403 so the API never
confirms that an id exists in another workspace.

Ordering uses the moment the thing happened, not when the row was written: a call sorts by
`startedAt` and an email by `sentAt`, falling back to `createdAt` only when unsent. An email
drafted before a call but sent after it therefore lands after the call, which is what a user
expects to read.

Notes are the only entry a user writes directly. They may reference a call, but only one
inside the same workspace.

Follow-up: a finished call (completed / no_answer / busy / failed) offers a follow-up email.
An in-progress call does not, because the outcome is not known yet. The draft is built
server-side and the link carries only ids, so no message content travels through the URL.
The composer prefills and stops there - nothing is ever sent automatically.

Gotcha worth keeping: `router.use(authenticate)` on a router mounted at the shared `/api/v1`
path also intercepts unmatched paths, turning the unknown-route 404 into a misleading 401.
Attach `authenticate` per route instead. The existing `app.spec.ts` not-found test caught it.

## Phase 13 - Analytics

Every figure is produced by MongoDB aggregation, never by loading documents and counting in
Node. Bucketing passes `timezone` to `$dateToString` so a "day" is the reader's local day,
and the browser sends its own IANA zone with each request.

Metric definitions are shipped as data (`GET /api/v1/analytics/definitions`) and rendered
next to the numbers. A rate is meaningless without its denominator, and two people reading
"success rate" differently is how reporting loses trust. The denominators chosen:
- callSuccessRate = connected / total calls placed.
- averageCallDuration = talk time / CONNECTED calls only. Including unanswered calls would
  drag the mean toward zero and misrepresent conversation length.
- emailSuccessRate = sent / (sent + failed), i.e. delivery ATTEMPTS. Drafts and queued mail
  are excluded because they have not been attempted yet.
- importSuccessRate = rows imported / all rows read.

Bucket size defaults by range length (>120 days -> month, >31 -> week, else day) so a year
never renders 366 unreadable points; the client can override it. Node's ISO-week key builder
mirrors Mongo's `%G-W%V` exactly, otherwise filled gap buckets would not line up with
aggregated ones. Gaps are filled with explicit zeros: a chart that omits quiet days implies
activity was continuous and distorts the trend.

Bug found and fixed while here: `dashboard.repository.ts` still counted `status: 'missed'`,
a value deleted in the Phase 10 status rename, so missedCalls was silently always 0. It now
counts `no_answer` and `busy`. Worth remembering that renaming an enum does not fail loudly
in aggregation - `$eq` on a dead value just returns zero forever.

Reused rather than duplicated: `DashboardRangeFilterComponent` and the pure
`DashboardActivityChartService` (SVG geometry, no charting dependency).

## Phase 14 - Capacitor Mobile Packaging

Packaged the existing Angular build for Android and iOS. No separate mobile codebase.

The scope in phases.md listed microphone permissions, audio permissions, a native voice SDK
bridge, CallKit and Android Telecom. All of those were dropped, and the reason is the Phase 9
finding: calls are bridged by the provider over the PSTN and answered on the user's own
handset dialler. The app never captures or plays call audio, so requesting microphone access
would be asking for a permission it cannot justify, and CallKit/Telecom exist to let an app
present its OWN VoIP calls to the OS - ours are ordinary carrier calls the native dialler is
already showing. `PlatformCapabilities.hasInAppVoice` and `needsMicrophonePermission` are
hardcoded false on every platform, with a test asserting it for web, android and ios.

Real problems native packaging exposed, all fixed:
- A relative `/api/v1` resolves to the DEVICE inside a WebView. Added `nativeApiOrigin` plus
  `ApiUrlService`, which throws loudly if a native build has no origin configured rather than
  silently 404ing against the device.
- `authInterceptor` matched only `url.startsWith('/api')`, so on native every request would
  have lost `withCredentials` and appeared logged out. It now parses absolute URLs and
  matches on pathname.
- Native is cross-origin, so `CORS_ORIGINS` needs `http://localhost` and
  `capacitor://localhost`, and the session cookie needs `SameSite=None` + `Secure`. Both
  documented in `.env.example`.

`SecureStorageService` is a no-op on the web on purpose: no browser store is XSS-safe, and the
web session is already an httpOnly cookie the page cannot read. A localStorage fallback would
weaken the web build to match the phone. A test asserts nothing is written there.

`frontend/android` and `frontend/ios` are gitignored - regenerable from config plus the web
build.


## Phase 15 — Security Hardening

A full audit of the delivered surface, with each finding either fixed or
documented. The audit was run empirically wherever possible: a claim like
"secrets are redacted" is only trustworthy if something actually reads the log
output back.

### Finding 1 (high) — every secret was being logged in plaintext

`pino`'s `redact.paths` matches paths *literally*: a bare key such as
`token` does not match `config.token` or `err.ctx.token`. The original list
was written as bare keys, so it silently stopped covering anything nested,
and every secret added since Phase 7 was reaching the log stream in the
clear — `exotelApiToken`, `webhookSecret`, `authToken`, `encryptionKey`,
`sessionToken`, `MONGODB_URI` (which embeds credentials) and more.

This was proved with a probe that captured `process.stdout` before it was
fixed, and the probe is now a committed test
(`src/security/log-redaction.spec.ts`, 63 cases) that asserts on real pino
output at three nesting depths rather than on the shape of the path list.
`logger.ts` now generates `key`, `*.key` and `*.*.key` for each secret name
and exports `LOG_REDACT_PATHS` so the suite checks the real value.

### Finding 2 (medium) — six writes were not workspace-scoped

`markSending`, `markSent`, `markFailed`, `resetForRetry`, `applyStatus` and
`incrementAttachmentUsage` filtered by `_id` alone. None was exploitable
today, because every caller had already resolved the record within a
workspace. They were fixed anyway: an authorization boundary that depends on
callers being careful is one refactor away from being a cross-tenant write.
All six now take a scope and filter on `workspaceId`, and
`findByIdAndUpdate` is banned outright in workspace-owned repositories in
favour of `findOneAndUpdate`, which can express a tenant filter.

`src/security/repository-scoping.spec.ts` enforces this statically. That
matters here because the integration tests skip when no MongoDB is
reachable, so a dynamic-only check would have proved nothing in this
environment. The two extra cases (`resetForRetry`, `applyStatus`) were found
by that test, not by reading the code.

### Finding 3 (low) — the rate limiters were never exercised

They relax to a 100,000 ceiling under `NODE_ENV=test`, so no existing test
could ever trip one. The production values moved into an exported
`RATE_LIMITS` constant, and the security suite builds its own limiter from
those same values to prove they actually throttle and return 429.

### Verified with no change required

- **Authorization**: every one of the 47 mounted routes rejects an
  anonymous caller. Verified by a test that enumerates the Express router at
  runtime, so routes added in later phases are covered automatically. The two
  public routes are allowlisted with a reason: sign-in has no session yet,
  and the telephony webhook is authenticated by HMAC because a provider has
  no cookie.
- **Webhook signatures**: HMAC-SHA256 over the raw body, compared with
  `timingSafeEqual`, and the body is parsed only after the signature matches.
- **Sessions**: opaque random tokens, only the SHA-256 hash is stored, lookups
  filter on `expiresAt`, and a TTL index reaps expired rows.
- **Credentials**: the ciphertext field is `select: false`, so it is excluded
  from every query unless asked for, and no response DTO carries a password.
- **Uploads**: memory storage, 10 MB cap, single file, extension allowlist —
  no filesystem path is derived from user input, so there is no traversal
  surface.
- **Error responses**: unknown errors collapse to a generic 500 with no stack
  or driver detail.
- **Secrets in Git**: a scan of all tracked files for key patterns and
  hardcoded assignments found nothing; only `.env.example` is tracked.
- **Dependencies**: `npm audit` reports 0 vulnerabilities in both packages.

### Known limitations

- Cross-tenant *runtime* behaviour is asserted statically, not by two real
  users hitting a live database, because no MongoDB is reachable here. The
  26 integration tests still skip.
- Rate limiting is per-process in-memory, so limits multiply by instance
  count behind a load balancer. A shared store is needed before scaling out.
- There is no automated dependency scanning in CI yet; `npm audit` was run
  by hand.
