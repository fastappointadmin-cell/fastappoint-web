import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { BusinessPanel } from '../../components/business-panel/business-panel';
import { WhatsAppConnectionPanel } from '../../components/whatsapp-connection-panel/whatsapp-connection-panel';
import { DashboardCreateBusinessRequest, DashboardUpdateBusinessRequest } from '../../models/dashboard-business.model';
import { DashboardFacade } from '../../data-access/dashboard-facade';
import { AuthService } from '../../../auth/data-access/auth.service';
import { LanguageSwitcher } from '../../../../shared/language-switcher/language-switcher';
import { DashboardTour } from '../../components/dashboard-tour/dashboard-tour';
import { TourService } from '../../data-access/tour.service';

@Component({
  selector: 'app-dashboard-workspace-page',
  imports: [BusinessPanel, WhatsAppConnectionPanel, RouterLink, RouterLinkActive, RouterOutlet, CommonModule, TranslocoPipe, LanguageSwitcher, DashboardTour],
  templateUrl: './dashboard-workspace-page.html',
  styleUrl: './dashboard-workspace-page.scss',
})
export class DashboardWorkspacePage implements OnInit {
  private readonly facade = inject(DashboardFacade);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tourService = inject(TourService);

  protected readonly selectedBusiness = this.facade.selectedBusiness;
  protected readonly hasBusiness = this.facade.hasBusiness;
  protected readonly businesses = this.facade.businesses;
  protected readonly selectedBusinessId = this.facade.selectedBusinessId;
  protected readonly currentUser = this.authService.user;

  quickLinks = [
  { route: '/dashboard/services',  icon: 'bi-scissors',  title: 'dashboard.workspace.nav.services.title', tip: 'dashboard.workspace.nav.services.tip' },
  { route: '/dashboard/resources', icon: 'bi-hdd-rack',  title: 'dashboard.workspace.nav.resources.title', tip: 'dashboard.workspace.nav.resources.tip' },
  { route: '/dashboard/calendar',  icon: 'bi-calendar3', title: 'dashboard.workspace.nav.calendar.title', tip: 'dashboard.workspace.nav.calendar.tip' },
  { route: '/dashboard/bookings',  icon: 'bi-inbox-fill', title: 'dashboard.workspace.nav.bookings.title', tip: 'dashboard.workspace.nav.bookings.tip' },
  { route: '/dashboard/customers', icon: 'bi-people-fill', title: 'dashboard.workspace.nav.customers.title', tip: 'dashboard.workspace.nav.customers.tip' },
  { route: '/dashboard/confirmation-message', icon: 'bi-chat-square-text', title: 'dashboard.workspace.nav.confirmationMessage.title', tip: 'dashboard.workspace.nav.confirmationMessage.tip' },
];

  ngOnInit(): void {
    if (!this.tourService.hasSeen) {
      // Small delay so the page finishes rendering before the tour overlay appears
      setTimeout(() => this.tourService.start(), 400);
    }
  }

  protected startTour(): void {
    this.tourService.start();
  }

  protected createBusiness(request: DashboardCreateBusinessRequest): void {
    this.facade.createBusiness(request);
  }

  protected updateBusiness(request: DashboardUpdateBusinessRequest): void {
    this.facade.updateBusiness(request);
  }

  protected switchBusiness(businessId: string): void {
    this.facade.selectBusiness(businessId);
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
