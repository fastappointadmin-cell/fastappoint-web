import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardAddServiceRequirementRequest } from '../../models/dashboard-service-requirement.model';
import { DashboardResourceType } from '../../models/dashboard-resource.model';
import {
	defaultConstraintForDefinition,
	getConstraintOperators
} from '../../models/dashboard-resource-attribute.helpers';
import {
	DashboardResourceAttributeDefinition,
	DashboardServiceRequirementConstraintInput,
	DashboardServiceRequirementConstraintOperator
} from '../../models/dashboard-resource-attribute.model';
import { DashboardServiceRequirementFulfillmentMode } from '../../models/dashboard-service-requirement.model';

export interface ServiceRequirementCreateDialogData {
	resourceTypes: DashboardResourceType[];
}

@Component({
	selector: 'app-service-requirement-create-dialog',
	imports: [FormsModule, DialogModule, TranslocoPipe],
	templateUrl: './service-requirement-create-dialog.html',
	styleUrl: './service-requirement-create-dialog.scss',
})
export class ServiceRequirementCreateDialog {
	private readonly dialogRef = inject(DialogRef<DashboardAddServiceRequirementRequest | null>);
	protected readonly data = inject<ServiceRequirementCreateDialogData>(DIALOG_DATA);

	protected readonly resourceTypeId = signal('');
	protected readonly quantity = signal(1);
	protected readonly fulfillmentMode = signal<DashboardServiceRequirementFulfillmentMode>('QUANTITY');
	protected readonly requiredCapacity = signal<number | null>(null);
	protected readonly capacityInputKey = signal('');
	protected readonly constraints = signal<DashboardServiceRequirementConstraintInput[]>([]);
	protected readonly selectedType = computed(
		() => this.data.resourceTypes.find((resourceType) => resourceType.id === this.resourceTypeId()) ?? null
	);

	protected cancel(): void {
		this.dialogRef.close(null);
	}

	protected onResourceTypeChange(resourceTypeId: string): void {
		this.resourceTypeId.set(resourceTypeId);
		this.constraints.set([]);
	}

	protected setFulfillmentMode(mode: DashboardServiceRequirementFulfillmentMode): void {
		this.fulfillmentMode.set(mode);
		if (mode === 'QUANTITY') {
			if (this.quantity() < 1) {
				this.quantity.set(1);
			}
			return;
		}
		const requiredCapacity = this.requiredCapacity();
		if (requiredCapacity === null || requiredCapacity < 1) {
			this.requiredCapacity.set(1);
		}
	}

	protected addConstraint(): void {
		const selectedType = this.selectedType();
		if (!selectedType) {
			return;
		}

		const usedDefinitionIds = new Set(this.constraints().map((constraint) => constraint.attributeDefinitionId));
		const nextDefinition = selectedType.attributeDefinitions.find((definition) => !usedDefinitionIds.has(definition.id));
		if (!nextDefinition) {
			return;
		}

		this.constraints.update((constraints) => [...constraints, defaultConstraintForDefinition(nextDefinition)]);
	}

	protected removeConstraint(index: number): void {
		this.constraints.update((constraints) => constraints.filter((_, itemIndex) => itemIndex !== index));
	}

	protected changeConstraintDefinition(index: number, attributeDefinitionId: string): void {
		const definition = this.selectedType()?.attributeDefinitions.find((item) => item.id === attributeDefinitionId);
		if (!definition) {
			return;
		}

		this.constraints.update((constraints) => {
			const nextConstraints = [...constraints];
			nextConstraints[index] = defaultConstraintForDefinition(definition);
			return nextConstraints;
		});
	}

	protected changeConstraintOperator(index: number, operator: DashboardServiceRequirementConstraintOperator): void {
		this.constraints.update((constraints) => {
			const nextConstraints = [...constraints];
			nextConstraints[index] = { ...nextConstraints[index], operator };
			return nextConstraints;
		});
	}

	protected changeConstraintValue(index: number, expectedValue: string): void {
		this.constraints.update((constraints) => {
			const nextConstraints = [...constraints];
			nextConstraints[index] = { ...nextConstraints[index], expectedValue };
			return nextConstraints;
		});
	}

	protected definitionForConstraint(attributeDefinitionId: string): DashboardResourceAttributeDefinition | null {
		return this.selectedType()?.attributeDefinitions.find((definition) => definition.id === attributeDefinitionId) ?? null;
	}

	protected operatorsForDefinition(definition: DashboardResourceAttributeDefinition): DashboardServiceRequirementConstraintOperator[] {
		return getConstraintOperators(definition.type);
	}

	protected submit(): void {
		const selectedTypeId = this.resourceTypeId();
		const mode = this.fulfillmentMode();
		const normalizedCapacityInputKey = this.capacityInputKey().trim() || null;
		const requiredCapacity = this.requiredCapacity();
		const normalizedRequiredCapacity =
			requiredCapacity !== null && requiredCapacity >= 1 ? requiredCapacity : null;
		if (!selectedTypeId || (mode === 'QUANTITY' && this.quantity() < 1)) {
			return;
		}
		if (mode === 'CAPACITY' && normalizedRequiredCapacity === null && normalizedCapacityInputKey === null) {
			return;
		}

		this.dialogRef.close({
			resourceTypeId: selectedTypeId,
			quantity: this.quantity(),
			fulfillmentMode: mode,
			requiredCapacity: mode === 'CAPACITY' ? normalizedRequiredCapacity : null,
			capacityInputKey: mode === 'CAPACITY' ? normalizedCapacityInputKey : null,
			constraints: this.constraints()
		});
	}
}
