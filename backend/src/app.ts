import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env } from './config/environment';
import { logger } from './infrastructure/logger/logger';
import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import {
  callRateLimiter,
  credentialRateLimiter,
  globalRateLimiter,
  sendRateLimiter,
} from './middleware/rate-limit.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { createAuthModule } from './modules/auth/auth.module';
import { createContactModule } from './modules/contacts/contact.module';
import { createDashboardModule } from './modules/dashboard/dashboard.module';
import { createEmailAccountModule } from './modules/email-accounts/email-account.module';
import { createCallModule } from './modules/calls/call.module';
import { createTimelineModule } from './modules/timeline/timeline.module';
import { createAnalyticsModule } from './modules/analytics/analytics.module';
import { createEmailModule } from './modules/emails/email.module';
import { createCallRouter } from './routes/call.routes';
import { createTimelineRouter } from './routes/timeline.routes';
import { createAnalyticsRouter } from './routes/analytics.routes';
import { createEmailRouter } from './routes/email.routes';
import { createImportModule } from './modules/imports/import.module';
import { createAuthRouter } from './routes/auth.routes';
import { createContactRouter } from './routes/contact.routes';
import { createDashboardRouter } from './routes/dashboard.routes';
import { createEmailAccountRouter } from './routes/email-account.routes';
import { createImportRouter } from './routes/import.routes';
import { createHealthRouter } from './routes/health.routes';
import { HealthService } from './modules/health/health.service';

/**
 * Resources that must be released on shutdown. Returned alongside the app so
 * the server can drain them; kept out of module scope so tests that build an
 * app do not share a queue.
 */
export interface AppResources {
  closeQueue(): Promise<void>;
}

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.requestId,
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/v1', globalRateLimiter);

  const authModule = createAuthModule();

  app.use('/api/v1', createAuthRouter(authModule));
  app.use('/api/v1', createContactRouter(createContactModule(), authModule.authenticate));
  app.use('/api/v1', createDashboardRouter(createDashboardModule(), authModule.authenticate));
  app.use('/api/v1', createImportRouter(createImportModule(), authModule.authenticate));
  // The email module reuses the account module's service instance so both
  // share one cipher and one view of connected accounts.
  const emailAccountModule = createEmailAccountModule();

  app.use(
    '/api/v1',
    createEmailAccountRouter(emailAccountModule, authModule.authenticate, credentialRateLimiter),
  );
  // Hoisted so the health endpoint can report real queue depth: an email
  // backlog is the clearest early signal that the send worker has stalled.
  const emailModule = createEmailModule(emailAccountModule.accountService);

  app.use(
    '/api/v1',
    createEmailRouter(emailModule, authModule.authenticate, sendRateLimiter),
  );

  // Mounted after the email module so readiness can report the real queue.
  app.use('/api/v1', createHealthRouter(new HealthService(emailModule.queue)));

  app.use(
    '/api/v1',
    createCallRouter(createCallModule(), authModule.authenticate, callRateLimiter),
  );

  app.use('/api/v1', createTimelineRouter(createTimelineModule(), authModule.authenticate));

  app.use('/api/v1', createAnalyticsRouter(createAnalyticsModule(), authModule.authenticate));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  // Exposed for the shutdown path in server.ts.
  (app as express.Express & { resources?: AppResources }).resources = {
    closeQueue: () => emailModule.queue.close(),
  };

  return app;
}
