import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from '../services/loading.service';

/** Tracks in-flight API requests so the shell can show a global progress bar. */
export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loading = inject(LoadingService);

  if (!request.url.startsWith('/api')) {
    return next(request);
  }

  loading.start();
  return next(request).pipe(finalize(() => loading.stop()));
};
