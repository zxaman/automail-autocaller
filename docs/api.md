# API reference

Base URL: `/api/v1`. All responses use the envelope
`{ success, message, data | error }`.

Authentication is a `HttpOnly` session cookie (`aca_session`) issued by
`POST /auth/google`. Send it with every request; browsers do this
automatically when the SPA is served from the same origin as the API.

Errors return `{ success: false, message, error: { code } }`. Codes are stable
strings; messages are for humans and may change.

| Status | Meaning |
| --- | --- |
| 400 | Request failed validation |
| 401 | No valid session |
| 403 | Authenticated, but not permitted |
| 404 | Not found, or not visible to your workspace |
| 429 | Rate limited; back off and retry |
| 500 | Unexpected server error |

Every resource is scoped to the caller's workspace. A record belonging to
another workspace returns 404, not 403, so the API does not reveal that it
exists.

## Health and operations

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | Liveness. Always 200 while the process runs. |
| GET | `/health/live` | none | Same as `/health`. |
| GET | `/health/ready` | none | Readiness. 200 when able to serve, 503 otherwise. Reports dependencies, queue depth, uptime and version. |
| GET | `/metrics` | bearer | Prometheus text. 404 when `METRICS_TOKEN` is unset. |

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/google` | none | Exchange a Google ID token for a session. Rate limited. |
| GET | `/auth/me` | session | Current user and workspace. |
| POST | `/auth/logout` | session | Revoke the current session. |

## Contacts

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/contacts` | session | List with `search`, `tag`, `page`, `limit`. |
| POST | `/contacts` | session | Create. |
| GET | `/contacts/:id` | session | Fetch one. |
| PUT | `/contacts/:id` | session | Update. |
| DELETE | `/contacts/:id` | session | Delete. |
| GET | `/contacts/tags` | session | Distinct tags in the workspace. |
| GET | `/contacts/:id/timeline` | session | Merged calls, emails and notes. |
| GET | `/contacts/:id/follow-up-draft` | session | Suggested follow-up email. |
| POST | `/contacts/:id/notes` | session | Add a note. |
| DELETE | `/notes/:id` | session | Delete a note. |

## Imports

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/imports/analyze` | session | Upload CSV/XLSX, get inferred column mapping and a preview. |
| POST | `/imports/commit` | session | Apply a mapping and import rows. |
| GET | `/imports` | session | Import history. |
| GET | `/imports/:id` | session | One batch with row-level errors. |

Uploads are capped at 10 MB, one file per request.

## Email accounts

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/email-accounts` | session | Connected Gmail accounts. Never returns credentials. |
| POST | `/email-accounts` | session | Connect using a Gmail App Password. Rate limited. |
| POST | `/email-accounts/:id/verify` | session | Re-verify stored credentials. |
| POST | `/email-accounts/:id/test` | session | Send a test message to yourself. |
| PATCH | `/email-accounts/:id/default` | session | Set the default sender. |
| DELETE | `/email-accounts/:id` | session | Disconnect. |

## Email

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET/POST | `/email-templates` | session | List or create templates. |
| PUT/DELETE | `/email-templates/:id` | session | Update or delete. |
| GET/POST | `/email-signatures` | session | List or create signatures. |
| DELETE | `/email-signatures/:id` | session | Delete. |
| GET/POST | `/email-attachments` | session | List or upload reusable attachments. |
| DELETE | `/email-attachments/:id` | session | Delete. |
| POST | `/emails/preview` | session | Render a template against a contact without sending. |
| POST | `/emails/send` | session | Queue messages to contacts. Rate limited. |
| GET | `/emails` | session | Sent history with status filters. |
| GET | `/emails/:id` | session | One message. |
| POST | `/emails/:id/retry` | session | Re-queue a failed message. |

Sending is asynchronous: a 202-style response means queued, not delivered.
Poll `GET /emails/:id` or the timeline for the final status.

## Calls

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/calls` | session | Place a click-to-call. Rate limited. |
| GET | `/calls` | session | Call history. |
| GET | `/calls/:id` | session | One call. |
| POST | `/calls/:id/refresh` | session | Re-poll the provider for status. |
| POST | `/calls/:id/cancel` | session | Cancel a ringing call. |
| POST | `/webhooks/telephony/:provider` | HMAC | Provider status callback. Not session-authenticated. |

The webhook is verified with HMAC-SHA256 over the raw body using
`TELEPHONY_WEBHOOK_SECRET`. Requests with a missing or wrong signature are
rejected before the body is parsed.

## Dashboard and analytics

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/dashboard` | session | Headline counters and recent activity. |
| GET | `/analytics` | session | `preset`, `timezone`, `from`, `to`, `granularity`, `leaderboardLimit`. |
| GET | `/analytics/definitions` | session | How each metric is calculated. |

Analytics responses are cached per workspace for 30 seconds.

## Rate limits

| Scope | Window | Limit |
| --- | --- | --- |
| Global | 1 min | 300 |
| Sign-in | 15 min | 20 |
| Credentials | 15 min | 10 |
| Email send | 1 min | 20 |
| Calling | 1 min | 10 |

Limits are per instance and per IP. Exceeding one returns 429 with a
`RateLimit` header indicating when to retry.
