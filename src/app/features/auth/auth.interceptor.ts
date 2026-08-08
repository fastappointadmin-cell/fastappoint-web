import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './data-access/auth.service';

/** Attaches the in-memory access token as a Bearer header. On a 401 from any API call other than the
 * auth endpoints themselves, attempts exactly one silent refresh and retries the original request --
 * if the refresh also fails, the session is genuinely over and the user is sent back to /login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.accessToken();
  const authorizedReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/api/auth/')) {
        return authService.refresh().pipe(
          switchMap((response) => next(req.clone({ setHeaders: { Authorization: `Bearer ${response.accessToken}` } }))),
          catchError((refreshError) => {
            authService.logout();
            router.navigateByUrl('/login');
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
