import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardFacade } from '../../data-access/dashboard-facade';
import { ServicesPanel } from '../../components/services-panel/services-panel';

@Component({
	selector: 'app-dashboard-services-page',
	imports: [ServicesPanel, TranslocoPipe],
	templateUrl: './dashboard-services-page.html',
	styleUrl: './dashboard-services-page.scss',
})
export class DashboardServicesPage {
	private readonly facade = inject(DashboardFacade);

	protected readonly services = this.facade.services;
	protected readonly resourceTypes = this.facade.resourceTypes;

	protected createService(request: Parameters<DashboardFacade['createService']>[0]): void {
		this.facade.createService(request);
	}

	protected updateService(event: { serviceId: string; request: Parameters<DashboardFacade['updateService']>[1] }): void {
		this.facade.updateService(event.serviceId, event.request);
	}

	protected addRequirement(event: { serviceId: string; request: Parameters<DashboardFacade['addServiceRequirement']>[1] }): void {
		this.facade.addServiceRequirement(event.serviceId, event.request);
	}

	protected updateRequirement(event: {
		serviceId: string;
		requirementId: string;
		request: Parameters<DashboardFacade['updateServiceRequirement']>[2];
	}): void {
		this.facade.updateServiceRequirement(event.serviceId, event.requirementId, event.request);
	}

	protected removeRequirement(event: { serviceId: string; requirementId: string }): void {
		this.facade.removeServiceRequirement(event.serviceId, event.requirementId);
	}
}