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
- Phase 3 Angular foundation and design system: complete (see `frontend/README.md`).
- Phase 2 authentication and the product feature phases are not implemented yet.

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
