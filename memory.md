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
- Phase 1 backend foundation is complete and awaiting review.
- Next planned phase: Authentication and workspace foundation after approval.

## Documents Created

- `document.md` — product requirements and feature scope
- `architecture.md` — system architecture, flow, structure, and technology decisions
- `rules.md` — engineering, security, library, error-handling, and AI boundaries
- `phases.md` — phased development roadmap and approval gates
- `design.md` — visual design system and UX guidelines
- `memory.md` — this project state and handoff record

## Current Phase

### Phase 1 — Backend Foundation

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

## Pending Decisions

- Primary launch geography
- Telephony provider
- Web-only or web plus mobile MVP
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
