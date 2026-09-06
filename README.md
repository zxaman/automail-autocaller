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

Phase 1 backend foundation is in progress. The Angular application and feature modules will be added in later approved phases.

## Local backend setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Start local infrastructure with `docker compose up -d`.
4. Install backend dependencies with `npm install --prefix backend`.
5. Install frontend dependencies with `npm install --prefix frontend`.
6. Start the API with `npm run api:dev`.

The health endpoint is available at `http://localhost:3000/api/v1/health`.
