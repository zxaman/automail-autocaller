import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { firstValueFrom } from 'rxjs';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { AuthService } from './core/services/auth.service';
import { APP_ROUTES } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor, errorInterceptor]),
    ),
    provideAnimationsAsync(),
    /**
     * Resolve the session once at startup so guards do not each trigger their
     * own `/auth/me` request and the first paint already knows the auth state.
     */
    provideAppInitializer(() => firstValueFrom(inject(AuthService).loadSession())),
  ],
};
