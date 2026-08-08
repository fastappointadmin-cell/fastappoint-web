import { Component, input, output, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardBusiness, DashboardCreateBusinessRequest, DashboardUpdateBusinessRequest } from '../../models/dashboard-business.model';
import { BusinessForm } from '../business-form/business-form';

@Component({
  selector: 'app-business-panel',
  imports: [BusinessForm, TranslocoPipe],
  templateUrl: './business-panel.html',
  styleUrl: './business-panel.scss',
})
export class BusinessPanel {
  readonly business = input<DashboardBusiness | null>(null);

  readonly createBusiness = output<DashboardCreateBusinessRequest>();
  readonly updateBusiness = output<DashboardUpdateBusinessRequest>();

  protected readonly copyFeedback = signal(false);
  protected readonly description = signal<string>('');

  protected readonly shareableUrl = computed(() => {
    const biz = this.business();
    if (!biz?.slug) return '';
    const host = window.location.hostname;
    const port = window.location.port;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${biz.slug}.localhost:${port || 4200}`;
    }
    const parts = host.split('.');
    const mainDomain = parts.slice(-2).join('.');
    return `https://${biz.slug}.${mainDomain}`;
  });

  protected onCreateBusiness(request: DashboardCreateBusinessRequest): void {
    this.createBusiness.emit(request);
  }

  protected onUpdateBusiness(request: DashboardUpdateBusinessRequest): void {
    const updatedRequest: DashboardUpdateBusinessRequest = {
      ...request,
      description: this.description(),
    };
    this.updateBusiness.emit(updatedRequest);
  }

  protected onDescriptionChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.description.set(textarea.value);
  }

  protected copyToClipboard(): void {
    const url = this.shareableUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    });
  }
}
