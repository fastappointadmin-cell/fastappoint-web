import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardCreateResourceTypeRequest } from '../../models/dashboard-resource.model';

@Component({
	selector: 'app-resource-type-create-dialog',
	imports: [FormsModule, DialogModule, TranslocoPipe],
	templateUrl: './resource-type-create-dialog.html',
	styleUrl: './resource-type-create-dialog.scss',
})
export class ResourceTypeCreateDialog {
	private readonly dialogRef = inject(DialogRef<DashboardCreateResourceTypeRequest | null>);

	protected readonly name = signal('');

	protected cancel(): void {
		this.dialogRef.close(null);
	}

	protected submit(): void {
		const trimmedName = this.name().trim();
		if (!trimmedName) {
			return;
		}

		this.dialogRef.close({ name: trimmedName });
	}
}
