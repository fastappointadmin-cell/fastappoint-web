import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardApiService } from '../../data-access/dashboard-api.service';
import { DashboardWhatsAppConnection, DashboardWhatsAppSource } from '../../models/dashboard-whatsapp.model';

@Component({
  selector: 'app-whatsapp-connection-panel',
  imports: [FormsModule, TranslocoPipe],
  templateUrl: './whatsapp-connection-panel.html',
  styleUrl: './whatsapp-connection-panel.scss'
})
export class WhatsAppConnectionPanel {
  private readonly api = inject(DashboardApiService);
  private readonly transloco = inject(TranslocoService);

  readonly businessId = input.required<string>();

  protected readonly connection = signal<DashboardWhatsAppConnection | null>(null);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Which source the chooser has open ("own number" reveals a phone-number field before submitting). */
  protected readonly pendingSource = signal<DashboardWhatsAppSource | null>(null);
  protected readonly ownPhoneNumber = signal('');
  protected readonly otpCode = signal('');
  protected readonly copyFeedback = signal(false);

  protected readonly status = computed(() => this.connection()?.status ?? null);
  protected readonly isActive = computed(() => this.status() === 'ACTIVE');
  protected readonly isAwaitingOtp = computed(() => this.status() === 'AWAITING_OTP');
  protected readonly isFailed = computed(() => this.status() === 'FAILED');
  /** Not connected, or a previous attempt ended (disconnected/failed) -- show the source chooser again. */
  protected readonly showChooser = computed(() => !this.isActive() && !this.isAwaitingOtp());

  constructor() {
    // Re-loads whenever `businessId` changes -- the host page reuses this component across the
    // business switcher instead of recreating it, so ngOnInit alone would only ever load the first
    // business selected and silently keep showing its status after switching to another one.
    effect(() => {
      const businessId = this.businessId();
      this.connection.set(null);
      this.pendingSource.set(null);
      this.error.set(null);
      this.loading.set(true);
      this.api.getWhatsAppConnection(businessId).subscribe({
        next: (connection) => {
          this.connection.set(connection);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.transloco.translate('dashboard.whatsapp.errors.loadFailed'));
          this.loading.set(false);
        }
      });
    });
  }

  protected chooseProvisioned(): void {
    this.pendingSource.set('PROVISIONED');
    this.startConnection('PROVISIONED');
  }

  protected chooseOwnNumber(): void {
    this.pendingSource.set('OWN_NUMBER');
  }

  protected cancelOwnNumberChoice(): void {
    this.pendingSource.set(null);
    this.ownPhoneNumber.set('');
  }

  protected submitOwnNumber(): void {
    if (!this.ownPhoneNumber().trim()) {
      return;
    }
    this.startConnection('OWN_NUMBER', this.ownPhoneNumber().trim());
  }

  protected submitOtp(): void {
    const code = this.otpCode().trim();
    if (!code) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.submitWhatsAppOtp(this.businessId(), { code }).subscribe({
      next: (connection) => {
        this.connection.set(connection);
        this.otpCode.set('');
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.serverMessage(err) ?? this.transloco.translate('dashboard.whatsapp.errors.otpRejected'));
        this.submitting.set(false);
      }
    });
  }

  protected disconnect(): void {
    this.submitting.set(true);
    this.api.disconnectWhatsApp(this.businessId()).subscribe({
      next: (connection) => {
        this.connection.set(connection);
        this.pendingSource.set(null);
        this.submitting.set(false);
      },
      error: () => {
        this.error.set(this.transloco.translate('dashboard.whatsapp.errors.disconnectFailed'));
        this.submitting.set(false);
      }
    });
  }

  protected copyLink(): void {
    const link = this.connection()?.waLink;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    });
  }

  private startConnection(source: DashboardWhatsAppSource, ownPhoneNumber?: string): void {
    this.submitting.set(true);
    this.error.set(null);
    this.api.startWhatsAppConnection(this.businessId(), { source, ownPhoneNumber }).subscribe({
      next: (connection) => {
        this.connection.set(connection);
        this.pendingSource.set(null);
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.serverMessage(err) ?? this.transloco.translate('dashboard.whatsapp.errors.connectFailed'));
        this.submitting.set(false);
      }
    });
  }

  private serverMessage(err: HttpErrorResponse): string | null {
    const message = err.error?.message;
    return typeof message === 'string' && message.trim() ? message : null;
  }
}
