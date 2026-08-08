import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
	BusinessConfirmationSettings,
	normalizeBusinessConfirmationSettings
} from '../../../core/models/business-confirmation-settings.model';
import {
	DashboardBusiness,
	DashboardCreateBusinessRequest,
	DashboardUpdateBusinessRequest
} from '../models/dashboard-business.model';
import {
	DashboardCreateResourceAttributeDefinitionRequest,
	DashboardCreateResourceRequest,
	DashboardCreateResourceTypeRequest,
	DashboardResource,
	DashboardResourceType,
	DashboardUpdateResourceRequest,
	DashboardUpdateResourceAttributeDefinitionRequest,
	DashboardUpdateResourceTypeRequest
} from '../models/dashboard-resource.model';
import {
	DashboardCreateServiceRequest,
	DashboardService,
	DashboardUpdateServiceRequest
} from '../models/dashboard-service.model';
import {
	DashboardAddServiceRequirementRequest,
	DashboardUpdateServiceRequirementRequest
} from '../models/dashboard-service-requirement.model';
import { DashboardApiService } from './dashboard-api.service';

@Injectable({ providedIn: 'root' })
export class DashboardFacade {
	private readonly api = inject(DashboardApiService);
	private static readonly fixedSlotSelectionStorageKeys = [
		'fastappoint.fixed-slots.selection.dashboard.services.list',
		'fastappoint.fixed-slots.selection.dashboard.resources.types',
		'fastappoint.fixed-slots.selection.dashboard.resources.items'
	] as const;

	private readonly businessesState = signal<DashboardBusiness[]>([]);
	private readonly selectedBusinessIdState = signal<string | null>(null);
	private readonly resourceTypesByBusinessState = signal<Record<string, DashboardResourceType[]>>({});
	private readonly resourceTypeDeleteErrorState = signal<string | null>(null);

	readonly businesses = this.businessesState.asReadonly();
	readonly selectedBusinessId = this.selectedBusinessIdState.asReadonly();
	readonly resourceTypeDeleteError = this.resourceTypeDeleteErrorState.asReadonly();

	readonly selectedBusiness = computed(
		() => this.businessesState().find((business) => business.id === this.selectedBusinessIdState()) ?? null
	);
	readonly hasBusiness = computed(() => this.businessesState().length > 0);

	constructor() {
		this.reloadBusinesses();
	}

	readonly services = computed(() => this.selectedBusiness()?.services ?? []);
	readonly resources = computed(() => this.selectedBusiness()?.resources ?? []);
	readonly resourceTypes = computed(() => {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return [];
		}

		return this.resourceTypesByBusinessState()[selectedBusinessId] ?? [];
	});

	reloadForAuthenticatedSession(): void {
		this.resetSessionState();
		this.reloadBusinesses(null);
	}

	resetSessionState(): void {
		this.businessesState.set([]);
		this.selectedBusinessIdState.set(null);
		this.resourceTypesByBusinessState.set({});
		this.resourceTypeDeleteErrorState.set(null);
		this.clearPersistedSelections();
	}

	private normalizeRequirement<T extends {
		quantity?: number | null;
		fulfillmentMode?: string | null;
		requiredCapacity?: number | null;
		capacityInputKey?: string | null;
		constraints?: unknown;
	}>(requirement: T) {
		return {
			...requirement,
			quantity: requirement.quantity ?? 1,
			fulfillmentMode: requirement.fulfillmentMode === 'CAPACITY' ? 'CAPACITY' : 'QUANTITY',
			requiredCapacity: requirement.requiredCapacity ?? null,
			capacityInputKey: requirement.capacityInputKey ?? null,
			constraints: Array.isArray(requirement.constraints) ? requirement.constraints : []
		};
	}

	selectBusiness(businessId: string): void {
		this.selectedBusinessIdState.set(businessId);
		this.reloadResourceTypesForBusiness(businessId);
		this.reloadBusinessCollectionsForBusiness(businessId);
	}

	createBusiness(request: DashboardCreateBusinessRequest): void {
		this.api.createBusiness(request).subscribe({
			next: (createdBusiness) => {
				this.reloadBusinesses(createdBusiness.id);
			},
			error: (error) => {
				console.error('Failed to create business', error);
			}
		});
	}

	updateBusiness(request: DashboardUpdateBusinessRequest): void {
		const selectedBusiness = this.selectedBusiness();
		if (!selectedBusiness) {
			return;
		}

		const trimmedName = request.name.trim();
		if (!trimmedName) {
			return;
		}

		this.api
			.updateBusiness(selectedBusiness.id, {
				name: trimmedName,
				description: request.description ?? selectedBusiness.description,
				confirmationSettings: normalizeBusinessConfirmationSettings(
					request.confirmationSettings ?? selectedBusiness.confirmationSettings
				),
				reminderSettings: normalizeBusinessConfirmationSettings(
					request.reminderSettings ?? selectedBusiness.reminderSettings
				)
			})
			.subscribe({
			next: () => {
				this.reloadBusinesses(selectedBusiness.id);
			},
			error: (error) => {
				console.error('Failed to update business', error);
			}
			});
	}

	updateBusinessConfirmationSettings(settings: BusinessConfirmationSettings): void {
		const selectedBusiness = this.selectedBusiness();
		if (!selectedBusiness) {
			return;
		}

		this.updateBusiness({
			name: selectedBusiness.name,
			confirmationSettings: settings
		});
	}

	updateBusinessReminderSettings(settings: BusinessConfirmationSettings): void {
		const selectedBusiness = this.selectedBusiness();
		if (!selectedBusiness) {
			return;
		}

		this.updateBusiness({
			name: selectedBusiness.name,
			reminderSettings: settings
		});
	}

	createResourceType(request: DashboardCreateResourceTypeRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		this.api.createResourceType(selectedBusinessId, request).subscribe({
			next: () => {
				this.reloadResourceTypesForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to create resource type', error);
			}
		});
	}

	updateResourceType(resourceTypeId: string, request: DashboardUpdateResourceTypeRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		const trimmedName = request.name.trim();
		if (!trimmedName) {
			return;
		}


		this.api.updateResourceType(resourceTypeId, { name: trimmedName }).subscribe({
			next: () => {
				this.reloadResourceTypesForBusiness(selectedBusinessId);
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to update resource type', error);
			}
		});
	}

	removeResourceType(resourceTypeId: string): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}


		this.api.removeResourceType(resourceTypeId).subscribe({
			next: () => {
				this.resourceTypeDeleteErrorState.set(null);
				this.reloadResourceTypesForBusiness(selectedBusinessId);
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				this.resourceTypeDeleteErrorState.set(null);
				this.resourceTypeDeleteErrorState.set('dashboard.resources.deleteTypeInUseError');
				console.error('Failed to remove resource type', error);
			}
		});
	}

	clearResourceTypeDeleteError(): void {
		this.resourceTypeDeleteErrorState.set(null);
	}

	createResourceAttributeDefinition(resourceTypeId: string, request: DashboardCreateResourceAttributeDefinitionRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		this.api.createResourceAttributeDefinition(resourceTypeId, request).subscribe({
			next: () => {
				this.reloadResourceTypesForBusiness(selectedBusinessId);
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to create resource attribute definition', error);
			}
		});
	}

	updateResourceAttributeDefinition(
		resourceTypeId: string,
		attributeDefinitionId: string,
		request: DashboardUpdateResourceAttributeDefinitionRequest
	): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		this.api.updateResourceAttributeDefinition(resourceTypeId, attributeDefinitionId, request).subscribe({
			next: () => {
				this.reloadResourceTypesForBusiness(selectedBusinessId);
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to update resource attribute definition', error);
			}
		});
	}

	removeResourceAttributeDefinition(resourceTypeId: string, attributeDefinitionId: string): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		this.api.removeResourceAttributeDefinition(resourceTypeId, attributeDefinitionId).subscribe({
			next: () => {
				this.reloadResourceTypesForBusiness(selectedBusinessId);
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to remove resource attribute definition', error);
			}
		});
	}

	createService(request: DashboardCreateServiceRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		this.api.createService(selectedBusinessId, request).subscribe({
			next: () => {
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to create service', error);
			}
		});
	}

	updateService(serviceId: string, request: DashboardUpdateServiceRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}


		this.api.updateService(serviceId, request).subscribe({
			next: () => {
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to update service', error);
			}
		});
	}

	addServiceRequirement(serviceId: string, request: DashboardAddServiceRequirementRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}


		this.api.addServiceRequirement(serviceId, request).subscribe({
			next: () => {
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to add service requirement', error);
			}
		});
	}

	updateServiceRequirement(
		serviceId: string,
		requirementId: string,
		request: DashboardUpdateServiceRequirementRequest
	): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}


		this.api.updateServiceRequirement(serviceId, requirementId, request).subscribe({
			next: () => {
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to update service requirement', error);
			}
		});
	}

	removeServiceRequirement(serviceId: string, requirementId: string): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}


		this.api.removeServiceRequirement(serviceId, requirementId).subscribe({
			next: () => {
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to remove service requirement', error);
			}
		});
	}

	createResource(request: DashboardCreateResourceRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}

		this.api.createResource(selectedBusinessId, request).subscribe({
			next: () => {
				this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
			},
			error: (error) => {
				console.error('Failed to create resource', error);
			}
		});
	}

	updateResource(resourceId: string, request: DashboardUpdateResourceRequest): void {
		const selectedBusinessId = this.selectedBusinessIdState();
		if (!selectedBusinessId) {
			return;
		}


		this.api.updateResource(resourceId, request).subscribe({
			next: (updatedResource) => {
				this.businessesState.update((businesses) =>
					businesses.map((business) =>
						business.id !== selectedBusinessId
							? business
							: {
									...business,
									resources: business.resources.map((resource) =>
										resource.id === resourceId ? updatedResource : resource
									)
							  }
					)
				);
			},
			error: (error) => {
				console.error('Failed to update resource', error);
			}
		});
	}

	private reloadBusinesses(preferredBusinessId: string | null = this.selectedBusinessIdState()): void {
		this.api.getBusinesses().subscribe({
			next: (businesses) => {
				const normalizedBusinesses = businesses.map((business) => ({
					...business,
					confirmationSettings: normalizeBusinessConfirmationSettings(business.confirmationSettings),
					reminderSettings: normalizeBusinessConfirmationSettings(business.reminderSettings),
					services: Array.isArray(business.services)
						? business.services.map((service) => ({
							...service,
							requirements: Array.isArray(service.requirements)
								? service.requirements.map((requirement) => this.normalizeRequirement(requirement))
								: []
						}))
						: [],
					resources: Array.isArray(business.resources)
						? business.resources.map((resource) => ({
							...resource,
							mergeGroup: resource.mergeGroup ?? null,
							attributeValues: Array.isArray(resource.attributeValues) ? resource.attributeValues : []
						}))
						: []
				}));

				this.businessesState.set(normalizedBusinesses);

				if (!normalizedBusinesses.length) {
					this.selectedBusinessIdState.set(null);
					this.resourceTypesByBusinessState.set({});
					return;
				}

				const hasPreferredSelection =
					preferredBusinessId !== null &&
					normalizedBusinesses.some((business) => business.id === preferredBusinessId);

				const selectedBusinessId = hasPreferredSelection
					? preferredBusinessId
					: normalizedBusinesses[0].id;

				this.selectedBusinessIdState.set(selectedBusinessId);

				if (selectedBusinessId) {
					this.reloadResourceTypesForBusiness(selectedBusinessId);
					this.reloadBusinessCollectionsForBusiness(selectedBusinessId);
				}
			},
			error: (error) => {
				console.error('Failed to load businesses', error);
			}
		});
	}

	private reloadResourceTypesForBusiness(businessId: string): void {
		this.api.getResourceTypes(businessId).subscribe({
			next: (resourceTypes) => {
				const normalizedResourceTypes = resourceTypes.map((resourceType) => ({
					...resourceType,
					attributeDefinitions: Array.isArray(resourceType.attributeDefinitions)
						? resourceType.attributeDefinitions
						: []
				}));
				this.resourceTypesByBusinessState.update((currentState) => ({
					...currentState,
					[businessId]: normalizedResourceTypes
				}));
			},
			error: (error) => {
				console.error('Failed to load resource types', error);
			}
		});
	}

	private reloadBusinessCollectionsForBusiness(businessId: string): void {
		forkJoin({
			services: this.api.getServices(businessId),
			resources: this.api.getResources(businessId)
		}).subscribe({
			next: ({ services, resources }) => {
				const normalizedServices = services.map((service) => ({
					...service,
					requirements: Array.isArray(service.requirements)
						? service.requirements.map((requirement) => this.normalizeRequirement(requirement))
						: []
				}));
				const normalizedResources = resources.map((resource) => ({
					...resource,
					mergeGroup: resource.mergeGroup ?? null,
					attributeValues: Array.isArray(resource.attributeValues) ? resource.attributeValues : []
				}));
				this.businessesState.update((businesses) =>
					businesses.map((business) =>
						business.id !== businessId
							? business
							: {
									...business,
									services: this.preserveOrderById(business.services, normalizedServices),
									resources: normalizedResources
							  }
					)
				);
			},
			error: (error) => {
				console.error('Failed to load business services/resources', error);
			}
		});
	}

	private preserveOrderById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
		if (!current.length) {
			return incoming;
		}

		const incomingById = new Map(incoming.map((item) => [item.id, item]));
		const ordered = current
			.map((item) => incomingById.get(item.id))
			.filter((item): item is T => item !== undefined);

		for (const item of incoming) {
			if (!ordered.some((orderedItem) => orderedItem.id === item.id)) {
				ordered.push(item);
			}
		}

		return ordered;
	}

	private clearPersistedSelections(): void {
		if (typeof window === 'undefined') {
			return;
		}

		for (const storageKey of DashboardFacade.fixedSlotSelectionStorageKeys) {
			window.localStorage.removeItem(storageKey);
		}
	}
}
