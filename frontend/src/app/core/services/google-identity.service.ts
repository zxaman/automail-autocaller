import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, from, shareReplay, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { GoogleCredentialResponse, GoogleNamespace } from '../models/google-identity.model';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ID = 'google-identity-services';

/**
 * Loads Google Identity Services on demand and renders the official sign-in
 * button.
 *
 * The library returns a short-lived ID token which is forwarded to the backend
 * for verification. The frontend never holds a client secret and never trusts
 * the token's contents; the server is the only authority.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private readonly document = inject(DOCUMENT);
  private scriptLoad$: Observable<GoogleNamespace> | null = null;

  public get isConfigured(): boolean {
    return environment.googleClientId.trim().length > 0;
  }

  /**
   * Renders the Google button into `container` and emits an ID token for each
   * successful credential response.
   */
  public renderButton(container: HTMLElement): Observable<string> {
    const credential$ = new Subject<string>();

    return this.load().pipe(
      switchMap((google) => {
        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: GoogleCredentialResponse) => {
            if (response.credential) {
              credential$.next(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        container.replaceChildren();
        google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(Math.max(container.clientWidth, 200), 400),
        });

        return credential$.asObservable();
      }),
    );
  }

  /** Prevents silent re-authentication after an explicit sign-out. */
  public disableAutoSelect(): void {
    globalThis.google?.accounts.id.disableAutoSelect();
  }

  private load(): Observable<GoogleNamespace> {
    this.scriptLoad$ ??= from(this.injectScript()).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.scriptLoad$;
  }

  private injectScript(): Promise<GoogleNamespace> {
    return new Promise<GoogleNamespace>((resolve, reject) => {
      if (globalThis.google?.accounts?.id) {
        resolve(globalThis.google);
        return;
      }

      const existing = this.document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
      const script = existing ?? this.document.createElement('script');

      const onLoad = (): void => {
        if (globalThis.google?.accounts?.id) {
          resolve(globalThis.google);
        } else {
          reject(new Error('Google Identity Services loaded without an accounts API'));
        }
      };

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error('Google Identity Services could not be loaded')),
        { once: true },
      );

      if (!existing) {
        script.id = GIS_SCRIPT_ID;
        script.src = GIS_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        this.document.head.appendChild(script);
      }
    });
  }
}
