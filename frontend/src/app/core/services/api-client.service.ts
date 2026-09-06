import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { ApiUrlService } from '../platform/api-url.service';
import { AppError } from '../models/api-error.model';
import type { ApiResponse } from '../models/api-response.model';

export type QueryParams = Readonly<Record<string, string | number | boolean | undefined | null>>;

/**
 * Thin transport layer around HttpClient.
 * Responsibilities: base URL, envelope unwrapping, error normalization.
 * Feature-specific logic belongs in feature services, not here.
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  public get<TData>(path: string, params?: QueryParams): Observable<TData> {
    return this.unwrap(
      this.http.get<ApiResponse<TData>>(this.url(path), {
        params: this.toHttpParams(params),
        withCredentials: true,
      }),
    );
  }

  public post<TData, TBody = unknown>(path: string, body?: TBody): Observable<TData> {
    return this.unwrap(
      this.http.post<ApiResponse<TData>>(this.url(path), body ?? {}, { withCredentials: true }),
    );
  }

  public put<TData, TBody = unknown>(path: string, body: TBody): Observable<TData> {
    return this.unwrap(
      this.http.put<ApiResponse<TData>>(this.url(path), body, { withCredentials: true }),
    );
  }

  public patch<TData, TBody = unknown>(path: string, body: TBody): Observable<TData> {
    return this.unwrap(
      this.http.patch<ApiResponse<TData>>(this.url(path), body, { withCredentials: true }),
    );
  }

  /**
   * Multipart upload. The Content-Type header is deliberately not set so the
   * browser can add the multipart boundary itself.
   */
  public upload<TData>(path: string, formData: FormData, params?: QueryParams): Observable<TData> {
    return this.unwrap(
      this.http.post<ApiResponse<TData>>(this.url(path), formData, {
        params: this.toHttpParams(params),
        withCredentials: true,
      }),
    );
  }

  public delete<TData>(path: string): Observable<TData> {
    return this.unwrap(
      this.http.delete<ApiResponse<TData>>(this.url(path), { withCredentials: true }),
    );
  }

  /**
   * Native builds need an absolute origin; the web stays relative. Resolved
   * per call so the platform decision lives in exactly one place.
   */
  private url(path: string): string {
    return this.apiUrl.resolve(path);
  }

  private toHttpParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (!params) {
      return httpParams;
    }
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  private unwrap<TData>(source: Observable<ApiResponse<TData>>): Observable<TData> {
    return source.pipe(
      map((response) => {
        if (response.success) {
          return response.data;
        }
        throw new AppError({
          code: response.error.code,
          message: response.message,
          status: 400,
          details: response.error.details,
        });
      }),
      catchError((error: unknown) => throwError(() => this.normalize(error))),
    );
  }

  private normalize(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiResponse<unknown>> | null;
      const isEnvelope =
        !!body && typeof body === 'object' && 'success' in body && body.success === false;
      return new AppError({
        code: isEnvelope
          ? ((body as { error?: { code?: string } }).error?.code ?? 'REQUEST_FAILED')
          : this.fallbackCode(error.status),
        message: isEnvelope
          ? ((body as { message?: string }).message ?? 'The request failed.')
          : this.fallbackMessage(error.status),
        status: error.status,
      });
    }
    return new AppError({
      code: 'UNEXPECTED_ERROR',
      message: 'Something went wrong. Please try again.',
      status: 500,
    });
  }

  private fallbackCode(status: number): string {
    switch (status) {
      case 0:
        return 'NETWORK_UNAVAILABLE';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'REQUEST_FAILED';
    }
  }

  private fallbackMessage(status: number): string {
    switch (status) {
      case 0:
        return 'Cannot reach the server. Check your connection and try again.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have access to this resource.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please slow down and retry shortly.';
      default:
        return 'The request failed. Please try again.';
    }
  }
}
