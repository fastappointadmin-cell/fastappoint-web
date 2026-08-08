import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogModule, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardCreateResourceRequest, DashboardResourceType } from '../../models/dashboard-resource.model';
import { buildAttributeValueInputs } from '../../models/dashboard-resource-attribute.helpers';

export interface ResourceCreateDialogData {
	resourceTypes: DashboardResourceType[];
}

@Component({
	selector: 'app-resource-create-dialog',
	imports: [FormsModule, DialogModule, TranslocoPipe],
	templateUrl: './resource-create-dialog.html',
	styleUrl: './resource-create-dialog.scss',
})
export class ResourceCreateDialog {
	private readonly dialogRef = inject(DialogRef<DashboardCreateResourceRequest | null>);
	protected readonly data = inject<ResourceCreateDialogData>(DIALOG_DATA);

	protected readonly name = signal('');
	protected readonly typeId = signal('');
	protected readonly capacity = signal<number | null>(null);
	protected readonly combinationEnabled = signal(false);
	protected readonly mergeGroup = signal('');
	protected readonly attributeValues = signal<Record<string, string>>({});
	protected readonly submittedMergeGroup = computed(() =>
		this.combinationEnabled() ? this.mergeGroup().trim() || null : null
	);
	protected readonly selectedType = computed(
		() => this.data.resourceTypes.find((resourceType) => resourceType.id === this.typeId()) ?? null
	);

	protected cancel(): void {
		this.dialogRef.close(null);
	}

	protected onTypeChange(typeId: string): void {
		this.typeId.set(typeId);
		const selectedType =
			this.data.resourceTypes.find((resourceType) => resourceType.id === typeId) ?? null;
		this.attributeValues.set(
			Object.fromEntries(
				(selectedType?.attributeDefinitions ?? []).map((attribute) => [attribute.id, ''])
			)
		);
	}

	protected attributeValue(attributeDefinitionId: string): string {
		return this.attributeValues()[attributeDefinitionId] ?? '';
	}

	protected setAttributeValue(attributeDefinitionId: string, value: string): void {
		this.attributeValues.update((currentValues) => ({
			...currentValues,
			[attributeDefinitionId]: value
		}));
	}

	protected submit(): void {
		const trimmedName = this.name().trim();
		const selectedTypeId = this.typeId();
		if (!trimmedName || !selectedTypeId) {
			return;
		}

		this.dialogRef.close({
			name: trimmedName,
			typeId: selectedTypeId,
			capacity: this.capacity(),
			mergeGroup: this.submittedMergeGroup(),
			attributeValues: buildAttributeValueInputs(
				this.selectedType()?.attributeDefinitions ?? [],
				this.attributeValues()
			)
		});
	}
}
