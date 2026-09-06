# AutoCall & AutoMail — Development Phases

**Document status:** Pre-implementation roadmap  
**Project stage:** Documentation before project creation  
**Last updated:** 2026-09-06

Development must proceed phase by phase. After each major phase, implementation stops for review and approval before the next phase begins.

## Phase 0 — Documentation and Decisions

### Goals

Create and approve the project foundation documents:

- `document.md`
- `architecture.md`
- `rules.md`
- `phases.md`
- `design.md`
- `memory.md`

### Decisions to confirm

- Primary launch geography
- Telephony provider or provider evaluation plan
- Web-only versus web plus mobile MVP
- Gmail App Password scope
- Object-storage provider
- Deployment target
- Individual workspace versus initial team support

### Exit criteria

- Requirements approved
- Architecture approved
- Rules approved
- Design language approved
- Implementation boundaries approved

## Phase 1 — Backend Foundation

### Scope

- Node.js and Express TypeScript project
- Environment configuration
- MongoDB connection
- Mongoose base configuration
- Application bootstrap
- Health endpoint
- Central error middleware
- Structured logging
- Request IDs
- Helmet
- CORS
- Rate limiting
- Runtime request validation
- Docker development setup
- `.env.example`
- Base API response format

### Exit criteria

- API starts locally
- Database connection is verified
- Health endpoint works
- Invalid configuration fails clearly
- Errors do not expose stack traces
- No secrets are committed

## Phase 2 — Authentication and Workspace Foundation

### Scope

- Google OAuth/OIDC
- Backend validation of Google claims
- User creation and lookup
- Private workspace creation
- Session or token lifecycle
- Protected route middleware
- Logout
- Authentication state endpoint
- User/workspace ownership context

### Exit criteria

- New user can log in
- Existing user can log in
- Logout invalidates the session
- Unauthenticated API access is denied
- Users cannot access another workspace
- Google secrets remain backend-only

## Phase 3 — Angular Foundation and Design System

### Scope

- Angular standalone application
- Strict TypeScript configuration
- Lazy-loaded routes
- Application shell
- Sidebar
- Header
- Mobile navigation
- Responsive layout
- Theme tokens
- Typography
- Shared UI components
- Loading, empty, error, and status components
- Auth guard and HTTP interceptor

### Component rule

Substantial components use separate:

- TypeScript
- HTML
- SCSS
- Spec
- Interface
- Service where stateful behavior exists

### Exit criteria

- Authenticated shell renders
- Desktop and mobile layouts work
- Shared components are reusable
- Theme is consistent
- Protected routes behave correctly

## Phase 4 — Contacts

### Scope

- Contact model
- Contact repository
- Contact service
- Contact API
- Contact list
- Search
- Sorting
- Filtering
- Pagination
- Add contact
- Edit contact
- Delete contact
- Contact profile
- Contact action bar
- Basic timeline placeholder

### Exit criteria

- Contact CRUD works
- Pagination works
- Search and filters work
- Resource ownership is enforced
- Cross-user access tests fail safely
- Loading and empty states exist

## Phase 5 — Dashboard Foundation

### Scope

- Dashboard API
- Backend aggregation queries
- Overview cards
- Recent activity components
- Date range filter
- Initial charts
- Quick actions
- Loading and error states

### Initial metrics

- Total contacts
- Calls today
- Emails today
- Total calls
- Total emails
- Communication activity

### Exit criteria

- Dashboard data comes from backend
- Date ranges are timezone-aware
- Empty accounts render useful empty states
- Metrics can be extended without rewriting the page

## Phase 6 — Flexible Spreadsheet Import

### Scope

- XLSX support
- XLS support
- CSV support
- File upload
- File validation
- Header-row detection
- Header normalization
- Alias registry
- Sample-value analysis
- Confidence scoring
- Manual column mapping
- Headerless file support
- First-name/last-name combination
- Phone normalization
- Email validation
- Duplicate detection
- Row-level errors
- Import batch storage
- Import results

### Required behavior

Do not require exact column names.

Examples that must be supported:

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

Generic names such as `Number`, `User`, and `Details` require value analysis and possibly user confirmation.

### Exit criteria

- A file with nonstandard headers can be imported
- Ambiguous mappings require confirmation
- Invalid rows are reported clearly
- Duplicates are handled according to user choice
- ImportBatch contains complete audit information

## Phase 7 — Gmail Account Connection

### Scope

- Email account model
- Add Gmail account
- SMTP verification
- App Password input
- AES-256-GCM encryption
- Credential replacement
- Send test email
- Default account
- Disconnect
- Secure account status response

### Exit criteria

- Valid credentials connect successfully
- Invalid credentials return safe errors
- Credential is never returned by an API
- Credential is never logged
- Disconnect removes encrypted credential data
- Account ownership is enforced

## Phase 8 — AutoMail Composer and Queue

### Scope

- Email template model and CRUD
- Signature model and CRUD
- Reusable attachment model
- Object storage integration
- Email composer
- Template variable rendering
- Signature insertion
- Attachment selection
- Personalized preview
- One email record per recipient
- Queue integration
- Email worker
- Throttling
- Retry classification
- Email history

### Exit criteria

- Single email can be queued and sent
- Multiple contacts receive separate jobs
- Recipient privacy is preserved
- Templates render contact-specific values
- Signatures apply automatically
- Attachments are securely stored
- Failed jobs are visible and retry safely

## Phase 9 — Telephony Provider Evaluation

### Scope

Before implementing calling, confirm:

- Primary countries and destinations
- Provider account availability
- PSTN coverage
- India-specific restrictions where applicable
- Number provisioning
- Pricing
- Recording support
- DTMF support
- Hold support
- Android support
- iOS support
- Web SDK support
- Call event webhooks
- Consent and recording requirements

### Candidate providers

- Twilio Voice
- Telnyx
- Vonage
- Compliant SIP/WebRTC provider

### Exit criteria

- Provider selected
- Required credentials available outside Git
- Platform capability matrix documented
- Legal and recording assumptions documented
- Provider adapter contract approved

## Phase 10 — AutoCall

### Scope

- Telephony provider adapter
- Call creation
- Provider token/session flow
- Calling screen
- Call state machine
- Call timer
- Mute
- Speaker/audio route where supported
- Hold where supported
- DTMF where supported
- End call
- Call history
- Signed provider webhooks
- Failure handling
- Manual calling queue

### Exit criteria

- Production calls use the configured provider
- No `tel:` fallback is presented as in-app calling
- Status transitions are provider-backed
- Failures are visible
- User controls the next queue item explicitly

## Phase 11 — Call Recording

### Scope

- Provider recording control where supported
- Recording metadata
- Secure object storage
- Recording worker
- Authorized playback
- Recording indicator
- Retention configuration
- Access logging

### Exit criteria

- Recording is never silently enabled
- Provider callbacks are verified
- Only authorized users can access recordings
- Recording limitations are visible in the UI

## Phase 12 — Unified Communication Timeline

### Scope

- Calls in timeline
- Emails in timeline
- Notes in timeline
- Recordings in timeline
- Attachments in timeline
- Import activity in timeline
- Call-completed follow-up action
- Contact-level activity ordering

### Exit criteria

- Contact timeline presents a coherent chronological history
- Call and email records link to the same contact
- Follow-up email is prefilled with contact data
- Timeline access is ownership-protected

## Phase 13 — Analytics

### Scope

- Calls per day/week/month
- Emails per day/week/month
- Call success rate
- Email success rate
- Total call duration
- Average call duration
- Most contacted contacts
- Import statistics
- Custom date range
- Dashboard chart refinement

### Exit criteria

- Analytics are generated by backend aggregation
- Timezone handling is consistent
- Metrics have documented definitions
- Large datasets remain paginated or aggregated efficiently

## Phase 14 — Capacitor Mobile Packaging

### Scope

- Capacitor setup
- Android project
- iOS project
- Native secure storage
- Microphone permissions
- Notification permissions
- Audio permissions
- Native voice SDK bridge if required
- Android Telecom integration where supported
- iOS CallKit integration where supported
- Push notification integration

### Exit criteria

- Web and mobile capability differences are explicit
- Permissions are requested only when needed
- Mobile tokens use secure storage
- Calling behavior is tested on supported devices

## Phase 15 — Security Hardening

### Scope

- Cross-user authorization audit
- Credential storage audit
- File upload audit
- Webhook signature audit
- Rate-limit testing
- Session expiry tests
- Dependency audit
- Secret scan
- Logging redaction audit
- Recording access audit
- Error response audit

### Exit criteria

- Security test suite passes
- No secret appears in repository or logs
- Resource ownership is verified on every module
- High-risk findings are resolved or documented

## Phase 16 — Production Readiness

### Scope

- Production Docker images
- Deployment configuration
- Secret manager integration
- Managed MongoDB
- Managed Redis
- Object-storage lifecycle policies
- Database backups
- Monitoring
- Alerting
- Health checks
- API documentation
- Operational runbooks
- Final README

### Exit criteria

- Deployment is repeatable
- Backups are tested
- Worker failures are observable
- Health checks are meaningful
- Production secrets are externalized
- Founder demo workflow is complete

## Phase Completion Report

After every phase, document:

1. What was implemented
2. Why it was implemented
3. Files created
4. Files modified
5. Commands to run
6. Required environment variables
7. Test steps
8. Expected result
9. Known limitations
10. Remaining risks

The next phase must not begin without review and approval.
