import { Component, effect, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardFacade } from '../../data-access/dashboard-facade';
import { ResourcesPanel as DashboardResourcesPanel } from '../../components/resources-panel/resources-panel.entry';

@Component({
	selector: 'app-dashboard-resources-page',
	imports: [DashboardResourcesPanel, TranslocoPipe],
	templateUrl: './dashboard-resources-page.html',
	styleUrl: './dashboard-resources-page.scss',
})
export class DashboardResourcesPage {
	private readonly facade = inject(DashboardFacade);
	private hideWarningTimer: ReturnType<typeof setTimeout> | null = null;

	protected readonly resources = this.facade.resources;
	protected readonly services = this.facade.services;
	protected readonly resourceTypes = this.facade.resourceTypes;
	protected readonly resourceTypeDeleteError = this.facade.resourceTypeDeleteError;
	protected readonly warningMessage = signal<string | null>(null);

	constructor() {
		effect(() => {
			const errorMessage = this.resourceTypeDeleteError();
			if (!errorMessage) {
				return;
			}

			this.warningMessage.set(errorMessage);
			if (this.hideWarningTimer) {
				clearTimeout(this.hideWarningTimer);
			}
			this.hideWarningTimer = setTimeout(() => {
				this.warningMessage.set(null);
				this.hideWarningTimer = null;
			}, 7000);
			this.facade.clearResourceTypeDeleteError();
		});
	}

	protected dismissWarning(): void {
		this.warningMessage.set(null);
		if (this.hideWarningTimer) {
			clearTimeout(this.hideWarningTimer);
			this.hideWarningTimer = null;
		}
	}

	protected createResource(request: Parameters<DashboardFacade['createResource']>[0]): void {
		this.facade.createResource(request);
	}

	protected createResourceType(request: Parameters<DashboardFacade['createResourceType']>[0]): void {
		this.facade.createResourceType(request);
	}

	protected updateResourceType(event: { resourceTypeId: string; request: Parameters<DashboardFacade['updateResourceType']>[1] }): void {
		this.facade.updateResourceType(event.resourceTypeId, event.request);
	}

	protected removeResourceType(resourceTypeId: string): void {
		this.facade.removeResourceType(resourceTypeId);
	}

	protected updateResource(event: { resourceId: string; request: Parameters<DashboardFacade['updateResource']>[1] }): void {
		this.facade.updateResource(event.resourceId, event.request);
	}

	protected createResourceAttributeDefinition(
		event: { resourceTypeId: string; request: Parameters<DashboardFacade['createResourceAttributeDefinition']>[1] }
	): void {
		this.facade.createResourceAttributeDefinition(event.resourceTypeId, event.request);
	}

	protected updateResourceAttributeDefinition(
		event: {
			resourceTypeId: string;
			attributeDefinitionId: string;
			request: Parameters<DashboardFacade['updateResourceAttributeDefinition']>[2];
		}
	): void {
		this.facade.updateResourceAttributeDefinition(
			event.resourceTypeId,
			event.attributeDefinitionId,
			event.request
		);
	}

	protected removeResourceAttributeDefinition(event: { resourceTypeId: string; attributeDefinitionId: string }): void {
		this.facade.removeResourceAttributeDefinition(event.resourceTypeId, event.attributeDefinitionId);
	}
}