import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { PlatformService } from './platform.service';

/**
 * Builds the absolute API URL for the current platform.
 *
 * On the web the API is same-origin, so a relative `/api/v1` path is correct
 * and keeps the session cookie first-party.
 *
 * Inside a Capacitor WebView the page origin is the device itself
 * (`capacitor://localhost` or `http://localhost`), so a relative path would
 * request a server that does not exist there. Native builds therefore need a
 * configured absolute origin, and requests become cross-origin, which is why
 * the backend must allow the native origin explicitly.
 */
@Injectable({ providedIn: 'root' })
export class ApiUrlService {
  private readonly platform = inject(PlatformService);

  public get baseUrl(): string {
    if (!this.platform.isNative) {
      return environment.apiBaseUrl;
    }

    const origin = environment.nativeApiOrigin.replace(/\/+$/, '');

    // Misconfiguration must be loud. Silently falling back to a relative path
    // would produce confusing 404s from the device instead of the API.
    if (origin.length === 0) {
      throw new Error(
        'nativeApiOrigin is not configured. A native build cannot reach the API with a relative path.',
      );
    }

    return `${origin}${environment.apiBaseUrl}`;
  }

  public resolve(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalized}`;
  }
}
