# AutoCall & AutoMail — Architecture

**Document status:** Pre-implementation architecture  
**Project stage:** Documentation before project creation  
**Last updated:** 2026-09-06

## 1. Architectural Strategy

The first implementation will be a modular monolith with clear boundaries.

A modular monolith is preferred over microservices initially because it provides:

- A simpler development environment
- Fewer deployment concerns
- Easier debugging
- Lower operating cost
- Clear feature boundaries
- A migration path to separate workers or services later

The API will remain stateless. Long-running work such as email delivery and recording processing will run in workers.

## 2. System Overview

```text
Angular Web Application
        │
        │ HTTPS REST API
        ▼
Node.js + Express API
        │
        ├── Authentication
        ├── Users and Workspaces
        ├── Contacts
        ├── Imports
        ├── Calls
        ├── Emails
        ├── Templates
        ├── Signatures
        ├── Attachments
        ├── Dashboard
        ├── Analytics
        └── Activity Timeline
        │
        ├── MongoDB / Mongoose
        ├── Redis / Queue
        ├── Gmail SMTP / Nodemailer
        ├── Google OAuth
        ├── Telephony Provider
        └── Private Object Storage
```

## 3. Primary Application Flow

```text
Google Login
    ↓
Authenticated Workspace
    ↓
Dashboard
    ├── Import Contacts
    ├── Open Contacts
    ├── Review Calls
    ├── Review Emails
    └── Review Analytics

Contact Profile
    ├── Call through provider
    ├── Send follow-up email
    ├── View timeline
    ├── View recording where permitted
    └── Edit contact
```

## 4. Authentication Flow

```text
Angular
  ↓
Backend Google OAuth start endpoint
  ↓
Google authorization screen
  ↓
Backend OAuth callback
  ↓
Validate state, nonce, PKCE, issuer, audience, and claims
  ↓
Find or create user and private workspace
  ↓
Create application session
  ↓
Redirect to Angular application
```

Google client secrets exist only on the backend.

Web sessions should use secure HttpOnly cookies or a secure short-lived access and refresh-token design. Tokens must not be stored in local storage.

Capacitor uses the system browser for authentication and native secure storage for mobile tokens where required.

## 5. Contact Import Flow

```text
Upload XLSX/XLS/CSV
        ↓
Parse workbook or CSV
        ↓
Detect header row
        ↓
Normalize source headers
        ↓
Resolve aliases and synonyms
        ↓
Inspect sample cell values
        ↓
Score possible mappings
        ↓
Show mapping wizard
        ↓
User confirms or corrects mappings
        ↓
Validate rows
        ↓
Normalize phone and email values
        ↓
Detect duplicates
        ↓
Commit valid rows
        ↓
Create ImportBatch result
```

The importer must not require exact column names. Examples such as `Phone No.`, `Mobile`, `Contact Number`, `Candidate`, `Applicant`, `User`, `Email ID`, and `Mail` must be supported through normalized aliases and sample-value analysis.

Generic headers such as `Number`, `User`, or `Details` must be treated as ambiguous unless the cell values provide sufficient evidence.

## 6. Call Flow

```text
User clicks Call
        ↓
Frontend requests call session from backend
        ↓
Backend verifies contact and workspace access
        ↓
Backend creates provider call/session
        ↓
Frontend receives short-lived provider session information
        ↓
Web SDK or native Capacitor voice plugin connects audio
        ↓
Provider sends signed status webhooks
        ↓
Backend updates Call record
        ↓
User controls or ends the call
        ↓
Provider confirms final status and duration
        ↓
Call appears in history and contact timeline
```

The first provider candidate is Twilio Voice. Telnyx or Vonage can be selected behind the same provider interface if country coverage or regulatory requirements make them more suitable.

The application must not use `tel:` as the production calling architecture.

## 7. Email Connection Flow

```text
Authenticated user enters Gmail address and App Password
        ↓
HTTPS request to backend
        ↓
Backend verifies SMTP connection
        ↓
Credential is encrypted with AES-256-GCM
        ↓
Encrypted value is stored in MongoDB
        ↓
Frontend receives account address and connection status only
```

The normal Gmail password must never be requested.

## 8. Email Sending Flow

```text
User selects one or more contacts
        ↓
Backend validates contacts and template variables
        ↓
One Email record is created per recipient
        ↓
Email jobs enter queue
        ↓
Worker loads encrypted account credential
        ↓
Credential is decrypted only in worker memory
        ↓
Nodemailer sends through Gmail SMTP
        ↓
Email is marked Sent or Failed
        ↓
Timeline and dashboard are updated
```

The API must return a queued result rather than waiting for hundreds of emails to complete.

## 9. File and Recording Flow

```text
Angular requests upload authorization
        ↓
Presigned or streamed upload
        ↓
Private object storage
        ↓
Metadata stored in MongoDB
        ↓
Short-lived signed URL for authorized access
```

Call recordings follow:

```text
Telephony provider recording
        ↓
Provider callback
        ↓
Recording worker
        ↓
Private object storage
        ↓
CallRecording metadata in MongoDB
```

Large files must not be stored directly inside MongoDB.

## 10. Backend Layering

```text
Routes
  ↓
Controllers
  ↓
Application Services
  ↓
Repositories
  ↓
Mongoose Models
  ↓
MongoDB
```

Routes define endpoints and middleware only.

Controllers translate HTTP input/output.

Services contain business rules and orchestration.

Repositories contain database access and ownership scoping.

Providers contain external integration behavior.

## 11. Backend Folder Structure

```text
backend/src/
├── app.ts
├── server.ts
├── config/
│   ├── environment.ts
│   ├── database.config.ts
│   ├── storage.config.ts
│   └── queue.config.ts
├── infrastructure/
│   ├── database/
│   ├── logger/
│   ├── http/
│   ├── queue/
│   ├── storage/
│   └── providers/
├── middleware/
│   ├── authentication.middleware.ts
│   ├── authorization.middleware.ts
│   ├── validation.middleware.ts
│   ├── error.middleware.ts
│   ├── rate-limit.middleware.ts
│   └── request-id.middleware.ts
├── modules/
│   ├── auth/
│   ├── users/
│   ├── workspaces/
│   ├── contacts/
│   ├── imports/
│   ├── calls/
│   ├── call-recordings/
│   ├── emails/
│   ├── email-accounts/
│   ├── email-templates/
│   ├── email-signatures/
│   ├── email-attachments/
│   ├── dashboard/
│   ├── analytics/
│   └── activity-logs/
├── integrations/
│   ├── google/
│   ├── gmail/
│   ├── telephony/
│   │   ├── telephony.provider.ts
│   │   ├── twilio/
│   │   ├── telnyx/
│   │   └── vonage/
│   └── object-storage/
├── workers/
│   ├── email.worker.ts
│   ├── recording.worker.ts
│   └── cleanup.worker.ts
└── shared/
    ├── errors/
    ├── encryption/
    ├── pagination/
    ├── validators/
    ├── types/
    └── constants/
```

Each feature follows a separate-file pattern:

```text
contacts/
├── contacts.routes.ts
├── contacts.controller.ts
├── contacts.service.ts
├── contacts.repository.ts
├── contacts.schema.ts
├── contacts.dto.ts
├── contacts.interfaces.ts
├── contacts.validators.ts
└── contacts.test.ts
```

## 12. Frontend Folder Structure

```text
frontend/src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   ├── http/
│   ├── models/
│   ├── platform/
│   ├── services/
│   └── error-handling/
├── layout/
│   ├── app-shell/
│   ├── sidebar/
│   ├── header/
│   ├── mobile-navigation/
│   └── page-container/
├── shared/
│   ├── ui/
│   │   ├── button/
│   │   ├── stat-card/
│   │   ├── data-table/
│   │   ├── empty-state/
│   │   ├── loading-state/
│   │   ├── confirm-dialog/
│   │   ├── status-badge/
│   │   ├── file-picker/
│   │   └── date-range-filter/
│   ├── forms/
│   ├── pipes/
│   ├── directives/
│   └── validators/
└── features/
    ├── dashboard/
    ├── contacts/
    ├── imports/
    ├── calls/
    ├── emails/
    ├── email-accounts/
    ├── templates/
    ├── signatures/
    ├── attachments/
    ├── analytics/
    └── settings/
```

A page or stateful component receives separate files:

```text
contact-profile/
├── contact-profile.component.ts
├── contact-profile.component.html
├── contact-profile.component.scss
├── contact-profile.component.spec.ts
├── contact-profile.interfaces.ts
└── contact-profile.service.ts
```

A reusable presentational component has separate template, style, TypeScript, test, and public interface files. It receives a service only when it owns actual side effects or feature state; simple visual components must not receive unnecessary API services.

## 13. MongoDB Collections

Core collections:

- Users
- Workspaces
- Contacts
- ImportBatches
- Calls
- CallRecordings
- Emails
- EmailTemplates
- EmailSignatures
- EmailAttachments
- EmailCampaigns
- ActivityLogs

Every business document must contain workspace ownership and actor information where appropriate.

## 14. Ownership and Isolation

A private workspace is created for a new user.

Every resource query is scoped by authenticated workspace and user context. Client-provided IDs are never trusted on their own.

The backend should generally return not-found for another workspace's resource to avoid leaking resource existence.

## 15. Important MongoDB Indexes

Indexes must be evaluated for:

- `workspaceId`
- `ownerId`
- `workspaceId + normalizedEmail`
- `workspaceId + phoneE164`
- `workspaceId + createdAt`
- `workspaceId + contactId + createdAt`
- `workspaceId + status + createdAt`
- `workspaceId + providerCallId`
- `workspaceId + providerMessageId`
- `workspaceId + importBatchId`

## 16. API Structure

All endpoints use `/api/v1`.

Main groups:

```text
/auth
/dashboard
/analytics
/contacts
/imports
/calls
/emails
/email-accounts
/email-templates
/email-signatures
/email-attachments
/webhooks/telephony/:provider
```

All API responses use a consistent success/error envelope. Internal stack traces and sensitive provider data are never returned.

## 17. Technology Stack

### Frontend

- Angular standalone components
- TypeScript strict mode
- Angular Signals
- RxJS
- Angular Router
- Reactive Forms
- Angular Material or controlled shared UI components
- SCSS
- Capacitor

### Backend

- Node.js current LTS at implementation time
- Express.js
- TypeScript strict mode
- Mongoose
- Zod or equivalent runtime validation
- Pino or equivalent structured logger
- Helmet
- CORS allowlist
- Rate limiting

### Infrastructure

- MongoDB
- Redis
- BullMQ or queue abstraction
- S3-compatible private object storage
- Docker and Docker Compose
- OpenAPI documentation

Exact stable versions will be pinned when implementation begins.
