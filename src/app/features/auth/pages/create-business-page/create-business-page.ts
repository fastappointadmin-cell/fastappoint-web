import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BusinessForm } from '../../../dashboard/components/business-form/business-form';
import { DashboardApiService } from '../../../dashboard/data-access/dashboard-api.service';
import { DashboardCreateBusinessRequest } from '../../../dashboard/models/dashboard-business.model';

/** One-time completion step after a first-time OAuth sign-in: the account exists but has no business
 * yet (registering via email/password creates one immediately; OAuth doesn't, since a returning OAuth
 * user logging in again shouldn't spawn a new business every time -- see AuthController). */
@Component({
  selector: 'app-create-business-page',
  imports: [BusinessForm, TranslocoPipe],
  templateUrl: './create-business-page.html',
  styleUrl: './create-business-page.scss'
})
export class CreateBusinessPage {
  private readonly api = inject(DashboardApiService);
  private readonly router = inject(Router);

  protected createBusiness(request: DashboardCreateBusinessRequest): void {
    this.api.createBusiness(request).subscribe(() => this.router.navigateByUrl('/dashboard'));
  }
}
