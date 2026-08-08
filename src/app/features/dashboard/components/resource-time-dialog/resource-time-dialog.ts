import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogModule, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ResourceTimeDialogData {
	resourceName: string;
	capacity: number | null;
}

export interface ResourceTimeDialogResult {
	capacity: number | null;
}

@Component({
	selector: 'app-resource-time-dialog',
	imports: [FormsModule, DialogModule, TranslocoPipe],
	templateUrl: './resource-time-dialog.html',
	styleUrl: './resource-time-dialog.scss',
})
export class ResourceTimeDialog {
	private readonly dialogRef = inject(DialogRef<ResourceTimeDialogResult | null>);
	protected readonly data = inject<ResourceTimeDialogData>(DIALOG_DATA);

	protected readonly capacity = signal<number | null>(this.data.capacity);

	protected cancel(): void {
		this.dialogRef.close(null);
	}

	protected submit(): void {
		const value = this.capacity();
		if (value !== null && value < 1) {
			return;
		}

		this.dialogRef.close({
			capacity: value
		});
	}
}
