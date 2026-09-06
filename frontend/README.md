# AutoCall & AutoMail — Angular Frontend

Angular standalone application (zoneless change detection, signals, lazy routes) for the
AutoCall & AutoMail workspace.

## Commands

```bash
npm install --legacy-peer-deps   # install dependencies
npm start                        # dev server on http://localhost:4200 (proxies /api to :3000)
npm run build                    # production build
npm test                         # unit tests (Vitest via @angular/build:unit-test)
```

## Architecture

```text
src/
  environments/          build-time configuration and typed environment model
  styles/                design tokens, reset, mixins, utilities
  app/
    core/                app-wide singletons
      config/            navigation and API endpoint configuration
      guards/            functional route guards (auth, guest)
      interceptors/      functional HTTP interceptors (auth, loading, error)
      models/            shared API, user, navigation, and state contracts
      services/          ApiClient, Auth, Layout, Loading, Navigation, Notification, FeatureFlag
    layout/              app-shell, header, sidebar, mobile-navigation
    shared/              reusable presentation components and pipes
    features/            lazy-loaded feature areas
```

### Component rule

Every substantial component has separate `*.component.ts`, `*.component.html`, and
`*.component.scss` files. Stateful screens add a dedicated `*.service.ts` and a
`*.model.ts` interface file; shared components add a `*.model.ts` when they expose a
public contract.

### API access

Browser-facing code only uses the relative base path `/api/v1`. The dev server proxies
that path to the backend, so the same build works in the browser, behind a reverse
proxy, and inside the Capacitor shell without pointing at `localhost`.

### Security notes

- The session is carried by an HttpOnly cookie issued by the backend.
- No token, Google secret, or Gmail App Password is ever stored in the browser.
- The error interceptor clears client session state and redirects on `401`.
- API errors are normalized into `AppError`; raw server output is never rendered.

### Design system

Design tokens live in `src/styles/_tokens.scss` as CSS custom properties. Components must
consume tokens instead of hardcoded colors, spacing, or typography so that a dark theme
can be added later without component rewrites.
