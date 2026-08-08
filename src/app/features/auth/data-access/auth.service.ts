import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthMembership, AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '../models/auth.model';
import { DashboardFacade } from '../../dashboard/data-access/dashboard-facade';
import { DashboardEditDraftStore } from '../../dashboard/data-access/dashboard-edit-draft-store';

/**
 * Holds the session. The access token lives in an in-memory signal ONLY -- never localStorage, so a
 * page reload always starts with none. `restoreSession()` uses the httpOnly refresh-token cookie (set
 * by the backend on login/register, invisible to JS) to silently mint a fresh access token instead,
 * which is what keeps the user logged in across reloads without ever persisting the short-lived token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly injector = inject(Injector);

  /** NOT a credential -- just a plain "has this browser ever completed a login" marker, so
   * `restoreSession()` can skip the refresh call entirely for a first-time visitor instead of always
   * firing a guaranteed-to-401 request on every cold load. The actual refresh token stays exactly
   * where it always was: an httpOnly cookie, never touched by this. */
  private static readonly HAD_SESSION_KEY = 'fastappoint_had_session';

  private readonly accessTokenState = signal<string | null>(null);
  private readonly userState = signal<AuthUser | null>(null);
  private readonly membershipsState = signal<AuthMembership[]>([]);

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly memberships = this.membershipsState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.accessTokenState());
  readonly hasBusiness = computed(() => this.membershipsState().length > 0);

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.api.register(request).pipe(tap((response) => this.applySession(response, true)));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.api.login(request).pipe(tap((response) => this.applySession(response, true)));
  }

  /** Applies a session already obtained elsewhere (the OAuth redirect callback, which gets its access
   * token from the URL fragment rather than a direct login/register call). Memberships are fetched
   * separately via /me since the callback only carries the token itself. */
  applyExternalToken(accessToken: string): Observable<AuthResponse> {
    this.accessTokenState.set(accessToken);
    return this.api.me().pipe(tap((response) => this.applySession(response, true)));
  }

  /** Silent session restore -- call once on app bootstrap/cold load. Resolves true/false instead of
   * erroring, since "no valid session" is an expected, routine outcome here, not a failure. Skips the
   * network call entirely when there's no sign this browser ever logged in -- otherwise every
   * first-time visitor hits a guaranteed 401 on /api/auth/refresh before landing on /login. */
  restoreSession(): Observable<boolean> {
    if (!this.hadSession()) {
      return of(false);
    }
    return this.api.refresh().pipe(
      tap((response) => this.applySession(response, true)),
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  refresh(): Observable<AuthResponse> {
    return this.api.refresh().pipe(tap((response) => this.applySession(response, false)));
  }

  logout(): void {
    this.api.logout().subscribe({ complete: () => this.clearSession(), error: () => this.clearSession() });
  }

  private applySession(response: AuthResponse, syncDashboardState: boolean): void {
    this.accessTokenState.set(response.accessToken);
    this.userState.set(response.user);
    this.membershipsState.set(response.memberships);
    localStorage.setItem(AuthService.HAD_SESSION_KEY, '1');
    if (syncDashboardState) {
      this.injector.get(DashboardEditDraftStore).clearAll();
      this.injector.get(DashboardFacade).reloadForAuthenticatedSession();
    }
  }

  private clearSession(): void {
    this.accessTokenState.set(null);
    this.userState.set(null);
    this.membershipsState.set([]);
    localStorage.removeItem(AuthService.HAD_SESSION_KEY);
    this.injector.get(DashboardEditDraftStore).clearAll();
    this.injector.get(DashboardFacade).resetSessionState();
  }

  private hadSession(): boolean {
    return localStorage.getItem(AuthService.HAD_SESSION_KEY) === '1';
  }
}
