import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { backendConfig } from '../../../core/config/backend.config';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';

/** `withCredentials: true` is required on every call here (not elsewhere in the app) -- these are the
 * only endpoints the httpOnly refresh-token cookie needs to travel on. */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${backendConfig.baseUrl}/api/auth`;

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, request, { withCredentials: true });
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, request, { withCredentials: true });
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, {}, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true });
  }

  me(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.baseUrl}/me`);
  }
}
