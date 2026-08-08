import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../data-access/auth.service';

/** Landing spot for the OAuth redirect. The backend puts the freshly-issued access token in the URL
 * fragment (never sent to any server, read once here then discarded) -- the refresh-token cookie was
 * already set directly by the backend's redirect response. */
@Component({
  selector: 'app-auth-callback-page',
  imports: [TranslocoPipe],
  template: `
    <div class="auth-callback-shell">
      <p>{{ 'auth.callback.signingIn' | transloco }}</p>
    </div>
  `,
  styles: [
    `
      .auth-callback-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
        color: #475569;
        font-size: 0.9rem;
        font-weight: 600;
      }
    `
  ]
})
export class AuthCallbackPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const fragment = window.location.hash.replace(/^#/, '');
    const token = new URLSearchParams(fragment).get('accessToken');

    if (!token) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.authService.applyExternalToken(token).subscribe({
      next: (response) => {
        this.router.navigateByUrl(response.memberships.length === 0 ? '/onboarding/create-business' : '/dashboard');
      },
      error: () => this.router.navigateByUrl('/login')
    });
  }
}
