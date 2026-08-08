import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardCreateServiceRequest } from '../../models/dashboard-service.model';

@Component({
	selector: 'app-service-create-dialog',
	imports: [FormsModule, DialogModule, TranslocoPipe],
	templateUrl: './service-create-dialog.html',
	styleUrl: './service-create-dialog.scss',
})
export class ServiceCreateDialog {
	private readonly dialogRef = inject(DialogRef<DashboardCreateServiceRequest | null>);

	protected readonly name = signal('');
	protected readonly durationMinutes = signal(30);

	protected cancel(): void {
		this.dialogRef.close(null);
	}

	protected submit(): void {
		const trimmedName = this.name().trim();
		if (!trimmedName || this.durationMinutes() < 1) {
			return;
		}

		this.dialogRef.close({
			name: trimmedName,
			durationSeconds: this.durationMinutes() * 60
		});
	}
}
