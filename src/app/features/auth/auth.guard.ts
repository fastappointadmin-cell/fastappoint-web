import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthService } from './data-access/auth.service';

/** If there's already an in-memory access token, we're good. Otherwise (fresh page load -- the token
 * never survives a reload by design) attempt one silent refresh via the httpOnly cookie before giving
 * up and sending the user to /login. */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return authService.restoreSession().pipe(map((restored) => (restored ? true : router.createUrlTree(['/login']))));
};
