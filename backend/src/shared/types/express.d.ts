import 'express-serve-static-core';

import type { AuthContext } from '../../modules/auth/auth.types';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    /** Present only after the authenticate middleware has run. */
    auth?: AuthContext;
  }
}
