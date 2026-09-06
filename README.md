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
- Product feature phases (contacts, imports, AutoMail, AutoCall) are not implemented yet.

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
