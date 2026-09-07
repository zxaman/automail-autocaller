# Operational runbook

For whoever is on call. Each section is a symptom, how to confirm it, and what
to do.

## First checks, always

```bash
# Is the instance able to serve?
curl -s https://<host>/api/v1/health/ready | jq

# What is the send queue doing?
curl -s https://<host>/api/v1/health/ready | jq '.data.queueDepth'

# Counters (needs METRICS_TOKEN)
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://<host>/api/v1/metrics
```

`health/ready` returns 503 when a hard dependency is down. `health/live` stays
200 as long as the process runs — if liveness passes and readiness fails, the
process is fine and a dependency is not.

Logs are JSON, one object per line. Filter by level:

```bash
docker compose -f docker-compose.prod.yml logs api | jq -c 'select(.level >= 50)'
```

Levels: 60 fatal, 50 error, 40 warn, 30 info.

---

## Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps        # all services healthy?
curl -sf https://<host>/api/v1/health/ready
```

The API refuses to start in production if required configuration is missing,
and names what is missing. A container that exits immediately after deploy is
almost always this — check the logs before assuming an infrastructure fault.

### Rollback

```bash
IMAGE_TAG=<previous-tag> docker compose -f docker-compose.prod.yml up -d
```

Images are tagged with `IMAGE_TAG`. There are no destructive schema
migrations, so rolling the image back is sufficient; no data step is needed.

---

## Symptom: emails are queued but never sent

Confirm: `queueDepth` climbs and does not fall.

1. Is the queue driver right? `EMAIL_QUEUE_DRIVER` must be `redis`. If
   readiness reports the queue as `degraded`, it is on the in-process driver
   and every restart drops queued mail.
2. Is Redis reachable? `docker compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" ping`
3. Check failure codes:
   `curl -s -H "Authorization: Bearer $METRICS_TOKEN" .../metrics | grep email_send_failures`
   - `SMTP_AUTH_FAILED` — the user's Gmail App Password was revoked. The
     account is flagged; the user must reconnect it. Not an infrastructure
     problem, and retrying will not help.
   - `SMTP_TIMEOUT` — transient. Retries handle it. If it dominates, check
     egress to `smtp.gmail.com:465`.
4. Restart the API to restart the worker: `docker compose -f docker-compose.prod.yml restart api`.
   In-flight jobs survive because Redis holds them; the in-process driver does
   not survive this.

## Symptom: readiness returns 503

Read `data.dependencies`:

- `database: not-ready` — MongoDB is unreachable. Check the managed cluster's
  status, then that the instance IP is allow-listed, then `MONGODB_URI`.
- `queue: not-ready` — Redis is unreachable. The API keeps serving reads, but
  refuses new sends rather than accepting mail it cannot deliver.

## Symptom: calls fail to connect

1. Telephony is all-or-nothing. If any Exotel value is missing the API refuses
   to start in production, so a running instance has all of them.
2. Verify the caller ID is a number verified with Exotel; an unverified
   caller ID is rejected at dial time.
3. Check whether the number is on DND/NCPR. Indian regulation blocks
   commercial calls to registered numbers, and this is not a bug.
4. Status stuck at `ringing` usually means webhooks are not arriving. Confirm
   the provider's callback URL points at
   `https://<host>/api/v1/webhooks/telephony/exotel` and is reachable from the
   internet. Use `POST /calls/:id/refresh` to poll in the meantime.
5. `automail_webhooks_rejected_total` climbing means signature mismatch —
   `TELEPHONY_WEBHOOK_SECRET` differs between the app and the provider.

## Symptom: users are logged out unexpectedly

- Sessions last `SESSION_TTL_DAYS` (default 7) and are revoked server-side, so
  a restart does not sign anyone out.
- If it happens only on mobile, the cookie is being dropped: mobile needs
  `COOKIE_SAME_SITE=none` with `COOKIE_SECURE=true`, and the native origins
  must be in `CORS_ORIGINS`.

## Symptom: 429s in normal use

Rate limits are per instance and per IP. Behind a proxy, `TRUST_PROXY` must be
`true` or every request is attributed to the proxy's address and the whole
deployment shares one limit. This is the usual cause.

---

## Backups

```bash
MONGODB_URI="..." ./scripts/backup-mongodb.sh ./backups
```

The script verifies each archive by reading it back with `--dryRun`; an
archive that fails verification is reported as unusable. Run it on a schedule
and keep the output off the application host.

### Restore drill

Do this on a scratch database, not production, and do it before you need it:

```bash
MONGODB_URI="mongodb://.../automail_restore_test" ./scripts/restore-mongodb.sh backups/automail-<ts>.gz
CONFIRM=yes MONGODB_URI="mongodb://.../automail_restore_test" ./scripts/restore-mongodb.sh backups/automail-<ts>.gz
```

Then point a staging API at the restored database and check
`/api/v1/health/ready` plus a signed-in page load. A backup that has never
been restored should not be assumed to work.

**Attachments are not in the MongoDB dump.** With the local storage driver they
live on the `attachments` volume and need their own backup; with object
storage, enable versioning and a lifecycle policy there instead.

---

## Secrets

All secrets come from the environment; none are in the repository. In
production, source `.env.production` from a secret manager rather than a file
on disk.

Rotating `CREDENTIAL_ENCRYPTION_KEY` invalidates every stored Gmail App
Password, because they are encrypted with it. There is no re-encryption script
yet, so rotation means every user must reconnect their account. Plan it, and
tell users first.

Rotating `TELEPHONY_WEBHOOK_SECRET` must be done in the provider console at the
same time, or in-flight webhooks are rejected until both sides match.

## Alerting

Recommended, in priority order. There is no alerting infrastructure in the
repo; these are thresholds to configure in whatever monitoring is adopted.

| Alert | Condition | Why |
| --- | --- | --- |
| API down | `/health/ready` non-200 for 2 min | Users cannot work |
| Send queue stalled | `queueDepth` > 100 and not falling for 10 min | Worker is stuck |
| Auth failures spiking | `email_send_failures{code="SMTP_AUTH_FAILED"}` rising | Credentials revoked en masse |
| Webhook rejections | `webhooks_rejected_total` > 0 sustained | Secret mismatch, or forgery attempts |
| Backup missing | No new archive in 26 h | Backups silently stopped |
