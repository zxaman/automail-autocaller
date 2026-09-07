import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';

import { API_ENDPOINTS } from '../config/api-endpoints.config';
import { AppError } from '../models/api-error.model';
import type { AuthenticatedUser } from '../models/user.model';
import { ApiClientService } from './api-client.service';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Owns authentication state for the whole application.
 *
 * Security notes:
 * - The session is carried by an HttpOnly cookie issued by the backend.
 * - No token, credential, or Gmail App Password is ever stored in the browser.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);

  private readonly userSignal = signal<AuthenticatedUser | null>(null);
  private readonly statusSignal = signal<AuthStatus>('unknown');

  public readonly user = this.userSignal.asReadonly();
  public readonly status = this.statusSignal.asReadonly();
  public readonly isAuthenticated = computed(() => this.statusSignal() === 'authenticated');
  public readonly isResolved = computed(() => this.statusSignal() !== 'unknown');
  public readonly displayName = computed(() => this.userSignal()?.name ?? 'Guest');
  public readonly initials = computed(() => {
    const name = this.userSignal()?.name?.trim();
    if (!name) {
      return 'AA';
    }
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  });

  /** Loads the current session. Resolves to null when unauthenticated. */
  public loadSession(): Observable<AuthenticatedUser | null> {
    return this.api.get<AuthenticatedUser>(API_ENDPOINTS.auth.me).pipe(
      tap((user) => this.setAuthenticated(user)),
      catchError((error: unknown) => {
        this.clearSession();
        if (error instanceof AppError && !error.isUnauthorized && !error.isNotFound) {
          // Network/server failures still resolve as anonymous for routing purposes.
          return of(null);
        }
        return of(null);
      }),
    );
  }

  /** Exchanges a Google ID token for an application session. */
  public loginWithGoogle(idToken: string): Observable<AuthenticatedUser> {
    return this.api
      .post<AuthenticatedUser, { idToken: string }>(API_ENDPOINTS.auth.google, { idToken })
      .pipe(tap((user) => this.setAuthenticated(user)));
  }

  /** Development-only: creates a session without Google OAuth. */
  public devLogin(): Observable<AuthenticatedUser> {
    return this.api
      .post<AuthenticatedUser>(API_ENDPOINTS.auth.devLogin, {})
      .pipe(tap((user) => this.setAuthenticated(user)));
  }

  public logout(): Observable<unknown> {
    return this.api.post<unknown>(API_ENDPOINTS.auth.logout).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  public clearSession(): void {
    this.userSignal.set(null);
    this.statusSignal.set('anonymous');
  }

  private setAuthenticated(user: AuthenticatedUser): void {
    this.userSignal.set(user);
    this.statusSignal.set('authenticated');
  }
}
