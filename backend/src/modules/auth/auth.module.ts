import { env } from '../../config/environment';
import { createGoogleTokenVerifier } from '../../infrastructure/google/google-token-verifier';
import { createAuthenticateMiddleware } from '../../middleware/authenticate.middleware';
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
export function createAuthModule() {
  const userRepository = new UserRepository();
  const workspaceRepository = new WorkspaceRepository();
  const sessionRepository = new SessionRepository();
  const sessionService = new SessionService(sessionRepository, env.SESSION_TTL_DAYS * 86_400_000);
  const authService = new AuthService(
    userRepository,
    workspaceRepository,
    sessionService,
    createGoogleTokenVerifier(),
  );

  return {
    authController: new AuthController(authService),
    authenticate: createAuthenticateMiddleware(sessionService),
    sessionService,
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;
