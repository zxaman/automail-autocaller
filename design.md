# AutoCall & AutoMail — Product Design System

**Document status:** Initial visual direction  
**Project stage:** Documentation before project creation  
**Last updated:** 2026-09-06

## 1. Design Goals

The product should feel like a professional communication workspace rather than a generic spreadsheet or marketing dashboard.

Design qualities:

- Clean
- Calm
- Trustworthy
- Efficient
- Professional
- Responsive
- Accessible
- Data-focused without being visually crowded

The product is intended for long working sessions, so visual hierarchy and readability are more important than decorative effects.

## 2. Brand Direction

The visual identity should communicate:

- Communication
- Momentum
- Organization
- Reliability
- Human workflow
- Business productivity

The interface should feel appropriate for a recruiter, staffing agency, or outbound team.

Avoid a loud call-center aesthetic. Calling and email actions should be prominent, but the overall product should remain calm and structured.

## 3. Color Theme

### Primary color

Use a deep indigo/blue as the main brand color.

```text
Primary 900: #1E2A5A
Primary 700: #3046A8
Primary 600: #4257C7
Primary 500: #5269E8
Primary 100: #E9EDFF
Primary 050: #F5F7FF
```

The primary color is used for:

- Main navigation highlights
- Primary buttons
- Focus states
- Links
- Selected filters
- Active tabs
- Progress indicators

### Accent color

Use a restrained teal for successful communication activity.

```text
Accent 700: #087F73
Accent 600: #0E9F8E
Accent 100: #DDF7F2
Accent 050: #F0FCFA
```

Use accent colors for:

- Successful email states
- Completed calls
- Positive activity indicators
- Confirmation messages

### Semantic colors

```text
Success: #168A55
Success Background: #EAF8F0

Warning: #B86A00
Warning Background: #FFF5E5

Error: #C83A4A
Error Background: #FDECEF

Info: #1671A8
Info Background: #EAF5FC
```

Semantic color must not be the only way to communicate a state. Use text, icons, or status labels as well.

### Neutral colors

```text
Text Primary: #172033
Text Secondary: #59657A
Text Muted: #7A8496
Border: #E1E6EF
Surface: #FFFFFF
Surface Subtle: #F7F9FC
Page Background: #F4F6FA
Overlay: rgba(15, 23, 42, 0.42)
```

## 4. Light and Dark Theme

The first MVP should prioritize a polished light theme.

The design tokens should be structured so dark theme support can be introduced later without rewriting components.

Do not hardcode colors inside individual components. Use theme tokens or shared SCSS variables.

## 5. Typography

Recommended primary font:

```text
Inter
```

Fallback stack:

```text
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Inter is selected for:

- High readability
- Clear numerals
- Good dashboard density
- Strong UI hierarchy
- Consistent cross-platform appearance

### Type scale

```text
Display: 32px / 40px / 700
Page Title: 28px / 36px / 700
Section Title: 20px / 28px / 650
Card Title: 16px / 24px / 650
Body Large: 16px / 24px / 400
Body: 14px / 22px / 400
Body Small: 13px / 20px / 400
Caption: 12px / 18px / 500
Metric Number: 28px / 34px / 700
```

Use tabular numerals for:

- Dashboard metrics
- Durations
- Phone numbers
- Activity counts
- Tables

## 6. Layout

### Desktop

```text
Fixed sidebar: 248px
Header: 64px
Content max width: 1440px
Page horizontal padding: 32px
Grid gap: 24px
Card radius: 12px
```

Desktop structure:

```text
Sidebar | Header and Main Content
```

### Tablet

- Collapsible sidebar
- Reduced page padding
- Two-column dashboard cards
- Responsive data tables

### Mobile

```text
Top header
Scrollable page content
Bottom navigation or drawer
```

Mobile requirements:

- Touch targets at least 44px where practical
- No hover-only actions
- Tables transform into cards or horizontal scroll regions
- Composer fields stack vertically
- Call controls remain reachable with one hand
- Important actions remain visible without excessive scrolling

## 7. Navigation

Primary navigation:

- Dashboard
- Contacts
- Calls
- Emails
- Templates
- Imports
- Analytics
- Settings

Future navigation:

- Campaigns
- Team

The selected navigation item should have:

- Primary-color background tint
- Primary-color icon
- Strong text weight
- Left or bottom active indicator depending on layout

## 8. Component Style

### Cards

- White surface
- Subtle border
- Minimal shadow
- 12px corner radius
- Consistent internal padding
- Clear title and supporting label

### Buttons

Primary:

- Indigo background
- White text
- Medium emphasis

Secondary:

- White or subtle surface
- Neutral border
- Primary or dark text

Destructive:

- Reserved for delete, disconnect, and irreversible actions
- Must include confirmation where appropriate

Buttons must support:

- Default
- Hover
- Focus
- Pressed
- Disabled
- Loading

### Inputs

Inputs should have:

- Visible label
- Clear focus ring
- Helpful placeholder only when needed
- Inline validation message
- Consistent height
- Accessible error association

### Tables

Tables should include:

- Clear column headings
- Sort indicators
- Pagination
- Empty state
- Loading state
- Row hover state on desktop
- Responsive mobile alternative

### Status badges

Status badges should include both color and text:

```text
Sent
Failed
Queued
Completed
Missed
Connected
Imported
Duplicate
```

## 9. Dashboard Design

The dashboard should prioritize the founder demonstration workflow.

Recommended layout:

```text
Page title + date range + quick action

Metric card row

Activity chart                 Recent imports

Recent calls                   Recent emails
```

Quick actions:

- Import contacts
- Add contact
- Start calling queue
- Compose email
- Connect Gmail

Metric cards must show:

- Main value
- Label
- Comparison or context when available
- Icon used as a supporting visual, not the only meaning

## 10. Contact Design

The contacts list should make the next action obvious.

Each row/card should expose:

- Contact name
- Phone
- Email
- Company or designation
- Last interaction
- Call action
- Email action
- More actions

The profile page should use a two-section hierarchy:

```text
Contact summary and actions
Communication timeline
```

The Call and Email actions should be visually prominent but not visually identical. Calling uses the primary indigo action; email uses a complementary accent treatment.

## 11. Calling Screen Design

The calling screen should be focused and low distraction.

Display:

- Contact name
- Phone number
- Call state
- Duration
- Connection quality where available
- Recording indicator
- Mute
- Speaker/audio route
- Hold
- Keypad
- End call

The end-call action must be visually distinct and use a destructive red treatment.

Do not show controls that are unsupported by the selected provider or platform.

## 12. Email Composer Design

The composer should support both a page and a dialog/sheet presentation depending on context.

Field order:

```text
From
To
CC/BCC
Template
Subject
Body
Signature
Attachments
Preview
Send
```

For a post-call follow-up, the composer should clearly show:

```text
Follow-up for Rahul Sharma
```

A multi-recipient composer must show that individual emails will be sent separately.

The preview must show the actual rendered recipient values rather than unresolved variables.

## 13. Import Wizard Design

The import wizard should show progress:

```text
Upload → Preview → Map → Validate → Review → Import
```

The column mapping step must display:

- Source column name
- Sample values
- Suggested application field
- Confidence
- Manual dropdown
- Ignore option

Ambiguous mappings must be visually highlighted and must not be silently accepted.

## 14. Empty, Loading, and Error States

Every major screen requires:

- Loading state
- Empty state
- Error state
- Retry action where appropriate

Empty states should explain what the user can do next.

Examples:

```text
No contacts yet
Import a spreadsheet or add your first contact.

No connected Gmail account
Connect Gmail to send follow-up emails.

No recent calls
Your completed calls will appear here.
```

## 15. Accessibility

The interface must support:

- Keyboard navigation
- Visible focus states
- Semantic headings
- Labels for all form controls
- Accessible dialog behavior
- Screen-reader-friendly status updates
- Sufficient contrast
- Non-color status indicators
- Reduced-motion preference
- Touch-friendly controls

Use WCAG 2.1 AA as the practical target.

## 16. Motion

Use subtle motion only for:

- Page transitions
- Dialog entry
- Toasts
- Loading indicators
- Progress updates
- State changes

Avoid excessive animation on dashboard charts or data tables.

Honor reduced-motion preferences.

## 17. Iconography

Use one consistent icon set across the application.

Icons should support labels rather than replace labels for critical actions.

Important actions such as Call, Email, Delete, Record, and Disconnect must include accessible text or an accessible label.

## 18. Content and Microcopy

Use clear, direct product language.

Prefer:

```text
Connect Gmail
Send follow-up email
Import contacts
Call contact
Retry send
Review mapping
```

Avoid unclear wording such as:

```text
Execute
Process
Trigger
Run operation
```

Error messages should explain:

1. What happened
2. Why it may have happened
3. What the user can do next

## 19. Design System Implementation Rules

Shared tokens should define:

- Colors
- Spacing
- Typography
- Radius
- Shadows
- Z-index layers
- Breakpoints
- Motion timing

Feature components should consume shared tokens rather than introducing arbitrary one-off values.

The design system must be responsive and should work for both desktop web and Capacitor mobile layouts.
