import { env } from '../../config/environment';
import { createAuthenticateMiddleware } from '../../middleware/authenticate.middleware';
import type { EmailAccountService } from '../email-accounts/email-account.service';
import { UserRepository } from '../users/user.repository';
import { WorkspaceRepository } from '../workspaces/workspace.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';

/**
 * Composition root for the authentication module. Wiring lives here so routes
 * stay declarative and every dependency is explicit and swappable in tests.
 */
export function createAuthModule(emailAccountService: EmailAccountService | null = null) {
  const userRepository = new UserRepository();
  const workspaceRepository = new WorkspaceRepository();
  const sessionRepository = new SessionRepository();
  const sessionService = new SessionService(sessionRepository, env.SESSION_TTL_DAYS * 86_400_000);
  const authService = new AuthService(
    userRepository,
    workspaceRepository,
    sessionService,
    emailAccountService,
  );

  return {
    authController: new AuthController(authService),
    authenticate: createAuthenticateMiddleware(sessionService),
    sessionService,
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;
