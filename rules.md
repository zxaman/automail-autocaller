# AutoCall & AutoMail — Development Rules

**Document status:** Pre-implementation engineering rules  
**Project stage:** Documentation before project creation  
**Last updated:** 2026-09-06

These rules apply to the frontend, backend, integrations, infrastructure, tests, and AI-assisted development.

## 1. General Engineering Principles

Use:

- Strong typing
- Strict TypeScript
- Separation of concerns
- Small focused modules
- Feature-based organization
- Explicit interfaces
- Reusable components
- Testable services
- Secure defaults
- Meaningful names
- Consistent error handling
- Observable operations
- Incremental delivery

Follow SOLID principles where they improve clarity. Do not add abstractions without a concrete reason.

## 2. Required Technology Choices

### Frontend

Use:

- Angular standalone components
- Angular Signals for local and feature state
- RxJS for asynchronous streams and HTTP
- Angular Router with lazy-loaded features
- Reactive Forms
- SCSS
- Angular Material selectively or a controlled design system
- Functional guards
- Functional HTTP interceptors
- Strongly typed API models
- Capacitor adapters for native functionality

### Backend

Use:

- Node.js current LTS version at implementation time
- Express.js
- TypeScript strict mode
- MongoDB
- Mongoose
- Runtime request validation such as Zod
- Structured logging
- Central error middleware
- Repository and service separation
- Background workers for long-running work

### Infrastructure

Use:

- Docker for repeatable development
- MongoDB indexes
- Redis for distributed queueing and throttling
- Private S3-compatible object storage
- Health checks
- Environment-based configuration
- OpenAPI documentation

## 3. Frontend File Rules

Every substantial component must use separate files:

```text
component-name.component.ts
component-name.component.html
component-name.component.scss
component-name.component.spec.ts
component-name.interfaces.ts
```

Stateful or page components should have a focused service:

```text
component-name.service.ts
```

Purely presentational components do not need API services. They must expose typed inputs, outputs, and configuration through their interface file.

Do not create one giant component for an entire feature.

Do not put API requests directly inside templates or unrelated visual components.

## 4. Backend Boundary Rules

Routes must not contain business logic.

Controllers must not contain large database queries or provider implementations.

Services own business rules and orchestration.

Repositories own persistence queries.

Integration adapters own external provider behavior.

Workers own asynchronous jobs.

A module must not directly reach into another module's repository. Cross-module interaction goes through a service or explicit interface.

## 5. Data Ownership Rules

Every protected business resource must be scoped by authenticated ownership.

Never query a resource using only a client-provided ID.

Always include workspace and/or user ownership in resource queries.

A user must never access another user's:

- Contacts
- Calls
- Recordings
- Emails
- Email accounts
- Attachments
- Templates
- Signatures
- Dashboard data

Use generic not-found responses when appropriate so resource existence is not leaked.

## 6. Authentication Rules

Use Google OAuth/OIDC for application login.

Validate:

- OAuth state
- PKCE where applicable
- Nonce
- Issuer
- Audience
- Expiration
- Required claims

Never expose Google client secrets to Angular.

Never store authentication tokens in local storage.

Use HttpOnly, Secure cookies or native secure storage depending on platform.

Logout must invalidate the application session or refresh token.

## 7. Gmail Credential Rules

The application must request a Google-generated Gmail App Password, never a normal Gmail password.

Use authenticated encryption such as AES-256-GCM.

Never:

- Store the credential in plaintext
- Return the credential to the frontend
- Put the credential in local storage
- Put the credential in a URL
- Log the credential
- Include the credential in activity logs
- Include the credential in analytics
- Commit encryption keys to Git

Decrypt credentials only server-side and only when required for SMTP use.

Encryption keys belong in environment configuration during development and a secrets manager/KMS in production.

## 8. Email Rules

Each recipient in a multi-recipient send receives a separate email job.

Never expose all recipients to one another through a combined visible `To` field.

Do not synchronously send hundreds of emails inside one HTTP request.

Use queueing, throttling, retry classification, and idempotency.

Retry temporary provider failures only.

Do not retry permanent authentication, validation, or invalid-address failures indefinitely.

Do not attempt to bypass Gmail sending limits, spam detection, or abuse controls.

An SMTP accepted status must not be described as a confirmed email open or read.

Render and store a snapshot of the subject/body used for each delivery so history remains accurate if a template changes later.

Sanitize HTML signatures and template content.

Prevent email header injection.

## 9. Import Rules

Do not require exact column names.

The importer must support:

- Header normalization
- Alias and synonym matching
- Sample-value analysis
- Confidence scoring
- Manual mapping
- Headerless files
- First name plus last name combination
- Duplicate headers
- Blank rows
- Phone/email validation
- Duplicate detection
- Row-level error reporting

Examples of valid variations include:

```text
Phone No.
Mobile
Mobile Number
Contact Number
Telephone
Candidate
Candidate Name
Applicant
User
Full Name
Email ID
Mail
Email Address
```

Generic headers such as `Number`, `User`, `Contact`, or `Details` must not be automatically trusted without value analysis.

High-confidence mappings may be suggested automatically. Ambiguous mappings require user confirmation.

Do not silently discard unmapped columns. Show them as ignored or unmapped in the review step.

Phone numbers must be treated as identifiers, not ordinary arithmetic values. Account for Excel numeric formatting, scientific notation, leading zeroes, and configurable country codes.

## 10. File Upload Rules

Validate:

- File extension
- MIME type
- File signature/magic bytes where applicable
- Maximum size
- Ownership
- Storage destination
- Malware scan status where available

Store large files in private object storage, not MongoDB.

Use short-lived signed URLs for authorized access.

Never allow a client to select arbitrary storage keys.

Do not trust a filename extension as the only security check.

## 11. Telephony Rules

Never fake production calling.

Never use `tel:` as a replacement for the requested provider-backed in-app calling architecture.

Never claim that Capacitor itself provides PSTN calling.

Use a telephony provider adapter.

Verify provider capability before exposing controls such as:

- Hold
- DTMF
- Recording
- Background calling
- Incoming calls
- Speaker routing

Recording requires legal review, disclosure, consent where required, retention rules, and secure storage.

The calling queue must require explicit user control and must not automatically place unlimited calls.

Provider webhooks must be signature-verified.

## 12. Error Handling Rules

Use centralized error middleware.

Use typed application errors with:

- Safe public message
- Stable error code
- HTTP status
- Request ID
- Optional internal cause

Never return:

- Stack traces
- MongoDB query details
- Provider secrets
- Encryption data
- Credentials
- Internal filesystem paths

Frontend operations must support:

- Loading state
- Empty state
- Success state
- Validation state
- Recoverable error state
- Retry state
- Session-expired state

Errors must be understandable to users but detailed enough for logs and support.

## 13. Logging Rules

Use structured logs.

Include:

- Request ID
- User/workspace ID where safe
- Module
- Operation
- Result
- Duration
- Provider status

Never log:

- Gmail App Passwords
- OAuth secrets
- Refresh tokens
- Telephony API keys
- Storage credentials
- Encryption keys
- Full private recording URLs
- Unnecessary email bodies

## 14. Validation Rules

Validate at every boundary:

- HTTP request body
- Query parameters
- Route parameters
- Uploaded files
- Imported spreadsheet rows
- Template variables
- Email addresses
- Phone numbers
- Provider webhook payloads

Frontend validation improves UX. Backend validation is authoritative.

## 15. State and Status Rules

Statuses must be explicit and modeled as state machines where appropriate.

Call statuses include:

```text
Initiating
Ringing
Connected
On Hold
Ending
Completed
Missed
Failed
```

Email statuses include:

```text
Draft
Queued
Sending
Sent
Failed
Cancelled
```

Import statuses include:

```text
Uploaded
Previewed
Validating
Ready
Importing
Completed
Partially Completed
Failed
```

Invalid state transitions must be rejected rather than silently accepted.

## 16. Testing Rules

Write tests for:

- Authentication
- Unauthorized access
- Cross-user access attempts
- Contact CRUD
- Pagination
- Import aliases
- Ambiguous column mappings
- Headerless files
- Duplicate detection
- Phone normalization
- Email validation
- Template rendering
- Signature application
- Attachment ownership
- Credential encryption/decryption
- Queue retry behavior
- Provider webhook verification
- Call status transitions
- Recording access

Security tests must intentionally attempt to access another user's resources.

## 17. AI Development Boundaries

AI-assisted development may help with:

- Drafting documentation
- Generating boilerplate tests
- Suggesting component structure
- Explaining errors
- Creating type definitions
- Producing migration drafts
- Creating mock data
- Reviewing code for duplication

AI must not independently decide or silently implement:

- Authentication security changes
- Authorization boundaries
- Credential storage behavior
- Encryption changes
- Provider compliance behavior
- Recording consent behavior
- Data retention policy
- Billing or permission policy
- Destructive database migrations
- Production deployment changes

AI-generated code must be reviewed against these rules.

AI must not invent support for an unavailable provider feature.

AI must not create mock calling behavior that appears to be real calling in a production build.

AI must never be given production credentials, App Passwords, API keys, OAuth secrets, or private recordings.

## 18. Dependency Rules

Before adding a dependency, confirm:

- It is actively maintained
- It has an appropriate license
- It solves a real requirement
- It does not duplicate an existing capability
- It does not introduce unnecessary security risk
- It has a compatible TypeScript/API surface

Avoid:

- Abandoned packages
- Duplicate HTTP clients
- Duplicate state-management libraries
- Unnecessary utility libraries
- Libraries that silently upload sensitive data
- Libraries that hide critical security behavior

## 19. Git and Repository Rules

Never commit:

- `.env` files with secrets
- Gmail credentials
- OAuth secrets
- Telephony credentials
- Encryption keys
- Private recordings
- Large generated datasets
- Build output

Use `.env.example` with placeholders.

Keep commits focused and descriptive.

Do not mix large refactors with unrelated feature changes.

## 20. Documentation Rules

Every major phase must document:

- What was implemented
- Why it was implemented
- Files created
- Files changed
- Commands to run
- Environment variables
- How to test
- Expected result
- Known limitations

Update `memory.md` after meaningful work.
