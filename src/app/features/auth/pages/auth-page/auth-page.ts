import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { backendConfig } from '../../../../core/config/backend.config';
import { LanguageSwitcher } from '../../../../shared/language-switcher/language-switcher';
import { AuthService } from '../../data-access/auth.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, TranslocoPipe, LanguageSwitcher],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss'
})
export class AuthPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode = signal<AuthMode>((this.route.snapshot.data['mode'] as AuthMode) ?? 'login');
  protected readonly loading = signal(false);
  /** Holds either a translation key (client-side validation messages) or a raw server error message
   * (backend errors aren't localized -- the transloco pipe just echoes those back unchanged since no
   * translation key matches them, which is the correct behavior for text we can't translate anyway). */
  protected readonly error = signal<string | null>(null);

  protected readonly loginEmail = signal('');
  protected readonly loginPassword = signal('');

  protected readonly registerBusinessName = signal('');
  protected readonly registerDisplayName = signal('');
  protected readonly registerEmail = signal('');
  protected readonly registerPassword = signal('');
  protected readonly registerPasswordConfirm = signal('');

  protected readonly googleAuthUrl = `${backendConfig.baseUrl}/oauth2/authorization/google`;
  protected readonly facebookAuthUrl = `${backendConfig.baseUrl}/oauth2/authorization/facebook`;

  protected setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  protected submitLogin(): void {
    if (!this.loginEmail().trim() || !this.loginPassword()) {
      this.error.set('auth.errors.loginFillFields');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.authService.login({ email: this.loginEmail().trim(), password: this.loginPassword() }).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'auth.errors.loginDefault');
      }
    });
  }

  protected submitRegister(): void {
    if (!this.registerBusinessName().trim() || !this.registerEmail().trim() || this.registerPassword().length < 8) {
      this.error.set('auth.errors.registerFillFields');
      return;
    }
    if (this.registerPassword() !== this.registerPasswordConfirm()) {
      this.error.set('auth.errors.registerPasswordMismatch');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.authService
      .register({
        businessName: this.registerBusinessName().trim(),
        email: this.registerEmail().trim(),
        password: this.registerPassword(),
        displayName: this.registerDisplayName().trim()
      })
      .subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'auth.errors.registerDefault');
        }
      });
  }
}
